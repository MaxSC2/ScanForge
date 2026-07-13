"""
ScanForge auto-detection script.

Runs full-page text detection using PaddleOCR (primary) or EasyOCR (fallback).
Unlike per-region OCR scripts, this processes the ENTIRE page and returns
all detected text blocks with bounding boxes and recognized text.

Dependencies:
  pip install paddleocr paddlepaddle
  (or easyocr as fallback)

Called by the Rust auto_detect_regions command as stdin/stdout JSON.
"""

import json
import sys
import base64
import io
import traceback

PADDLE_AVAILABLE = False
EASYOCR_AVAILABLE = False
try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    try:
        import easyocr
        EASYOCR_AVAILABLE = True
    except ImportError:
        pass

def decode_image(data_url: str) -> bytes:
    _, encoded = data_url.split(",", 1)
    return base64.b64decode(encoded)

def run_detection(request: dict) -> dict:
    source_language = request.get("sourceLanguage", "ja")
    image_data_url = request.get("imageDataUrl", "")

    lang_map = {
        "ja": "japan",
        "zh": "ch",
        "ko": "korean",
        "en": "en",
        "ru": "ru",
    }
    pad_lang = lang_map.get(source_language, "japan")
    easy_langs = {
        "ja": ["ja"],
        "zh": ["ch_sim", "ch_tra"],
        "ko": ["ko"],
        "en": ["en"],
        "ru": ["ru"],
    }
    easy_lang_list = easy_langs.get(source_language, [source_language])

    if not PADDLE_AVAILABLE and not EASYOCR_AVAILABLE:
        return {
            "engine": None,
            "reason": "No OCR library available. Install: pip install paddleocr",
            "regions": [],
        }

    image_bytes = decode_image(image_data_url)
    from PIL import Image
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_w, img_h = img.size

    if PADDLE_AVAILABLE:
        try:
            ocr = PaddleOCR(use_angle_cls=True, lang=pad_lang, show_log=False)
            result = ocr.ocr(image_bytes, cls=True)

            if not result or not result[0]:
                if EASYOCR_AVAILABLE:
                    return run_easyocr_detection(img, easy_lang_list)
                return {"engine": "paddle", "regions": []}

            regions = []
            for line in result[0]:
                bbox, (text, conf) = line
                xs = [p[0] for p in bbox]
                ys = [p[1] for p in bbox]
                x = min(xs)
                y = min(ys)
                w = max(xs) - x
                h = max(ys) - y

                regions.append({
                    "x": round(x, 2),
                    "y": round(y, 2),
                    "width": round(w, 2),
                    "height": round(h, 2),
                    "text": text,
                    "confidence": round(conf, 4),
                })

            return {"engine": "paddle", "regions": regions}

        except Exception as exc:
            if EASYOCR_AVAILABLE:
                return run_easyocr_detection(img, easy_lang_list)
            return {"engine": "paddle", "reason": str(exc), "regions": []}
    else:
        return run_easyocr_detection(img, easy_lang_list)


def run_easyocr_detection(img, lang_list: list) -> dict:
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_bytes = img_byte_arr.getvalue()

    reader = easyocr.Reader(lang_list, gpu=False)
    try:
        result = reader.readtext(img_bytes)
    except Exception as exc:
        return {"engine": "easyocr", "reason": str(exc), "regions": []}

    regions = []
    for bbox, text, conf in result:
        xs = [p[0] for p in bbox]
        ys = [p[1] for p in bbox]
        x = min(xs)
        y = min(ys)
        w = max(xs) - x
        h = max(ys) - y

        regions.append({
            "x": round(x, 2),
            "y": round(y, 2),
            "width": round(w, 2),
            "height": round(h, 2),
            "text": text,
            "confidence": round(conf, 4),
        })

    return {"engine": "easyocr", "regions": regions}


def main():
    try:
        raw = sys.stdin.read()
        request = json.loads(raw)
        response = run_detection(request)
        json.dump(response, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    except Exception as exc:
        error_response = {
            "engine": None,
            "regions": [],
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }
        json.dump(error_response, sys.stdout, ensure_ascii=False, separators=(",", ":"))
        sys.exit(1)


if __name__ == "__main__":
    main()
