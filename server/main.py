"""
ScanForge API Server — FastAPI entry point.

Run:
    cd server && pip install -r requirements.txt && python main.py

Endpoints:
    GET  /api/v1/health
    POST /api/v1/process      — upload files or provide URLs
    GET  /api/v1/job/{id}     — job status
    GET  /api/v1/job/{id}/download — download result ZIP
    WS   /api/v1/job/{id}/ws  — real-time progress
"""

import asyncio
import json
import os
import shutil
import tempfile
import time
import uuid
from pathlib import Path

import aiofiles
from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from pipeline import Job, JobStatus, jobs, run_pipeline

app = FastAPI(
    title="ScanForge API",
    version="0.1.0",
    description="Phone-based manga translation server.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_BASE = os.path.join(tempfile.gettempdir(), "scanforge-server")
os.makedirs(TEMP_BASE, exist_ok=True)

# ---------------------------------------------------------------------------
# WebSocket connection store
# ---------------------------------------------------------------------------

ws_connections: dict[str, list[WebSocket]] = {}


def make_job_listener(job_id: str):
    async def listener(data: dict):
        ws_list = ws_connections.get(job_id, [])
        dead = []
        for ws in ws_list:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            ws_list.remove(ws)
    return listener


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/v1/health")
async def health():
    return {
        "status": "ok",
        "version": "0.1.0",
        "paddleAvailable": _check_paddle(),
        "easyocrAvailable": _check_easyocr(),
    }


def _check_paddle() -> bool:
    try:
        import paddleocr
        return True
    except ImportError:
        return False


def _check_easyocr() -> bool:
    try:
        import easyocr
        return True
    except ImportError:
        return False


@app.post("/api/v1/process")
async def process_chapter(
    files: list[UploadFile] = File(None),
    source_language: str = Form("ja"),
    target_language: str = Form("ru"),
    ocr_engine: str = Form("paddle"),
    translation_provider: str = Form("mock"),
):
    job_id = str(uuid.uuid4())
    job_dir = os.path.join(TEMP_BASE, job_id)
    input_dir = os.path.join(job_dir, "input")
    output_dir = os.path.join(job_dir, "output")
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    # Save uploaded files
    saved_count = 0
    if files:
        for f in files:
            ext = os.path.splitext(f.filename or "page.png")[1] or ".png"
            dest = os.path.join(input_dir, f"{saved_count:04d}{ext}")
            async with aiofiles.open(dest, "wb") as out:
                content = await f.read()
                await out.write(content)
            saved_count += 1

    if saved_count == 0:
        shutil.rmtree(job_dir)
        return JSONResponse(
            status_code=400,
            content={"error": "No files uploaded"},
        )

    job = Job(
        id=job_id,
        source_language=source_language,
        target_language=target_language,
        ocr_engine=ocr_engine,
        translation_provider=translation_provider,
        input_dir=input_dir,
        output_path=output_dir,
        created_at=time.time(),
    )
    job.listeners.append(make_job_listener(job_id))
    jobs[job_id] = job

    asyncio.create_task(run_pipeline(job))

    return {"jobId": job_id, "pages": saved_count}


@app.get("/api/v1/job/{job_id}")
async def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"error": "Job not found"})
    return job.to_dict()


@app.get("/api/v1/job/{job_id}/download")
async def download_result(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"error": "Job not found"})
    if job.status != JobStatus.done:
        return JSONResponse(
            status_code=400,
            content={"error": f"Job is {job.status.value}, not done yet"},
        )
    zip_path = os.path.join(job.output_path, "result.zip")
    if not os.path.exists(zip_path):
        return JSONResponse(status_code=404, content={"error": "Result file not found"})
    return FileResponse(zip_path, media_type="application/zip",
                        filename=f"scanforge-{job_id[:8]}.zip")


@app.websocket("/api/v1/job/{job_id}/ws")
async def job_websocket(websocket: WebSocket, job_id: str):
    await websocket.accept()
    if job_id not in ws_connections:
        ws_connections[job_id] = []
    ws_connections[job_id].append(websocket)

    job = jobs.get(job_id)
    if job:
        await websocket.send_json(job.to_dict())

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if job_id in ws_connections:
            try:
                ws_connections[job_id].remove(websocket)
            except ValueError:
                pass


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8765"))
    print(f"ScanForge API starting on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
