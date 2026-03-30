export type RenderedExportFailureReason = 'save_failed' | 'render_failed';

export interface RenderedExportResult {
  saved: boolean;
  canceled: boolean;
  suggestedName: string;
  translatedRegions: number;
  renderedRegions: number;
  outputSha256?: string;
  outputPath?: string;
}

export interface RenderedExportFailure {
  reason: RenderedExportFailureReason;
  translatedRegions?: number;
  outputPath?: string;
}
