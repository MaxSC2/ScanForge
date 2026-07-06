"""
ScanForge PaddleOCR helper.

Called by the Rust PaddleOCR provider as an external process.
Expects a JSON request on stdin, outputs JSON result on stdout.

Dependencies:
  pip install paddleocr paddlepaddle

Note: PaddleOCR supports multiple languages including Japanese, Chinese,
Korean, and English, making it a good general fallback for manga-ocr.
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
    from paddleocr import PaddleOCR
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

    # Map ScanForge language codes to PaddleOCR language codes
    lang_map = {
        "ja": "japan",
        "zh": "ch",
        "ko": "korean",
        "en": "en",
    }
    lang = lang_map.get(source_language, "japan")

    if not REQUIREMENTS_MET:
        return {
            "engine": "paddle",
            "results": [
                {
                    "regionId": r["id"],
                    "text": None,
                    "confidence": None,
                    "skipped": True,
                    "reason": "paddleocr is not installed. Run: pip install paddleocr",
                }
                for r in regions
            ],
        }

    image_bytes = decode_image(image_data_url)
    ocr = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
    results = []

    with tempfile.TemporaryDirectory(prefix="scanforge-paddle-") as tmpdir:
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

                ocr_result = ocr.ocr(crop_path, cls=True)

                if not ocr_result or not ocr_result[0]:
                    results.append({
                        "regionId": rid,
                        "text": None,
                        "confidence": None,
                        "skipped": True,
                        "reason": "no_text",
                    })
                    continue

                # Combine all detected text lines
                texts = []
                confidences = []
                for line in ocr_result[0]:
                    bbox, (text, conf) = line
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

    return {"engine": "paddle", "results": results}


def main():
    try:
        raw = sys.stdin.read()
        request = json.loads(raw)
        response = run_ocr(request)
        json.dump(response, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    except Exception as exc:
        error_response = {
            "engine": "paddle",
            "results": [],
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }
        json.dump(error_response, sys.stdout, ensure_ascii=False, separators=(",", ":"))
        sys.exit(1)


if __name__ == "__main__":
    main()
