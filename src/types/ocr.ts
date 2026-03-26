import type { RegionKind } from './region';

export interface OcrRegionInput {
  id: string;
  label: string;
  kind: RegionKind;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceText: string;
  locked: boolean;
}

export interface OcrPagePayload {
  pageId: string;
  fileName: string;
  imageDataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  regions: OcrRegionInput[];
}

export interface OcrRegionResult {
  regionId: string;
  text: string | null;
  skipped: boolean;
  reason: string | null;
}

export interface OcrPageResult {
  engine: string;
  regionsProcessed: number;
  filledCount: number;
  skippedCount: number;
  results: OcrRegionResult[];
}
