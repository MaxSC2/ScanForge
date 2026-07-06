"""
ScanForge MangaOCR helper.

Called by the Rust MangaOCR provider as an external process.
Expects a JSON request on stdin, outputs JSON result on stdout.

Usage:
  echo '{...}' | python manga_ocr.py

Dependencies:
  pip install manga-ocr torch

Request format (stdin):
{
  "imageDataUrl": "data:image/png;base64,...",
  "sourceLanguage": "ja",
  "overwriteExisting": false,
  "regions": [
    {
      "id": "r1",
      "x": 0, "y": 0, "width": 100, "height": 50,
      "sourceText": "",
      "locked": false
    }
  ]
}

Response format (stdout):
{
  "engine": "manga-ocr",
  "results": [
    {
      "regionId": "r1",
      "text": "認識結果",
      "confidence": 0.92,
      "skipped": false,
      "reason": null
    }
  ]
}
"""

import json
import sys
import base64
import io
import tempfile
import os
import traceback
from pathlib import Path

REQUIREMENTS_MET = False
try:
    from manga_ocr import MangaOcr
    REQUIREMENTS_MET = True
except ImportError:
    pass


def decode_image(data_url: str) -> bytes:
    """Decode a data: URI to raw bytes."""
    _, encoded = data_url.split(",", 1)
    return base64.b64decode(encoded)


def crop_region(image_bytes: bytes, x: int, y: int, w: int, h: int) -> bytes:
    """Crop a region from the image and return as PNG bytes."""
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    cropped = img.crop((x, y, x + w, y + h))
    buf = io.BytesIO()
    cropped.save(buf, format="PNG")
    return buf.getvalue()


def run_ocr(request: dict) -> dict:
    """Run manga-ocr on all regions in the request."""
    source_language = request.get("sourceLanguage", "ja")
    overwrite = request.get("overwriteExisting", False)
    image_data_url = request.get("imageDataUrl", "")
    regions = request.get("regions", [])

    if not REQUIREMENTS_MET:
        return {
            "engine": "manga-ocr",
            "results": [
                {
                    "regionId": r["id"],
                    "text": None,
                    "confidence": None,
                    "skipped": True,
                    "reason": "manga-ocr is not installed. Run: pip install manga-ocr",
                }
                for r in regions
            ],
        }

    image_bytes = decode_image(image_data_url)
    ocr = MangaOcr()
    results = []

    with tempfile.TemporaryDirectory(prefix="scanforge-manga-") as tmpdir:
        for region in regions:
            rid = region["id"]
            x = max(0, int(region["x"]))
            y = max(0, int(region["y"]))
            w = max(1, int(region["width"]))
            h = max(1, int(region["height"]))

            if region.get("locked"):
                results.append({
                    "regionId": rid,
                    "text": None,
                    "confidence": None,
                    "skipped": True,
                    "reason": "locked",
                })
                continue

            region_overwrite = region.get("ocrOverwriteEnabled", False)
            if not (overwrite or region_overwrite) and region.get("sourceText", "").strip():
                results.append({
                    "regionId": rid,
                    "text": None,
                    "confidence": None,
                    "skipped": True,
                    "reason": "already_filled",
                })
                continue

            try:
                crop_bytes = crop_region(image_bytes, x, y, w, h)
                crop_path = os.path.join(tmpdir, f"{rid}.png")
                with open(crop_path, "wb") as f:
                    f.write(crop_bytes)

                text = ocr(crop_path)
                text = text.strip()

                if not text:
                    results.append({
                        "regionId": rid,
                        "text": None,
                        "confidence": None,
                        "skipped": True,
                        "reason": "no_text",
                    })
                else:
                    results.append({
                        "regionId": rid,
                        "text": text,
                        "confidence": 0.85,
                        "skipped": False,
                        "reason": None,
                    })
            except Exception as exc:
                results.append({
                    "regionId": rid,
                    "text": None,
                    "confidence": None,
                    "skipped": True,
                    "reason": f"error: {exc}",
                })

    return {"engine": "manga-ocr", "results": results}


def main():
    try:
        raw = sys.stdin.read()
        request = json.loads(raw)
        response = run_ocr(request)
        json.dump(response, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    except Exception as exc:
        error_response = {
            "engine": "manga-ocr",
            "results": [],
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }
        json.dump(error_response, sys.stdout, ensure_ascii=False, separators=(",", ":"))
        sys.exit(1)


if __name__ == "__main__":
    main()
