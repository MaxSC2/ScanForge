import { createDefaultTextStyle, type RegionRecord, type TextStyleRecord } from '../../types';

export function buildRenderedPngName(fileName: string) {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '');
  return `${base}-rendered.png`;
}

export function resolveTextStyle(
  region: RegionRecord,
  styles: TextStyleRecord[],
  projectId: string,
  defaultTextStyleId?: string,
) {
  return (
    styles.find((style) => style.id === region.textStyleId) ??
    styles.find((style) => style.id === defaultTextStyleId) ??
    createDefaultTextStyle(projectId)
  );
}
