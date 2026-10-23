"""Contract tests. The CLIP model and analyzers are stubbed so these run offline in seconds;
see scripts/check_samples.py for running real images through the real models."""
import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import main
from app.validator import Verdict


def png(color=False, size=(256, 256)) -> bytes:
    rng = np.random.default_rng(0)
    arr = rng.integers(0, 255, (*size, 3 if color else 1), dtype=np.uint8)
    if not color:
        arr = np.repeat(arr, 3, axis=2)
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(main.validator, "load", lambda: None)
    monkeypatch.setattr(main.ANALYZERS["xray"], "load", lambda: None)
    monkeypatch.setattr(main.validator, "is_chest", lambda img, features=None: True)
    return TestClient(main.app)


def post(client, data, modality="xray", name="a.png", ctype="image/png"):
    return client.post("/caption", files={"file": (name, data, ctype)}, data={"modality": modality})


def stub_verdict(monkeypatch, ok, detected="xray", message=None):
    monkeypatch.setattr(
        main.validator,
        "validate",
        lambda img, modality: Verdict(ok, detected, 0.9, {}, message, None),
    )


def test_rejects_colour_photo_without_model(client):
    r = post(client, png(color=True))
    assert r.status_code == 422
    assert r.json()["code"] == "INVALID_IMAGE"
    assert r.json()["message"] == "Invalid image — please upload a valid X-ray image."


def test_ct_rejection_message(client):
    r = post(client, png(color=True), modality="ct")
    assert r.json()["message"] == "Invalid image — please upload a valid CT scan image."


def test_rejected_image_never_reaches_analyzer(client, monkeypatch):
    stub_verdict(monkeypatch, False, "photo_drink", "Invalid image — please upload a valid X-ray image.")

    def boom(img):
        raise AssertionError("analyzer must not run for rejected images")

    monkeypatch.setattr(main.ANALYZERS["xray"], "analyze", boom)
    r = post(client, png())
    assert r.status_code == 422 and r.json()["detected"] == "photo_drink"


def test_accepts_valid_and_returns_caption(client, monkeypatch):
    stub_verdict(monkeypatch, True)
    monkeypatch.setattr(main.ANALYZERS["xray"], "analyze", lambda img: ("findings", {"model": "x"}))
    r = post(client, png())
    assert r.status_code == 200 and r.json()["caption"] == "findings"


def test_non_chest_xray_is_rejected(client, monkeypatch):
    stub_verdict(monkeypatch, True)
    monkeypatch.setattr(main.validator, "is_chest", lambda img, features=None: False)
    r = post(client, png())
    assert r.status_code == 422 and r.json()["code"] == "UNSUPPORTED_BODY_REGION"


def test_ct_without_api_key_is_503(client, monkeypatch):
    from app import config

    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "")
    stub_verdict(monkeypatch, True, "ct")
    r = post(client, png(), modality="ct")
    assert r.status_code == 503 and r.json()["code"] == "ANALYZER_UNAVAILABLE"


@pytest.mark.parametrize(
    "data,code,status",
    [
        (b"", "EMPTY_FILE", 400),
        (b"not an image at all", "CORRUPT_IMAGE", 422),
        (b"%PDF-1.4 fake", "CORRUPT_IMAGE", 422),
    ],
)
def test_bad_files(client, data, code, status):
    r = post(client, data)
    assert (r.status_code, r.json()["code"]) == (status, code)


def test_unsupported_format(client):
    buf = io.BytesIO()
    Image.new("L", (256, 256)).save(buf, "GIF")
    r = post(client, buf.getvalue(), name="a.gif", ctype="image/gif")
    assert r.status_code == 415 and r.json()["code"] == "UNSUPPORTED_FORMAT"


def test_too_small(client):
    r = post(client, png(size=(32, 32)))
    assert r.json()["code"] == "IMAGE_TOO_SMALL"


def test_too_large(client, monkeypatch):
    from app import config

    monkeypatch.setattr(config, "MAX_BYTES", 100)
    r = post(client, png())
    assert r.status_code == 413 and r.json()["code"] == "FILE_TOO_LARGE"


def test_bad_modality_and_missing_file(client):
    assert post(client, png(), modality="mri").json()["code"] == "BAD_MODALITY"
    assert client.post("/caption", data={"modality": "xray"}).json()["code"] == "BAD_REQUEST"


def test_image_with_too_many_pixels_is_rejected(client, monkeypatch):
    from app import config

    monkeypatch.setattr(config, "MAX_PIXELS", 1000)
    r = post(client, png(size=(256, 256)))
    assert r.status_code == 413 and r.json()["code"] == "IMAGE_TOO_LARGE"


def test_too_large_message_reflects_configured_limit(client, monkeypatch):
    from app import config

    monkeypatch.setattr(config, "MAX_BYTES", 2 * 1024 * 1024)
    big = png(size=(1500, 1500))  # incompressible noise, > 2 MB
    assert len(big) > config.MAX_BYTES
    r = post(client, big)
    assert r.status_code == 413 and "2 MB" in r.json()["message"]


class TestAuth:
    SECRET = "x" * 40

    def token(self, secret=None, aud="authenticated", exp_delta=3600):
        import time

        import jwt

        return jwt.encode(
            {"sub": "u1", "aud": aud, "exp": int(time.time()) + exp_delta},
            secret or self.SECRET,
            algorithm="HS256",
        )

    @pytest.fixture(autouse=True)
    def _enable(self, monkeypatch):
        from app import config

        monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", self.SECRET)

    def call(self, client, token=None):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        return client.post(
            "/caption",
            files={"file": ("a.png", png(color=True), "image/png")},
            data={"modality": "xray"},
            headers=headers,
        )

    def test_missing_token_is_401(self, client):
        r = self.call(client)
        assert r.status_code == 401 and r.json()["code"] == "UNAUTHORIZED"

    @pytest.mark.parametrize(
        "kwargs", [{"secret": "y" * 40}, {"aud": "anon"}, {"exp_delta": -10}]
    )
    def test_bad_token_is_401(self, client, kwargs):
        assert self.call(client, self.token(**kwargs)).status_code == 401

    def test_valid_token_reaches_validation(self, client):
        # Colour image → rejected by the validator (422), proving auth passed.
        assert self.call(client, self.token()).status_code == 422


def test_token_without_exp_is_rejected(client, monkeypatch):
    import jwt

    from app import config

    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", "x" * 40)
    tok = jwt.encode({"sub": "u1", "aud": "authenticated"}, "x" * 40, algorithm="HS256")
    r = client.post(
        "/caption",
        files={"file": ("a.png", png(), "image/png")},
        data={"modality": "xray"},
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 401


def test_chest_check_failure_is_structured_503(client, monkeypatch):
    stub_verdict(monkeypatch, True)

    def boom(img, features=None):
        raise RuntimeError("oom")

    monkeypatch.setattr(main.validator, "is_chest", boom)
    r = post(client, png())
    assert r.status_code == 503 and r.json()["code"] == "VALIDATOR_UNAVAILABLE"


def test_16bit_grayscale_is_rescaled_not_clipped():
    from app.imageio import decode

    arr = (np.random.default_rng(1).integers(0, 4000, (200, 200))).astype(np.uint16)
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, "PNG")
    img = decode(buf.getvalue())
    out = np.asarray(img)
    assert img.mode == "L" and out.max() > 200 and out.mean() < 160  # not blown out to white
