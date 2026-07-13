import type { InpaintingProviderId, InpaintRegion } from '../types';
import { inpaintBasicCanvas } from './inpainting/basic';
import { inpaintIopaintCanvas } from './inpainting/iopaint';

export type { InpaintRegion };

export function inpaintCanvas(
  source: HTMLCanvasElement | HTMLImageElement,
  regions: InpaintRegion[],
): HTMLCanvasElement {
  return inpaintBasicCanvas(source, regions);
}

export async function inpaintCanvasWithProvider(
  source: HTMLCanvasElement | HTMLImageElement,
  regions: InpaintRegion[],
  provider: InpaintingProviderId,
): Promise<HTMLCanvasElement> {
  switch (provider) {
    case 'iopaint':
      return inpaintIopaintCanvas(source, regions);
    case 'basic':
    default:
      return inpaintBasicCanvas(source, regions);
  }
}
