"""
ScanForge API Server — Pipeline Engine.

Performs the full scanlation pipeline on a chapter:
  Detect → OCR → Translate → Inpaint → Export PNG

Each step is a Python-native implementation that reuses the same
libraries as the Tauri desktop app (PaddleOCR, Ollama, PIL).
"""

import asyncio
import base64
import io
import json
import os
import shutil
import tempfile
import time
import zipfile
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Callable, Optional

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"

@dataclass
class Job:
    id: str
    status: JobStatus = JobStatus.queued
    progress: float = 0.0
    message: str = ""
    error: Optional[str] = None
    created_at: float = 0.0
    finished_at: Optional[float] = None
    source_language: str = "ja"
    target_language: str = "ru"
    ocr_engine: str = "paddle"
    translation_provider: str = "ollama"
    input_dir: str = ""
    output_path: str = ""
    page_count: int = 0
    current_page: int = 0

    listeners: list[Callable] = field(default_factory=list)

    def to_dict(self):
        return {
            "id": self.id,
            "status": self.status.value,
            "progress": round(self.progress, 4),
            "message": self.message,
            "error": self.error,
            "createdAt": self.created_at,
            "finishedAt": self.finished_at,
            "sourceLanguage": self.source_language,
            "targetLanguage": self.target_language,
            "ocrEngine": self.ocr_engine,
            "translationProvider": self.translation_provider,
            "pageCount": self.page_count,
            "currentPage": self.current_page,
        }

    def emit(self):
        data = self.to_dict()
        for listener in self.listeners:
            try:
                listener(data)
            except Exception:
                pass


# In-memory job store
jobs: dict[str, Job] = {}

# ---------------------------------------------------------------------------
# Step 1: Detection + OCR
# ---------------------------------------------------------------------------

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

def detect_text_regions(page_path: str, source_language: str) -> list[dict]:
    from PIL import Image
    img = Image.open(page_path).convert("RGB")
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    img_data = img_bytes.getvalue()

    if PADDLE_AVAILABLE:
        lang_map = {"ja": "japan", "zh": "ch", "ko": "korean", "en": "en", "ru": "ru"}
        lang = lang_map.get(source_language, "japan")
        ocr = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
        result = ocr.ocr(img_data, cls=True)
        if result and result[0]:
            regions = []
            for line in result[0]:
                bbox, (text, conf) = line
                xs = [p[0] for p in bbox]
                ys = [p[1] for p in bbox]
                regions.append({
                    "x": round(min(xs), 2),
                    "y": round(min(ys), 2),
                    "width": round(max(xs) - min(xs), 2),
                    "height": round(max(ys) - min(ys), 2),
                    "text": text,
                    "confidence": round(conf, 4),
                })
            return regions

    if EASYOCR_AVAILABLE:
        lang_map = {"ja": ["ja"], "zh": ["ch_sim", "ch_tra"], "ko": ["ko"], "en": ["en"], "ru": ["ru"]}
        langs = lang_map.get(source_language, [source_language])
        reader = easyocr.Reader(langs, gpu=False)
        result = reader.readtext(img_data)
        regions = []
        for bbox, text, conf in result:
            xs = [p[0] for p in bbox]
            ys = [p[1] for p in bbox]
            regions.append({
                "x": round(min(xs), 2),
                "y": round(min(ys), 2),
                "width": round(max(xs) - min(xs), 2),
                "height": round(max(ys) - min(ys), 2),
                "text": text,
                "confidence": round(conf, 4),
            })
        return regions

    return []

# ---------------------------------------------------------------------------
# Step 2: Translation
# ---------------------------------------------------------------------------

async def translate_text(text: str, source_lang: str, target_lang: str,
                         provider: str, ollama_url: str) -> Optional[str]:
    if not text or not text.strip():
        return None
    if provider == "mock":
        return f"[TRANS: {text}]"
    if provider == "ollama":
        return await _ollama_translate(text, source_lang, target_lang, ollama_url)
    if provider == "sakura":
        return await _sakura_translate(text, source_lang, target_lang, ollama_url)
    return None

async def _ollama_translate(text: str, source: str, target: str,
                            base_url: str) -> Optional[str]:
    import httpx
    prompt = (
        f"Translate the following text from {source} to {target}. "
        f"Return only the translation, no explanations.\n\n{text}"
    )
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{base_url}/api/generate", json={
                "model": "llama3.1",
                "prompt": prompt,
                "stream": False,
            })
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "").strip() or None
    except Exception:
        return None

async def _sakura_translate(text: str, source: str, target: str,
                            base_url: str) -> Optional[str]:
    import httpx
    prompt = (
        f"You are a manga translator. Translate from {source} to {target}. "
        f"Preserve names, onomatopoeia, and cultural terms. "
        f"Return only the translation.\n\n{text}"
    )
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{base_url}/api/generate", json={
                "model": "sakura-13b",
                "prompt": prompt,
                "stream": False,
            })
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "").strip() or None
    except Exception:
        return None

# ---------------------------------------------------------------------------
# Step 3: Inpainting (border fill + blur, mirrors basic.ts)
# ---------------------------------------------------------------------------

def inpaint_region(img, x: int, y: int, w: int, h: int):
    from PIL import ImageFilter, Image
    left = max(0, x)
    top = max(0, y)
    right = min(img.width, x + w)
    bottom = min(img.height, y + h)

    if right <= left or bottom <= top:
        return

    region = img.crop((left, top, right, bottom))
    border = 3
    fill_color = _average_border_color(region, border)
    fill_img = Image.new("RGB", (right - left, bottom - top), fill_color)

    blurred = fill_img.filter(ImageFilter.GaussianBlur(radius=2))
    img.paste(blurred, (left, top))

def _average_border_color(region, border: int):
    from PIL import ImageStat
    w, h = region.size
    samples = []
    if h > 0:
        samples.append(region.crop((0, 0, w, min(border, h))))
        samples.append(region.crop((0, max(0, h - border), w, h)))
    if w > 0:
        samples.append(region.crop((0, 0, min(border, w), h)))
        samples.append(region.crop((max(0, w - border), 0, w, h)))
    if not samples:
        return (128, 128, 128)
    merged = Image.new("RGB", (1, 1))
    r, g, b = 0, 0, 0
    count = 0
    for s in samples:
        stat = ImageStat.Stat(s)
        r += stat.mean[0]
        g += stat.mean[1]
        b += stat.mean[2]
        count += 1
    if count == 0:
        return (128, 128, 128)
    return (int(r / count), int(g / count), int(b / count))

# ---------------------------------------------------------------------------
# Step 4: Export
# ---------------------------------------------------------------------------

def export_page(img, regions: list[dict], output_dir: str, page_index: int):
    out_path = os.path.join(output_dir, f"page_{page_index:04d}.png")
    img.save(out_path, format="PNG")
    return out_path

# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------

async def run_pipeline(job: Job):
    job.status = JobStatus.running
    job.progress = 0.0
    job.message = "Starting pipeline"
    job.emit()

    pages = sorted(
        [f for f in os.listdir(job.input_dir) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp"))]
    )
    job.page_count = len(pages)
    if job.page_count == 0:
        job.status = JobStatus.failed
        job.message = "No images found"
        job.error = "Input directory has no supported images"
        job.emit()
        return

    output_images_dir = os.path.join(job.output_path, "images")
    os.makedirs(output_images_dir, exist_ok=True)

    from PIL import Image

    for i, filename in enumerate(pages):
        page_path = os.path.join(job.input_dir, filename)
        job.current_page = i + 1
        job.progress = i / job.page_count
        job.message = f"Detecting text on page {i+1}/{job.page_count}"
        job.emit()

        # 1. Detect text regions + OCR
        regions = detect_text_regions(page_path, job.source_language)
        if not regions:
            shutil.copy2(page_path, os.path.join(output_images_dir, f"page_{i+1:04d}.png"))
            continue

        # 2. Translate
        img = Image.open(page_path).convert("RGB")
        translated_regions: list[dict] = []
        for r in regions:
            translated = await translate_text(
                r["text"], job.source_language, job.target_language,
                job.translation_provider, os.environ.get("OLLAMA_URL", "http://localhost:11434"),
            )
            translated_regions.append({**r, "translated_text": translated or r["text"]})

        job.message = f"Inpainting page {i+1}/{job.page_count}"
        job.emit()

        # 3. Inpaint
        for r in regions:
            inpaint_region(img, int(r["x"]), int(r["y"]), int(r["width"]), int(r["height"]))

        # 4. Export
        out_path = export_page(img, translated_regions, output_images_dir, i + 1)

    # Create ZIP
    zip_path = os.path.join(job.output_path, "result.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in sorted(os.listdir(output_images_dir)):
            if fname.endswith(".png"):
                zf.write(os.path.join(output_images_dir, fname), fname)

    job.status = JobStatus.done
    job.progress = 1.0
    job.message = f"Done. {job.page_count} pages processed."
    job.finished_at = time.time()
    job.emit()
