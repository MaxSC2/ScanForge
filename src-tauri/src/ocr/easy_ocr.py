"""
ScanForge EasyOCR helper.

Called by the Rust EasyOCR provider as an external process.
Expects a JSON request on stdin, outputs JSON result on stdout.

Dependencies:
  pip install easyocr

EasyOCR supports 80+ languages including Japanese, Chinese, Korean,
English, and Russian. Useful as a fallback when PaddleOCR fails.
"""

import json
import sys
import base64
import io
import tempfile
import os
import traceback

REQUIREMENTS_MET = False
try:
    import easyocr
    REQUIREMENTS_MET = True
except ImportError:
    pass


def decode_image(data_url: str) -> bytes:
    _, encoded = data_url.split(",", 1)
    return base64.b64decode(encoded)


def run_ocr(request: dict) -> dict:
    source_language = request.get("sourceLanguage", "ja")
    overwrite = request.get("overwriteExisting", False)
    image_data_url = request.get("imageDataUrl", "")
    regions = request.get("regions", [])

    # Map ScanForge language codes to EasyOCR language codes
    lang_map = {
        "ja": ["ja"],
        "zh": ["ch_sim", "ch_tra"],
        "ko": ["ko"],
        "en": ["en"],
        "ru": ["ru"],
    }
    langs = lang_map.get(source_language, [source_language])

    if not REQUIREMENTS_MET:
        return {
            "engine": "easyocr",
            "results": [
                {
                    "regionId": r["id"],
                    "text": None,
                    "confidence": None,
                    "skipped": True,
                    "reason": "easyocr is not installed. Run: pip install easyocr",
                }
                for r in regions
            ],
        }

    image_bytes = decode_image(image_data_url)
    reader = easyocr.Reader(langs, gpu=False)
    results = []

    with tempfile.TemporaryDirectory(prefix="scanforge-easyocr-") as tmpdir:
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
                from PIL import Image
                img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                cropped = img.crop((x, y, x + w, y + h))
                crop_path = os.path.join(tmpdir, f"{rid}.png")
                cropped.save(crop_path, format="PNG")

                ocr_result = reader.readtext(crop_path)

                if not ocr_result:
                    results.append({
                        "regionId": rid,
                        "text": None,
                        "confidence": None,
                        "skipped": True,
                        "reason": "no_text",
                    })
                    continue

                texts = []
                confidences = []
                for bbox, text, conf in ocr_result:
                    texts.append(text)
                    confidences.append(conf)

                combined_text = " ".join(texts)
                avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

                results.append({
                    "regionId": rid,
                    "text": combined_text,
                    "confidence": round(avg_confidence, 4),
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

    return {"engine": "easyocr", "results": results}


def main():
    try:
        raw = sys.stdin.read()
        request = json.loads(raw)
        response = run_ocr(request)
        json.dump(response, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    except Exception as exc:
        error_response = {
            "engine": "easyocr",
            "results": [],
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }
        json.dump(error_response, sys.stdout, ensure_ascii=False, separators=(",", ":"))
        sys.exit(1)


if __name__ == "__main__":
    main()
