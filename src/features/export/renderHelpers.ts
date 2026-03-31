import { createDefaultTextStyle, type RegionRecord, type TextStyleRecord } from '../../types';

export function buildRenderedPngName(fileName: string) {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '');
  return `${base}-rendered.png`;
}

export function ensurePngOutputPath(path: string) {
  const trimmed = path.trim();
  const lastSeparator = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  const directory = lastSeparator >= 0 ? trimmed.slice(0, lastSeparator + 1) : '';
  const fileName = lastSeparator >= 0 ? trimmed.slice(lastSeparator + 1) : trimmed;
  const extensionIndex = fileName.lastIndexOf('.');

  if (extensionIndex <= 0) {
    return `${trimmed}.png`;
  }

  if (fileName.slice(extensionIndex + 1).toLowerCase() === 'png') {
    return trimmed;
  }

  return `${directory}${fileName.slice(0, extensionIndex)}.png`;
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

export async function computeSha256Hex(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function shortenHash(hash: string, length = 8) {
  return hash.slice(0, length);
}
