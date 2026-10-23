"""Findings generation. Runs only after the image has passed validation.

X-ray: torchxrayvision DenseNet121 (trained on NIH, CheXpert, MIMIC, PadChest, ...),
       18 chest pathologies, runs locally on CPU.
CT:    there is no open pretrained 2D chest-CT slice classifier of comparable quality,
       so findings come from a vision-language model (Anthropic API). Requires
       ANTHROPIC_API_KEY; without it the endpoint reports the analyzer as unavailable
       rather than inventing a result.
"""
from __future__ import annotations

import base64
import glob
import io
import os
import threading

import numpy as np
from PIL import Image

from . import config

REPORT_THRESHOLD = 0.70  # probability above which a pathology is reported as a finding
WATCH_THRESHOLD = 0.55  # "borderline" band


class AnalyzerUnavailable(Exception):
    pass


class XrayAnalyzer:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model = None
        self._xrv = None

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        with self._lock:
            if self._model is not None:
                return
            import torchxrayvision as xrv

            last: Exception | None = None
            for attempt in range(3):
                try:
                    self._model = xrv.models.DenseNet(weights="densenet121-res224-all").eval()
                    self._xrv = xrv
                    return
                except Exception as exc:  # interrupted download, corrupt cache, import error
                    last = exc
                    # A truncated weights file is cached on disk and would fail forever.
                    for f in glob.glob(os.path.join(os.path.expanduser("~"), ".torchxrayvision", "models_data", "*densenet121*")):
                        try:
                            os.remove(f)
                        except OSError:
                            pass
            raise AnalyzerUnavailable(f"X-ray model could not be loaded: {last}") from last

    def analyze(self, img: Image.Image) -> tuple[str, dict]:
        import torch
        import torchvision

        self.load()
        xrv = self._xrv
        arr = np.asarray(img.convert("L"), dtype=np.float32)
        arr = xrv.datasets.normalize(arr, 255)[None, ...]  # (1, H, W), range [-1024, 1024]
        tf = torchvision.transforms.Compose(
            [xrv.datasets.XRayCenterCrop(), xrv.datasets.XRayResizer(224)]
        )
        tensor = torch.from_numpy(tf(arr)).unsqueeze(0)
        with torch.no_grad():
            out = self._model(tensor)[0].numpy()

        probs = {
            name: float(p)
            for name, p in zip(self._model.pathologies, out)
            if name  # a few heads are unnamed placeholders
        }
        ranked = sorted(probs.items(), key=lambda kv: kv[1], reverse=True)
        positives = [(n, p) for n, p in ranked if p >= REPORT_THRESHOLD]
        borderline = [(n, p) for n, p in ranked if WATCH_THRESHOLD <= p < REPORT_THRESHOLD]

        lines = ["Chest X-ray — AI-assisted findings"]
        if positives:
            lines.append("Likely findings:")
            lines += [f"• {n}: {p:.0%} probability" for n, p in positives]
        else:
            lines.append("No pathology exceeded the reporting threshold.")
        if borderline:
            lines.append("Borderline (worth clinical correlation):")
            lines += [f"• {n}: {p:.0%} probability" for n, p in borderline[:4]]
        lines.append("")
        lines.append(
            "Model outputs are probabilities from a screening classifier, not a diagnosis. "
            "Review by a licensed radiologist is required."
        )
        return "\n".join(lines), {"model": "torchxrayvision densenet121-res224-all", "probabilities": probs}


CT_PROMPT = (
    "You are assisting a radiologist. The attached image is a single CT slice. "
    "Describe the visible anatomy and any apparent abnormalities (nodules, masses, "
    "consolidation, effusion, haemorrhage, fractures, etc.) in concise bullet points, "
    "then give a one-line impression. State uncertainty plainly; a single slice is "
    "limited. Do not give treatment advice. Plain text only, no markdown headings."
)


class CtAnalyzer:
    @property
    def loaded(self) -> bool:
        return bool(config.ANTHROPIC_API_KEY)

    def load(self) -> None:
        if not config.ANTHROPIC_API_KEY:
            raise AnalyzerUnavailable(
                "CT analysis is not configured on the server (missing ANTHROPIC_API_KEY)."
            )

    def analyze(self, img: Image.Image) -> tuple[str, dict]:
        self.load()
        import anthropic

        work = img.convert("L")
        work.thumbnail((1568, 1568))
        buf = io.BytesIO()
        work.save(buf, format="PNG")
        b64 = base64.standard_b64encode(buf.getvalue()).decode()

        try:
            client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, timeout=60.0, max_retries=2)
            msg = client.messages.create(
                model=config.CT_VISION_MODEL,
                max_tokens=700,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {"type": "base64", "media_type": "image/png", "data": b64},
                            },
                            {"type": "text", "text": CT_PROMPT},
                        ],
                    }
                ],
            )
        except anthropic.APIError as exc:
            raise AnalyzerUnavailable(f"CT analysis service error: {exc.__class__.__name__}") from exc

        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
        if not text:
            raise AnalyzerUnavailable("CT analysis returned an empty result.")
        text += (
            "\n\nAI-generated from a single slice; not a diagnosis. Review by a licensed "
            "radiologist is required."
        )
        return text, {"model": config.CT_VISION_MODEL}


xray_analyzer = XrayAnalyzer()
ct_analyzer = CtAnalyzer()
ANALYZERS = {"xray": xray_analyzer, "ct": ct_analyzer}
