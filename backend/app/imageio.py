"""Safe decoding of untrusted uploads."""
import io

import numpy as np

from PIL import Image, UnidentifiedImageError

from . import config

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


class ImageRejected(Exception):
    """The upload can't be used. `code` is stable for clients; `message` is user-facing."""

    def __init__(self, code: str, message: str, status: int = 422, details: dict | None = None):
        super().__init__(message)
        self.code, self.message, self.status, self.details = code, message, status, details or {}


def decode(data: bytes) -> Image.Image:
    if not data:
        raise ImageRejected("EMPTY_FILE", "The uploaded file is empty.", 400)
    if len(data) > config.MAX_BYTES:
        limit_mb = config.MAX_BYTES / (1024 * 1024)
        raise ImageRejected(
            "FILE_TOO_LARGE", f"The file is larger than the {limit_mb:g} MB limit.", 413
        )
    Image.MAX_IMAGE_PIXELS = config.MAX_PIXELS  # decompression-bomb guard
    try:
        img = Image.open(io.BytesIO(data))
        fmt = img.format
        if fmt not in ALLOWED_FORMATS:
            raise ImageRejected(
                "UNSUPPORTED_FORMAT",
                "Unsupported image format — please upload a JPG, PNG or WebP image.",
                415,
            )
        # Header-only check: reject before allocating the pixel buffer. Pillow's
        # own guard only raises at 2x MAX_IMAGE_PIXELS and merely warns below that.
        if img.width * img.height > config.MAX_PIXELS:
            raise ImageRejected(
                "IMAGE_TOO_LARGE",
                "The image dimensions are too large to process. Upload a smaller image.",
                413,
            )
        img.load()
    except ImageRejected:
        raise
    except Image.DecompressionBombError:
        raise ImageRejected(
            "IMAGE_TOO_LARGE",
            "The image dimensions are too large to process. Upload a smaller image.",
            413,
        )
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise ImageRejected(
            "CORRUPT_IMAGE", "The file could not be read as an image. It may be corrupt.", 422
        )
    if img.mode in ("I", "I;16", "I;16L", "I;16B", "F"):
        # 16-bit CT/DICOM exports: a plain convert() clips to 255 and blows the
        # image out to white. Rescale the real intensity range to 8 bits first.
        arr = np.asarray(img, dtype=np.float64)
        lo, hi = float(arr.min()), float(arr.max())
        scaled = (arr - lo) * (255.0 / (hi - lo)) if hi > lo else np.zeros_like(arr)
        img = Image.fromarray(scaled.astype(np.uint8), "L")
    if min(img.size) < config.MIN_SIDE:
        raise ImageRejected(
            "IMAGE_TOO_SMALL",
            f"The image is too small ({img.width}×{img.height}px). Upload at least "
            f"{config.MIN_SIDE}px on each side.",
            422,
        )
    return img
