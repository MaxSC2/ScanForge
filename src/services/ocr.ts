import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { pageRepository } from '../repositories/pageRepository';
import { ensureProjectDomainDefaults } from '../repositories/projectDefaults';
import { regionRepository } from '../repositories/regionRepository';
import { useDiagnosticsStore } from '../stores/useDiagnosticsStore';
import { useProjectStore } from '../stores/useProjectStore';
import type {
  OcrEngineId,
  OcrErrorDetail,
  OcrPageResult,
  OcrProgressCallback,
  OcrProgressEvent,
  OcrRegionResult,
  OcrRunOptions,
  OcrRunOptionsWithAbort,
  Page,
  RegionRecord,
} from '../types';
import { isDesktopRuntime } from '../utils/runtime';

export type { OcrRunOptions, OcrRunOptionsWithAbort };

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

function emitError(
  pageId: string,
  detail: OcrErrorDetail,
) {
  console.error(`[ScanForge][OCR] ${detail.provider}: ${detail.message}`);
  useDiagnosticsStore.getState().record({
    scope: 'ocr',
    level: 'error',
    message: `[${detail.provider}] ${detail.message}`,
    detail: `recoverable: ${detail.recoverable}`,
    ...(useProjectStore.getState().meta.localProjectId
      ? { projectId: useProjectStore.getState().meta.localProjectId }
      : {}),
    pageId,
  });
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('OCR cancelled', 'AbortError');
  }
}

function toFallbackContext(page: Page, options: OcrRunOptions): StoredOcrContext {
  const fallbackRecords: RegionRecord[] = page.regions.map((region, index) => ({
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
    ...(typeof region.ocrOverwriteEnabled === 'boolean'
      ? { ocrOverwriteEnabled: region.ocrOverwriteEnabled }
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

async function loadStoredOcrContext(page: Page, options: OcrRunOptions, signal?: AbortSignal): Promise<StoredOcrContext> {
  assertNotAborted(signal);

  const [pageRecord, regionRecords] = await Promise.all([
    pageRepository.getById(page.id),
    regionRepository.getByPage(page.id),
  ]);

  assertNotAborted(signal);

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

export function computeAverageConfidence(results: OcrRegionResult[]): number | undefined {
  const withConfidence = results.filter(
    (r): r is OcrRegionResult & { confidence: number } =>
      !r.skipped && typeof r.confidence === 'number',
  );
  if (withConfidence.length === 0) return undefined;
  const sum = withConfidence.reduce((acc, r) => acc + r.confidence, 0);
  return Math.round((sum / withConfidence.length) * 100) / 100;
}

async function applyBrowserOcrResult(
  context: StoredOcrContext,
  regions: StoredOcrContext['regions'],
  results: OcrPageResult['results'],
  signal?: AbortSignal,
) {
  const resultMap = new Map(results.map((result) => [result.regionId, result] as const));
  const updatedAt = Date.now();
  const engineName = toPreviewEngineName(String(context.ocrEngine));

  await Promise.all(
    regions.map(async ({ record }) => {
      assertNotAborted(signal);

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
  options: OcrRunOptionsWithAbort = {},
  onProgress?: OcrProgressCallback,
): Promise<OcrPageResult> {
  const { signal, ...runOptions } = options;
  assertNotAborted(signal);

  const context = await loadStoredOcrContext(page, runOptions, signal);
  if (context.regions.length === 0) {
    throw new Error('No regions selected for OCR');
  }

  const overwriteExisting = runOptions.overwriteExisting ?? false;
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
  const results: OcrRegionResult[] = [];

  for (let index = 0; index < context.regions.length; index += 1) {
    assertNotAborted(signal);
    const region = context.regions[index];
    await new Promise((resolve) => window.setTimeout(resolve, 90));

    assertNotAborted(signal);

    const regionOverwrite = region.record.ocrOverwriteEnabled ?? false;
    if (region.record.locked) {
      results.push({
        regionId: region.record.id,
        text: null,
        skipped: true,
        reason: 'locked',
      });
    } else if (!(overwriteExisting || regionOverwrite) && region.record.sourceText.trim()) {
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
  const failedCount = results.filter((item) => item.reason === 'invalid_bounds' || item.reason === 'no_text').length;
  const averageConfidence = computeAverageConfidence(results);

  await applyBrowserOcrResult(context, context.regions, results, signal);

  return {
    engine: engineName,
    providerPath,
    regionsProcessed: results.length,
    filledCount,
    skippedCount,
    failedCount,
    results,
    averageConfidence,
  };
}

export async function runPageOcr(
  page: Page,
  options: OcrRunOptionsWithAbort = {},
  onProgress?: OcrProgressCallback,
): Promise<OcrPageResult> {
  const { signal } = options;

  if (signal?.aborted) {
    throw new DOMException('OCR cancelled before start', 'AbortError');
  }

  if (!isDesktopRuntime()) {
    onProgress?.(0.2, 'Running browser OCR preview');
    try {
      return await runBrowserPreviewOcr(page, options, onProgress);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      const detail: OcrErrorDetail = {
        provider: 'browser-preview',
        message: error instanceof Error ? error.message : 'Unknown browser OCR error',
        recoverable: true,
      };
      emitError(page.id, detail);
      throw detail;
    }
  }

  onProgress?.(0.05, 'Starting OCR');

  let unlisten: UnlistenFn | undefined;
  try {
    unlisten = await listen<OcrProgressEvent>('ocr-progress', (event) => {
      onProgress?.(event.payload.progress, event.payload.message);
    });

    onProgress?.(0.25, 'Running Tauri OCR backend');

    const result = await invoke<OcrPageResult>('run_page_ocr', {
      pageId: page.id,
      regionIds: options.regionIds,
      overwriteExisting: options.overwriteExisting ?? false,
    });

    return {
      ...result,
      averageConfidence: computeAverageConfidence(result.results ?? []),
      failedCount: result.results?.filter(
        (r) => r.reason === 'invalid_bounds' || r.reason === 'no_text',
      ).length,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    const message = typeof error === 'string' ? error : error instanceof Error ? error.message : 'OCR backend error';
    const detail: OcrErrorDetail = {
      provider: 'tauri-backend',
      message,
      recoverable: true,
    };
    emitError(page.id, detail);
    throw detail;
  } finally {
    unlisten?.();
  }
}
