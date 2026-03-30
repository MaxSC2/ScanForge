import { invoke } from '@tauri-apps/api/core';
import { pageRepository } from '../repositories/pageRepository';
import { ensureProjectDomainDefaults } from '../repositories/projectDefaults';
import { regionRepository } from '../repositories/regionRepository';
import { useDiagnosticsStore } from '../stores/useDiagnosticsStore';
import { useProjectStore } from '../stores/useProjectStore';
import type { OcrEngineId, OcrPageResult, Page, RegionRecord } from '../types';
import { isDesktopRuntime } from '../utils/runtime';

type OcrProgressCallback = (progress: number, message: string) => void;

export interface OcrRunOptions {
  regionIds?: string[];
  overwriteExisting?: boolean;
}

interface StoredOcrContext {
  fileName: string;
  naturalWidth: number;
  naturalHeight: number;
  sourceLanguage?: string;
  ocrEngine: OcrEngineId | string;
  regions: Array<{
    record: RegionRecord;
    order: number;
    label: string;
  }>;
}

function filterTargetRegions(regions: RegionRecord[], regionIds?: string[]) {
  if (!regionIds || regionIds.length === 0) {
    return regions;
  }

  const targetIds = new Set(regionIds);
  return regions.filter((region) => targetIds.has(region.id));
}

function toPreviewEngineName(engine: string) {
  return engine === 'mock' ? 'scanforge-preview' : `scanforge-${engine}-preview`;
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

function toFallbackContext(page: Page, options: OcrRunOptions): StoredOcrContext {
  const fallbackRecords = page.regions.map((region, index) => ({
    id: region.id,
    pageId: page.id,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    rotation: region.rotation,
    label: region.label,
    kind: region.kind,
    order: region.order || index + 1,
    orientation: region.orientation,
    sourceText: region.sourceText,
    ...(region.sourceLanguage ? { sourceLanguage: region.sourceLanguage } : {}),
    translatedText: region.translatedText,
    status: region.status,
    ocrStatus: region.ocrStatus,
    ...(region.ocrEngine ? { ocrEngine: region.ocrEngine } : {}),
    ...(typeof region.ocrUpdatedAt === 'number' ? { ocrUpdatedAt: region.ocrUpdatedAt } : {}),
    ...(region.targetLanguage ? { targetLanguage: region.targetLanguage } : {}),
    translationStatus: region.translationStatus,
    ...(region.translationProvider ? { translationProvider: region.translationProvider } : {}),
    ...(typeof region.translationUpdatedAt === 'number'
      ? { translationUpdatedAt: region.translationUpdatedAt }
      : {}),
    notes: region.notes,
    locked: region.locked,
    visible: region.visible,
    ...(region.textStyleId ? { textStyleId: region.textStyleId } : {}),
    ...(typeof region.ocrConfidence === 'number'
      ? { ocrConfidence: region.ocrConfidence }
      : {}),
  }));

  return {
    fileName: page.fileName,
    naturalWidth: page.naturalWidth,
    naturalHeight: page.naturalHeight,
    sourceLanguage: undefined,
    ocrEngine: 'mock',
    regions: filterTargetRegions(fallbackRecords, options.regionIds).map((record, index) => ({
      record,
      order: record.order || index + 1,
      label: record.label || `Region ${index + 1}`,
    })),
  };
}

async function loadStoredOcrContext(page: Page, options: OcrRunOptions): Promise<StoredOcrContext> {
  const [pageRecord, regionRecords] = await Promise.all([
    pageRepository.getById(page.id),
    regionRepository.getByPage(page.id),
  ]);

  if (!pageRecord || regionRecords.length === 0) {
    return toFallbackContext(page, options);
  }

  const settings = await ensureProjectDomainDefaults(pageRecord.projectId);

  return {
    fileName: deriveFileName(page, pageRecord.imagePath),
    naturalWidth: pageRecord.width,
    naturalHeight: pageRecord.height,
    sourceLanguage: settings.sourceLanguage === 'auto' ? undefined : settings.sourceLanguage,
    ocrEngine: settings.ocrEngine,
    regions: filterTargetRegions(regionRecords, options.regionIds).map((record, index) => ({
      record,
      order: record.order || index + 1,
      label: record.label || `Region ${index + 1}`,
    })),
  };
}

async function applyBrowserOcrResult(
  context: StoredOcrContext,
  regions: StoredOcrContext['regions'],
  results: OcrPageResult['results'],
) {
  const resultMap = new Map(results.map((result) => [result.regionId, result] as const));
  const updatedAt = Date.now();
  const engineName = toPreviewEngineName(String(context.ocrEngine));

  await Promise.all(
    regions.map(async ({ record }) => {
      const result = resultMap.get(record.id);
      if (!result) {
        return;
      }

      if (!result.skipped && result.text) {
        await regionRepository.update({
          ...record,
          sourceText: result.text,
          ...(context.sourceLanguage ? { sourceLanguage: context.sourceLanguage } : {}),
          status: record.translatedText.trim() ? 'translated' : 'ocr_done',
          ocrStatus: 'done',
          ocrEngine: engineName,
          ocrUpdatedAt: updatedAt,
          ...(typeof result.confidence === 'number'
            ? { ocrConfidence: result.confidence }
            : {}),
        });
        return;
      }

      if (result.reason === 'invalid_bounds' || result.reason === 'no_text') {
        await regionRepository.update({
          ...record,
          ...(context.sourceLanguage ? { sourceLanguage: context.sourceLanguage } : {}),
          ocrStatus: 'failed',
          ocrEngine: engineName,
          ocrUpdatedAt: updatedAt,
          ...(typeof result.confidence === 'number'
            ? { ocrConfidence: result.confidence }
            : {}),
        });
      }
    }),
  );
}

async function runBrowserPreviewOcr(
  page: Page,
  options: OcrRunOptions = {},
  onProgress?: OcrProgressCallback,
): Promise<OcrPageResult> {
  const context = await loadStoredOcrContext(page, options);
  if (context.regions.length === 0) {
    throw new Error('No regions selected for OCR');
  }

  const overwriteExisting = options.overwriteExisting ?? false;
  const engineName = toPreviewEngineName(String(context.ocrEngine));
  const providerPath =
    context.ocrEngine === 'mock' ? [engineName] : [String(context.ocrEngine), engineName];

  if (providerPath.length > 1) {
    console.warn('[ScanForge][OCR] browser preview fallback used', {
      pageId: page.id,
      providerPath,
    });
    useDiagnosticsStore.getState().record({
      scope: 'ocr',
      level: 'warning',
      message: 'Browser OCR preview fallback used',
      detail: providerPath.join(' -> '),
      ...(useProjectStore.getState().meta.localProjectId
        ? { projectId: useProjectStore.getState().meta.localProjectId }
        : {}),
      pageId: page.id,
    });
  }
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
    } else if (!overwriteExisting && region.record.sourceText.trim()) {
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

  await applyBrowserOcrResult(context, context.regions, results);

  return {
    engine: engineName,
    providerPath,
    regionsProcessed: results.length,
    filledCount,
    skippedCount,
    results,
  };
}

export async function runPageOcr(
  page: Page,
  options: OcrRunOptions = {},
  onProgress?: OcrProgressCallback,
): Promise<OcrPageResult> {
  if (!isDesktopRuntime()) {
    onProgress?.(0.2, 'Running browser OCR preview');
    return runBrowserPreviewOcr(page, options, onProgress);
  }

  onProgress?.(0.25, 'Reading OCR input from domain storage');
  onProgress?.(0.55, 'Running Tauri OCR backend');
  return invoke<OcrPageResult>('run_page_ocr', {
    pageId: page.id,
    regionIds: options.regionIds,
    overwriteExisting: options.overwriteExisting ?? false,
  });
}
