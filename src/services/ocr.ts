import { invoke, isTauri } from '@tauri-apps/api/core';
import type { OcrPagePayload, OcrPageResult, OcrRegionInput, Page } from '../types';

type OcrProgressCallback = (progress: number, message: string) => void;

function pageStem(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '');
}

function regionKindLabel(kind: OcrRegionInput['kind']) {
  if (kind === 'speech') return 'speech';
  if (kind === 'sfx') return 'sfx';
  if (kind === 'narration') return 'narration';
  return 'text';
}

function toRegionInput(page: Page): OcrRegionInput[] {
  return page.regions.map((region) => ({
    id: region.id,
    label: region.label,
    kind: region.kind,
    order: region.order,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    sourceText: region.sourceText,
    locked: region.locked,
  }));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to encode OCR payload'));
    reader.readAsDataURL(blob);
  });
}

async function imageUrlToDataUrl(imageUrl: string) {
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  const blob = await fetch(imageUrl).then((response) => response.blob());
  return blobToDataUrl(blob);
}

function buildPreviewText(payload: OcrPagePayload, region: OcrRegionInput) {
  const area = Math.max(1, payload.naturalWidth * payload.naturalHeight);
  const regionArea = Math.max(1, region.width * region.height);
  const coverage = Math.max(0.1, Math.round((regionArea / area) * 1000) / 10);
  const label = region.label.trim() || `region ${region.order}`;

  return `OCR preview: ${pageStem(payload.fileName)} / ${regionKindLabel(region.kind)} / ${label} / ${coverage}%`;
}

async function runBrowserPreviewOcr(
  payload: OcrPagePayload,
  onProgress?: OcrProgressCallback,
): Promise<OcrPageResult> {
  const results: OcrPageResult['results'] = [];

  for (let index = 0; index < payload.regions.length; index += 1) {
    const region = payload.regions[index];
    await new Promise((resolve) => window.setTimeout(resolve, 90));

    if (region.locked) {
      results.push({
        regionId: region.id,
        text: null,
        skipped: true,
        reason: 'locked',
      });
    } else if (region.sourceText.trim()) {
      results.push({
        regionId: region.id,
        text: null,
        skipped: true,
        reason: 'already_filled',
      });
    } else {
      results.push({
        regionId: region.id,
        text: buildPreviewText(payload, region),
        skipped: false,
        reason: null,
      });
    }

    onProgress?.(
      0.2 + ((index + 1) / Math.max(1, payload.regions.length)) * 0.7,
      `OCR region ${index + 1}/${payload.regions.length}`,
    );
  }

  const filledCount = results.filter((item) => !item.skipped && item.text).length;
  const skippedCount = results.length - filledCount;

  return {
    engine: 'scanforge-browser-preview',
    regionsProcessed: results.length,
    filledCount,
    skippedCount,
    results,
  };
}

export async function runPageOcr(
  page: Page,
  onProgress?: OcrProgressCallback,
): Promise<OcrPageResult> {
  onProgress?.(0.1, 'Encoding page image');
  const imageDataUrl = await imageUrlToDataUrl(page.imageUrl);

  const payload: OcrPagePayload = {
    pageId: page.id,
    fileName: page.fileName,
    imageDataUrl,
    naturalWidth: page.naturalWidth,
    naturalHeight: page.naturalHeight,
    regions: toRegionInput(page),
  };

  if (!isTauri()) {
    onProgress?.(0.2, 'Running browser OCR preview');
    return runBrowserPreviewOcr(payload, onProgress);
  }

  onProgress?.(0.35, 'Running Tauri OCR backend');
  return invoke<OcrPageResult>('run_page_ocr', { payload });
}
