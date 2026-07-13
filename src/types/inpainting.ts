import type { InpaintingProviderId } from './projectSettings';

export interface InpaintRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InpaintPageResult {
  provider: InpaintingProviderId;
  regionsProcessed: number;
}
