import type { Page, Region, RegionRecord } from '../types';
import { normalizeRegion } from '../types/region';
import { regionRepository } from './regionRepository';

function toRegionRecord(pageId: string, region: Region): RegionRecord {
  return {
    id: region.id,
    pageId,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    rotation: region.rotation,
    label: region.label,
    kind: region.kind,
    order: region.order,
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
    ...(region.translationProvider
      ? { translationProvider: region.translationProvider }
      : {}),
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
  };
}

function sortRegionRecords(records: RegionRecord[], fallbackMap: Map<string, Region>) {
  return [...records].sort((left, right) => {
    const leftOrder = left.order || fallbackMap.get(left.id)?.order;
    const rightOrder = right.order || fallbackMap.get(right.id)?.order;

    if (typeof leftOrder === 'number' || typeof rightOrder === 'number') {
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
    }

    if (left.y !== right.y) {
      return left.y - right.y;
    }

    if (left.x !== right.x) {
      return left.x - right.x;
    }

    return left.id.localeCompare(right.id);
  });
}

function mergeRegionRecord(record: RegionRecord, fallback: Region | undefined, index: number): Region {
  return normalizeRegion({
    id: record.id,
    label: record.label || fallback?.label || `Region ${index + 1}`,
    x: record.x,
    y: record.y,
    width: record.width,
    height: record.height,
    rotation: record.rotation,
    orientation: record.orientation,
    sourceText: record.sourceText,
    sourceLanguage: record.sourceLanguage,
    translatedText: record.translatedText,
    status: record.status,
    ocrStatus: record.ocrStatus,
    ocrEngine: record.ocrEngine,
    ocrUpdatedAt: record.ocrUpdatedAt,
    targetLanguage: record.targetLanguage,
    translationStatus: record.translationStatus,
    translationProvider: record.translationProvider,
    translationUpdatedAt: record.translationUpdatedAt,
    kind: record.kind || fallback?.kind || 'speech',
    order: record.order || fallback?.order || index + 1,
    notes: record.notes ?? fallback?.notes ?? '',
    locked: record.locked,
    visible: record.visible,
    textStyleId: record.textStyleId ?? fallback?.textStyleId,
    ocrConfidence: record.ocrConfidence,
  });
}

export async function mergeRegionsForPage(page: Page) {
  const fallbackRegions = page.regions.map((region) => normalizeRegion(region));
  const records = await regionRepository.getByPage(page.id);

  if (records.length === 0) {
    return {
      ...page,
      regions: fallbackRegions,
    } satisfies Page;
  }

  const fallbackMap = new Map(fallbackRegions.map((region) => [region.id, region] as const));
  const mergedRegions = sortRegionRecords(records, fallbackMap).map((record, index) =>
    mergeRegionRecord(record, fallbackMap.get(record.id), index),
  );

  return {
    ...page,
    regions: mergedRegions,
  } satisfies Page;
}

export async function syncRegionsForPages(pages: Page[]) {
  await Promise.all(
    pages.map(async (page) => {
      const existingRegions = await regionRepository.getByPage(page.id);
      const incomingIds = new Set(page.regions.map((region) => region.id));

      await Promise.all(
        existingRegions
          .filter((region) => !incomingIds.has(region.id))
          .map((region) => regionRepository.delete(region.id)),
      );

      await Promise.all(
        page.regions.map((region) =>
          regionRepository.update(toRegionRecord(page.id, normalizeRegion(region))),
        ),
      );
    }),
  );
}

export async function mergeRegionsWithRepository(pages: Page[]) {
  return Promise.all(pages.map((page) => mergeRegionsForPage(page)));
}
