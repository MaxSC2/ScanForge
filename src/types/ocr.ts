export interface OcrRegionResult {
  regionId: string;
  text: string | null;
  confidence?: number | null;
  skipped: boolean;
  reason: string | null;
}

export interface OcrPageResult {
  engine: string;
  providerPath?: string[];
  regionsProcessed: number;
  filledCount: number;
  skippedCount: number;
  failedCount?: number;
  results: OcrRegionResult[];
  averageConfidence?: number;
}

export interface OcrErrorDetail {
  provider: string;
  message: string;
  recoverable: boolean;
}

export interface OcrAbortOptions {
  signal?: AbortSignal;
}

export interface OcrRunOptions {
  regionIds?: string[];
  overwriteExisting?: boolean;
}

export interface OcrRunOptionsWithAbort extends OcrRunOptions, OcrAbortOptions {}

export type OcrProgressCallback = (progress: number, message: string) => void;

export interface OcrProgressEvent {
  pageId: string;
  regionId?: string | null;
  progress: number;
  message: string;
}
