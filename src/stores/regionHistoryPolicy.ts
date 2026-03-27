import type { Region } from '../types';
import type { HistoryCaptureOptions } from './useHistoryStore';

const TEXT_FIELDS = new Set(['label', 'sourceText', 'translatedText', 'notes']);
const GEOMETRY_FIELDS = new Set(['x', 'y', 'width', 'height', 'rotation']);

export function resolveRegionHistoryCaptureOptions(
  pageId: string,
  regionId: string,
  patch: Partial<Region>,
): HistoryCaptureOptions | undefined {
  const keys = Object.keys(patch);
  if (keys.length === 0) {
    return undefined;
  }

  if (keys.every((key) => TEXT_FIELDS.has(key))) {
    return {
      coalesceKey: `region-text:${pageId}:${regionId}`,
      windowMs: 900,
    };
  }

  if (keys.every((key) => GEOMETRY_FIELDS.has(key))) {
    return {
      coalesceKey: `region-geometry:${pageId}:${regionId}`,
      windowMs: 500,
    };
  }

  return undefined;
}
