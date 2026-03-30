export interface RenderedExportResult {
  saved: boolean;
  canceled: boolean;
  suggestedName: string;
  translatedRegions: number;
  renderedRegions: number;
  outputSha256?: string;
  outputPath?: string;
}
