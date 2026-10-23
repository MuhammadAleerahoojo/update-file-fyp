"""Dr Xora analysis API.

POST /caption  multipart: file, modality=xray|ct
  200 {caption, modality, validation, meta}
  4xx {code, message, ...}  -- image rejected (never analysed)
  503 {code: ANALYZER_UNAVAILABLE, message}
"""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

import jwt
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import config
from .analyzers import ANALYZERS, AnalyzerUnavailable
from .imageio import ImageRejected, decode
from .validator import validator, invalid_message

# Model downloaders print unicode progress bars; a legacy Windows console (cp1252)
# would otherwise crash them mid-download.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

log = logging.getLogger("xora")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Warm the models so the first request isn't a long model download.
    for name, loader in (
        ("validator", validator.load),
        ("xray analyzer", ANALYZERS["xray"].load),
    ):
        try:
            await run_in_threadpool(loader)
            log.info("%s ready", name)
        except Exception:
            log.exception("%s failed to preload; will retry on first request", name)
    if not config.SUPABASE_JWT_SECRET:
        log.warning("SUPABASE_JWT_SECRET is not set: /caption is open to unauthenticated callers")
    yield


app = FastAPI(title="Dr Xora analysis API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)


def error(status: int, code: str, message: str, **extra) -> JSONResponse:
    return JSONResponse(
        status_code=status, content={"code": code, "message": message, "detail": message, **extra}
    )


@app.exception_handler(ImageRejected)
async def _rejected(_: Request, exc: ImageRejected):
    return error(exc.status, exc.code, exc.message, **exc.details)


@app.exception_handler(RequestValidationError)
async def _bad_request(_: Request, exc: RequestValidationError):
    return error(400, "BAD_REQUEST", "Missing or invalid upload. Send a file and modality (xray or ct).")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "validator_loaded": validator.loaded,
        "xray_analyzer_loaded": ANALYZERS["xray"].loaded,
        "ct_analyzer_configured": ANALYZERS["ct"].loaded,
    }


def _unauthorized(message: str) -> JSONResponse:
    return error(401, "UNAUTHORIZED", message)


def _check_auth(request: Request) -> JSONResponse | None:
    """Return a 401 response unless auth is disabled or the Supabase token is valid."""
    secret = config.SUPABASE_JWT_SECRET
    if not secret:
        return None
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return _unauthorized("Sign in to analyse scans.")
    try:
        jwt.decode(
            token.strip(),
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError:
        return _unauthorized("Your session is invalid or has expired. Sign in again.")
    return None


async def _read_limited(upload: UploadFile) -> bytes:
    data = await upload.read(config.MAX_BYTES + 1)
    return data


@app.post("/caption")
async def caption(request: Request, file: UploadFile = File(...), modality: str = Form("xray")):
    denied = _check_auth(request)
    if denied is not None:
        return denied

    modality = (modality or "").strip().lower()
    if modality not in ("xray", "ct"):
        return error(400, "BAD_MODALITY", 'modality must be "xray" or "ct".')

    data = await _read_limited(file)
    img = await run_in_threadpool(decode, data)

    try:
        verdict = await run_in_threadpool(validator.validate, img, modality)
    except Exception:
        log.exception("validation failed")
        return error(503, "VALIDATOR_UNAVAILABLE", "Image validation is temporarily unavailable. Try again shortly.")

    log.info(
        "validate modality=%s ok=%s detected=%s conf=%.2f reason=%s",
        modality, verdict.ok, verdict.detected, verdict.confidence, verdict.reason,
    )
    if not verdict.ok:
        return error(
            422,
            "INVALID_IMAGE",
            verdict.message or invalid_message(modality),
            detected=verdict.detected,
            expected=modality,
        )

    try:
        is_chest = modality != "xray" or await run_in_threadpool(
            validator.is_chest, img, verdict.features
        )
    except Exception:
        log.exception("body-region check failed")
        return error(503, "VALIDATOR_UNAVAILABLE", "Image validation is temporarily unavailable. Try again shortly.")
    if not is_chest:
        return error(
            422,
            "UNSUPPORTED_BODY_REGION",
            "This looks like an X-ray of another body part. The analysis model supports chest X-rays only — please upload a chest X-ray.",
            detected="xray_non_chest",
            expected=modality,
        )

    try:
        text, meta = await run_in_threadpool(ANALYZERS[modality].analyze, img)
    except AnalyzerUnavailable as exc:
        log.warning("analyzer unavailable: %s", exc)
        return error(503, "ANALYZER_UNAVAILABLE", str(exc))
    except Exception:
        log.exception("analysis failed")
        return error(500, "ANALYSIS_FAILED", "The analysis failed unexpectedly. Please try again.")

    return {
        "caption": text,
        "modality": modality,
        "validation": {"detected": verdict.detected, "confidence": round(verdict.confidence, 3)},
        "meta": meta,
    }
