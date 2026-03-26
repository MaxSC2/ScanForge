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
    sourceText: region.sourceText,
    translatedText: region.translatedText,
    status: region.status,
    locked: region.locked,
    visible: region.visible,
    ...(typeof region.ocrConfidence === 'number'
      ? { ocrConfidence: region.ocrConfidence }
      : {}),
  };
}

function sortRegionRecords(records: RegionRecord[], fallbackMap: Map<string, Region>) {
  return [...records].sort((left, right) => {
    const leftOrder = fallbackMap.get(left.id)?.order;
    const rightOrder = fallbackMap.get(right.id)?.order;

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
    label: fallback?.label ?? `Region ${index + 1}`,
    x: record.x,
    y: record.y,
    width: record.width,
    height: record.height,
    rotation: record.rotation,
    sourceText: record.sourceText,
    translatedText: record.translatedText,
    status: record.status,
    kind: fallback?.kind ?? 'speech',
    order: fallback?.order ?? index + 1,
    notes: fallback?.notes ?? '',
    locked: record.locked,
    visible: record.visible,
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
