import { invoke, isTauri } from '@tauri-apps/api/core';
import { pageRepository } from '../repositories/pageRepository';
import { regionRepository } from '../repositories/regionRepository';
import type { OcrPageResult, Page, RegionRecord } from '../types';

type OcrProgressCallback = (progress: number, message: string) => void;

interface StoredOcrContext {
  fileName: string;
  naturalWidth: number;
  naturalHeight: number;
  regions: Array<{
    record: RegionRecord;
    order: number;
    label: string;
  }>;
}

function pageStem(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '');
}

function deriveFileName(page: Page, imagePath: string) {
  if (page.fileName.trim()) {
    return page.fileName;
  }

  if (!imagePath.startsWith('data:')) {
    const normalized = imagePath.replace(/\\/g, '/');
    const segment = normalized.split('/').pop();
    if (segment) {
      return segment;
    }
  }

  return `page-${page.id.slice(0, 8)}`;
}

function buildPreviewText(context: StoredOcrContext, region: StoredOcrContext['regions'][number]) {
  const area = Math.max(1, context.naturalWidth * context.naturalHeight);
  const regionArea = Math.max(1, region.record.width * region.record.height);
  const coverage = Math.max(0.1, Math.round((regionArea / area) * 1000) / 10);
  const label = region.label.trim() || `region ${region.order}`;

  return `OCR preview: ${pageStem(context.fileName)} / text / ${label} / ${coverage}%`;
}

function toFallbackContext(page: Page): StoredOcrContext {
  return {
    fileName: page.fileName,
    naturalWidth: page.naturalWidth,
    naturalHeight: page.naturalHeight,
    regions: page.regions.map((region, index) => ({
      record: {
        id: region.id,
        pageId: page.id,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        rotation: region.rotation,
        sourceText: region.sourceText,
        translatedText: region.translatedText,
        status: region.status,
        locked: region.locked,
        visible: region.visible,
        ...(typeof region.ocrConfidence === 'number'
          ? { ocrConfidence: region.ocrConfidence }
          : {}),
      },
      order: region.order || index + 1,
      label: region.label || `Region ${index + 1}`,
    })),
  };
}

async function loadStoredOcrContext(page: Page): Promise<StoredOcrContext> {
  const [pageRecord, regionRecords] = await Promise.all([
    pageRepository.getById(page.id),
    regionRepository.getByPage(page.id),
  ]);

  if (!pageRecord || regionRecords.length === 0) {
    return toFallbackContext(page);
  }

  return {
    fileName: deriveFileName(page, pageRecord.imagePath),
    naturalWidth: pageRecord.width,
    naturalHeight: pageRecord.height,
    regions: regionRecords.map((record, index) => ({
      record,
      order: index + 1,
      label: `Region ${index + 1}`,
    })),
  };
}

async function applyBrowserOcrResult(
  regions: StoredOcrContext['regions'],
  results: OcrPageResult['results'],
) {
  const resultMap = new Map(results.map((result) => [result.regionId, result] as const));

  await Promise.all(
    regions.map(async ({ record }) => {
      const result = resultMap.get(record.id);
      if (!result || result.skipped || !result.text) {
        return;
      }

      await regionRepository.update({
        ...record,
        sourceText: result.text,
        status: record.translatedText.trim() ? 'translated' : 'ocr_done',
      });
    }),
  );
}

async function runBrowserPreviewOcr(
  page: Page,
  onProgress?: OcrProgressCallback,
): Promise<OcrPageResult> {
  const context = await loadStoredOcrContext(page);
  const results: OcrPageResult['results'] = [];

  for (let index = 0; index < context.regions.length; index += 1) {
    const region = context.regions[index];
    await new Promise((resolve) => window.setTimeout(resolve, 90));

    if (region.record.locked) {
      results.push({
        regionId: region.record.id,
        text: null,
        skipped: true,
        reason: 'locked',
      });
    } else if (region.record.sourceText.trim()) {
      results.push({
        regionId: region.record.id,
        text: null,
        skipped: true,
        reason: 'already_filled',
      });
    } else if (region.record.width <= 0 || region.record.height <= 0) {
      results.push({
        regionId: region.record.id,
        text: null,
        skipped: true,
        reason: 'invalid_bounds',
      });
    } else {
      results.push({
        regionId: region.record.id,
        text: buildPreviewText(context, region),
        skipped: false,
        reason: null,
      });
    }

    onProgress?.(
      0.2 + ((index + 1) / Math.max(1, context.regions.length)) * 0.7,
      `OCR region ${index + 1}/${context.regions.length}`,
    );
  }

  const filledCount = results.filter((item) => !item.skipped && item.text).length;
  const skippedCount = results.length - filledCount;

  await applyBrowserOcrResult(context.regions, results);

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
  if (!isTauri()) {
    onProgress?.(0.2, 'Running browser OCR preview');
    return runBrowserPreviewOcr(page, onProgress);
  }

  onProgress?.(0.25, 'Reading OCR input from domain storage');
  onProgress?.(0.55, 'Running Tauri OCR backend');
  return invoke<OcrPageResult>('run_page_ocr', { pageId: page.id });
}
