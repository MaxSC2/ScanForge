import type { InpaintRegion } from '../../types';

const DEFAULT_IOPAINT_ENDPOINT = 'http://localhost:8080';

function getEndpoint(): string {
  return localStorage.getItem('scanforge.iopaint.endpoint') || DEFAULT_IOPAINT_ENDPOINT;
}

async function createMask(
  width: number,
  height: number,
  regions: InpaintRegion[],
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'white';
  for (const region of regions) {
    ctx.fillRect(
      Math.floor(region.x),
      Math.floor(region.y),
      Math.ceil(region.width),
      Math.ceil(region.height),
    );
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) {
    throw new Error('Failed to create mask for IOPaint');
  }
  return blob;
}

interface IopaintResponse {
  image: string;
}

export async function inpaintIopaintCanvas(
  source: HTMLCanvasElement | HTMLImageElement,
  regions: InpaintRegion[],
): Promise<HTMLCanvasElement> {
  const width = source.width || (source as HTMLImageElement).naturalWidth;
  const height = source.height || (source as HTMLImageElement).naturalHeight;

  const imageCanvas = document.createElement('canvas');
  imageCanvas.width = width;
  imageCanvas.height = height;
  const imageCtx = imageCanvas.getContext('2d')!;
  if (source instanceof HTMLCanvasElement) {
    imageCtx.drawImage(source, 0, 0);
  } else {
    imageCtx.drawImage(source, 0, 0, width, height);
  }

  const imageBlob = await new Promise<Blob | null>((resolve) =>
    imageCanvas.toBlob(resolve, 'image/png'),
  );
  if (!imageBlob) {
    throw new Error('Failed to create image blob for IOPaint');
  }

  const maskBlob = await createMask(width, height, regions);

  const formData = new FormData();
  formData.append('image', imageBlob, 'input.png');
  formData.append('mask', maskBlob, 'mask.png');

  const endpoint = getEndpoint();
  const response = await fetch(`${endpoint}/inpaint`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`IOPaint server error: ${response.status} ${response.statusText}`);
  }

  const result: IopaintResponse = await response.json();

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const resultCtx = resultCanvas.getContext('2d')!;

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load IOPaint result image'));
    img.src = `data:image/png;base64,${result.image}`;
  });

  resultCtx.drawImage(img, 0, 0, width, height);
  return resultCanvas;
}
