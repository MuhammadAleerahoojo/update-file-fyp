"""Decides whether an upload really is an X-ray / CT slice *before* any analysis.

Two stages:
  1. Colour check: radiology images are (near-)greyscale; photos of drinks,
     people, animals and objects are not. Cheap, deterministic, no model.
  2. CLIP zero-shot classification over radiology modalities *and* a broad set of
     non-medical classes. The image is accepted only if the expected modality wins
     with enough probability and enough margin over the runner-up.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass

import numpy as np
from PIL import Image

from . import config

# class key -> prompts. Logits of several prompts per class are averaged.
CLASSES: dict[str, list[str]] = {
    "xray": [
        "a chest X-ray radiograph",
        "an X-ray image of the chest showing ribs and lungs",
        "a medical radiograph, black and white X-ray film",
        "an X-ray of bones",
    ],
    "ct": [
        "a CT scan slice of the chest",
        "a computed tomography axial slice",
        "a CT scan image of the body, cross-section",
        "a CT scan of the head or abdomen",
    ],
    "ultrasound": ["an ultrasound sonogram image"],
    "photo_person": [
        "a photo of a person",
        "a portrait photograph of a human face",
        "a selfie of a man or a woman",
    ],
    "photo_animal": ["a photo of an animal", "a photo of a dog or a cat"],
    "photo_drink": [
        "a photo of a cold drink bottle",
        "a photo of a soda can or a glass of juice",
    ],
    "photo_object": [
        "a photo of an everyday object",
        "a photo of a car, a building or a landscape",
        "a photo of food",
    ],
    "document": ["a screenshot or a document with text", "a drawing, cartoon or logo"],
}

CLASS_NAMES = {
    "xray": "an X-ray",
    "ct": "a CT scan",
    "ultrasound": "an ultrasound image",
    "photo_person": "a photo of a person",
    "photo_animal": "a photo of an animal",
    "photo_drink": "a photo of a drink",
    "photo_object": "a photo of an everyday object",
    "document": "a document or drawing",
}

REGION_PROMPTS = {
    "chest": [
        "a chest X-ray showing the lungs, ribs and heart",
        "a posteroanterior chest radiograph",
    ],
    "other": [
        "an X-ray of a hand or wrist",
        "an X-ray of a knee, leg or foot",
        "an X-ray of the skull, spine or pelvis",
        "a dental X-ray of teeth",
    ],
}

MODALITY_LABEL = {"xray": "X-ray", "ct": "CT scan"}


@dataclass
class Verdict:
    ok: bool
    detected: str
    confidence: float
    scores: dict[str, float]
    message: str | None = None
    reason: str | None = None
    # Normalised CLIP image embedding, reused by is_chest so the image is encoded once.
    features: object = None


def mean_saturation(img: Image.Image) -> float:
    small = img.convert("RGB").resize((128, 128))
    hsv = np.asarray(small.convert("HSV"), dtype=np.float32) / 255.0
    return float(hsv[..., 1].mean())


def invalid_message(modality: str) -> str:
    return f"Invalid image — please upload a valid {MODALITY_LABEL[modality]} image."


class ScanValidator:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model = None
        self._processor = None
        self._text_feats = None
        self._keys: list[str] = []
        self._prompt_class: list[str] = []
        self._region_feats = None
        self._region_owner: list[str] = []

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        with self._lock:
            if self._model is not None:
                return
            import torch
            from transformers import CLIPModel, CLIPProcessor

            model = CLIPModel.from_pretrained(config.CLIP_MODEL).eval()
            processor = CLIPProcessor.from_pretrained(config.CLIP_MODEL)
            prompts, owners = [], []
            for key, ps in CLASSES.items():
                for p in ps:
                    prompts.append(p)
                    owners.append(key)
            with torch.no_grad():
                tok = processor(text=prompts, return_tensors="pt", padding=True)
                feats = model.get_text_features(**tok)
                feats = feats / feats.norm(dim=-1, keepdim=True)
            rp, ro = [], []
            for key, ps in REGION_PROMPTS.items():
                for p in ps:
                    rp.append(p)
                    ro.append(key)
            with torch.no_grad():
                rf = model.get_text_features(**processor(text=rp, return_tensors="pt", padding=True))
                rf = rf / rf.norm(dim=-1, keepdim=True)
            self._region_feats, self._region_owner = rf, ro
            self._text_feats = feats
            self._prompt_class = owners
            self._keys = list(CLASSES.keys())
            self._model, self._processor = model, processor

    def image_features(self, img: Image.Image):
        import torch

        self.load()
        with torch.no_grad():
            inputs = self._processor(images=img.convert("RGB"), return_tensors="pt")
            f = self._model.get_image_features(**inputs)
            return f / f.norm(dim=-1, keepdim=True)

    def class_probs(self, img: Image.Image, features=None) -> dict[str, float]:
        import torch

        f = features if features is not None else self.image_features(img)
        with torch.no_grad():
            logits = 100.0 * f @ self._text_feats.T  # (1, n_prompts)
            per_class = torch.stack(
                [
                    logits[0, [i for i, o in enumerate(self._prompt_class) if o == k]].mean()
                    for k in self._keys
                ]
            )
            probs = per_class.softmax(0).tolist()
        return dict(zip(self._keys, probs))

    def is_chest(self, img: Image.Image, features=None) -> bool:
        """True if an (already validated) X-ray looks like a chest radiograph."""
        import torch

        f = features if features is not None else self.image_features(img)
        with torch.no_grad():
            logits = 100.0 * f @ self._region_feats.T
            per = torch.stack(
                [
                    logits[0, [i for i, o in enumerate(self._region_owner) if o == k]].mean()
                    for k in REGION_PROMPTS
                ]
            ).softmax(0)
        return bool(per[0] >= 0.5)

    def validate(self, img: Image.Image, modality: str) -> Verdict:
        sat = mean_saturation(img)
        if sat > config.MAX_SATURATION:
            return Verdict(
                False, "color_photo", 0.0, {}, invalid_message(modality), f"saturation={sat:.2f}"
            )

        features = self.image_features(img)
        scores = self.class_probs(img, features)
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        top, top_p = ranked[0]
        runner_p = ranked[1][1]
        want_p = scores[modality]

        if (
            top == modality
            and want_p >= config.MIN_CONFIDENCE
            and (want_p - runner_p) >= config.MIN_MARGIN
        ):
            return Verdict(True, modality, want_p, scores, features=features)

        if top in MODALITY_LABEL and top != modality and top_p >= config.MIN_CONFIDENCE:
            message = (
                f"This looks like {CLASS_NAMES[top]}, not {CLASS_NAMES[modality]}. "
                f'Select "{MODALITY_LABEL[top]}" as the scan type, or upload a valid '
                f"{MODALITY_LABEL[modality]} image."
            )
        else:
            message = invalid_message(modality)
        return Verdict(False, top, top_p, scores, message, f"top={top} p={top_p:.2f}")


validator = ScanValidator()
