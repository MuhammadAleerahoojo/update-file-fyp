import os

# Supabase project JWT secret (Dashboard -> Project Settings -> API -> JWT Secret).
# When set, POST /caption requires a valid signed-in user's access token so the
# endpoint can't be used anonymously to burn CPU / Anthropic credits. Leave
# empty for local development.
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

MAX_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
MIN_SIDE = int(os.getenv("MIN_IMAGE_SIDE", "128"))
MAX_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", str(60_000_000)))

# Minimum CLIP probability for the *expected* modality, and minimum lead over
# the runner-up class. Both must pass for the image to be accepted.
MIN_CONFIDENCE = float(os.getenv("VALIDATION_MIN_CONFIDENCE", "0.50"))
MIN_MARGIN = float(os.getenv("VALIDATION_MIN_MARGIN", "0.10"))
# Mean HSV saturation above which an image is treated as a colour photograph.
MAX_SATURATION = float(os.getenv("VALIDATION_MAX_SATURATION", "0.25"))

CLIP_MODEL = os.getenv("CLIP_MODEL", "openai/clip-vit-base-patch32")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CT_VISION_MODEL = os.getenv("CT_VISION_MODEL", "claude-sonnet-5-5")

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
    ).split(",")
    if o.strip()
]
