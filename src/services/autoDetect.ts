import { createWorker, type Worker } from 'tesseract.js';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isDesktopRuntime } from '../utils/runtime';
import { pageRepository } from '../repositories/pageRepository';
import { regionRepository } from '../repositories/regionRepository';

export interface AutoDetectResponse {
  engine: string | null;
  regionsCreated: number;
  regionIds: string[];
}

export interface AutoDetectProgressEvent {
  pageId: string;
  progress: number;
  message: string;
}

let tesseractWorker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (tesseractWorker) return tesseractWorker;
  tesseractWorker = await createWorker('eng', 1, { logger: () => {} });
  return tesseractWorker;
}

export async function autoDetectRegions(
  pageId: string,
  clearExisting = true,
  onProgress?: (progress: number, message: string) => void,
): Promise<AutoDetectResponse> {
  if (isDesktopRuntime()) {
    let unlisten: UnlistenFn | undefined;
    try {
      unlisten = await listen<AutoDetectProgressEvent>('auto-detect-progress', (event) => {
        onProgress?.(event.payload.progress, event.payload.message);
      });
      return await invoke<AutoDetectResponse>('auto_detect_regions', { pageId, clearExisting });
    } finally {
      unlisten?.();
    }
  }

  onProgress?.(0.1, 'Loading page image');

  const pageRecord = await pageRepository.getById(pageId);
  if (!pageRecord) throw new Error('Page not found');

  const imageUrl = pageRecord.imagePath;
  if (!imageUrl || !imageUrl.startsWith('data:')) {
    throw new Error('Page image not available as data URL');
  }

  onProgress?.(0.2, 'Initializing Tesseract.js');

  const worker = await getWorker();

  onProgress?.(0.3, 'Running text detection');

  const result = await worker.recognize(imageUrl);
  const words = result.data.words || [];

  if (words.length === 0) {
    onProgress?.(1.0, 'No text detected');
    return { engine: 'tesseract.js', regionsCreated: 0, regionIds: [] };
  }

  onProgress?.(0.6, `Found ${words.length} words, grouping into regions`);

  const lineHeight = 20;
  const sorted = [...words].sort((a, b) => {
    const rowA = Math.round(a.bbox.y0 / lineHeight);
    const rowB = Math.round(b.bbox.y0 / lineHeight);
    if (rowA !== rowB) return rowA - rowB;
    return a.bbox.x0 - b.bbox.x0;
  });

  const rows: typeof sorted[] = [];
  let currentRow: typeof sorted = [];
  let currentRowTop = sorted.length > 0 ? Math.round(sorted[0].bbox.y0 / lineHeight) : 0;

  for (const word of sorted) {
    const row = Math.round(word.bbox.y0 / lineHeight);
    if (row === currentRowTop && currentRow.length > 0) {
      currentRow.push(word);
    } else {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [word];
      currentRowTop = row;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  const padding = 4;
  const now = Date.now();

  for (let order = 0; order < rows.length; order++) {
    const wordRow = rows[order];
    const minX = Math.max(0, Math.min(...wordRow.map((w) => w.bbox.x0)) - padding);
    const minY = Math.max(0, Math.min(...wordRow.map((w) => w.bbox.y0)) - padding);
    const maxX = Math.max(...wordRow.map((w) => w.bbox.x0 + w.bbox.x1)) + padding;
    const maxY = Math.max(...wordRow.map((w) => w.bbox.y0 + w.bbox.y1)) + padding;

    const regionId = crypto.randomUUID();
    await regionRepository.create({
      id: regionId,
      pageId,
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      rotation: 0,
      label: `${order + 1}`,
      kind: 'speech',
      order: order + 1,
      orientation: 'horizontal',
      sourceText: '',
      translatedText: '',
      status: 'ocr_done',
      ocrStatus: 'done',
      ocrEngine: 'tesseract.js',
      ocrUpdatedAt: now,
      translationStatus: 'idle',
      notes: '',
      locked: false,
      visible: true,
      ocrConfidence: undefined,
      ocrOverwriteEnabled: false,
    });
  }

  onProgress?.(1.0, `Created ${rows.length} text regions`);

  return {
    engine: 'tesseract.js',
    regionsCreated: rows.length,
    regionIds: rows.map(() => crypto.randomUUID()),
  };
}
