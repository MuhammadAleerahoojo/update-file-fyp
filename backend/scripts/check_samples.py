"""Run a folder of images through the real validator for both modalities.

usage: python scripts/check_samples.py <dir>
File names starting with xray / ct are expected to be accepted for that modality only;
everything else must be rejected for both.
"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.validator import validator  # noqa: E402

bad = 0
for p in sorted(Path(sys.argv[1]).iterdir()):
    img = Image.open(p)
    img.load()
    row = []
    for m in ("xray", "ct"):
        v = validator.validate(img, m)
        want = p.name.startswith(m)
        flag = "" if v.ok == want else "  <-- WRONG"
        bad += v.ok != want
        top = max(v.scores, key=v.scores.get) if v.scores else v.detected
        row.append(f"{m}:{'ACCEPT' if v.ok else 'reject'}({top} {v.confidence:.2f}){flag}")
    print(f"{p.name:16}", " | ".join(row))
print("mismatches:", bad)

# Region check on accepted X-rays
for p in sorted(Path(sys.argv[1]).glob("xray*")):
    img = Image.open(p); img.load()
    print(p.name, "chest" if validator.is_chest(img) else "NON-CHEST")
