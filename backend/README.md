# Dr Xora analysis API

FastAPI service behind `POST /caption`. Every upload goes through:

1. **Decode + sanity checks** – real image bytes (not just the extension), JPG/PNG/WebP only,
   ≤10 MB, ≥128 px, decompression-bomb guard.
2. **Scan validation** – colour check, then CLIP zero-shot classification against X-ray, CT and
   non-medical classes (people, animals, drinks, objects, documents…). The image must be the
   *selected* modality with enough confidence and margin. A CT sent as X-ray (or vice versa) is
   rejected with a hint to switch scan type.
3. **Analysis** – only for accepted images.
   - X-ray: `torchxrayvision` DenseNet121 (18 chest pathologies), local CPU. Chest only; other
     body parts are rejected with `UNSUPPORTED_BODY_REGION`.
   - CT: vision-language model via the Anthropic API. Needs `ANTHROPIC_API_KEY`; without it the
     API returns `503 ANALYZER_UNAVAILABLE` rather than inventing output.

Rejections are `4xx` with `{code, message}`, e.g.
`422 INVALID_IMAGE — "Invalid image — please upload a valid X-ray image."`.
The frontend validates **before** storing anything, so rejected images are never saved.

## Run

```sh
cd backend
python -m venv .venv
.venv\Scripts\activate            # Linux/macOS: source .venv/bin/activate
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
uvicorn app.main:app --port 8000
```

First start downloads ~0.7 GB of model weights (CLIP + DenseNet); `/health` reports readiness.
Set `SUPABASE_JWT_SECRET` (Supabase → Project Settings → API → JWT Secret) in production: `/caption`
then requires the signed-in user's access token, which the frontend sends automatically. Without it
the endpoint is open to anyone who can reach it.
Set `VITE_AI_API_URL` in the frontend to this service's public URL for deployed builds, and
`CORS_ORIGINS` here to the frontend's origin.

## Test

```sh
pytest tests                                   # contract tests, offline, models stubbed
python scripts/check_samples.py <folder>       # real models; files named xray*/ct* must be
                                               # accepted for that modality, others rejected
```

## Limits to know about

- Validation is zero-shot, not a trained radiology gate. It was checked on a small sample
  (2 X-rays, 3 CT slices, colour and greyscale photos, noise) with no mistakes, but tune the
  thresholds and evaluate on your own data before clinical use. MRI images are not separated from CT.
- Screening probabilities / AI text are decision support, not diagnoses.
