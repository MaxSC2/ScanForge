import type { InpaintRegion } from '../../types';

function inpaintImage(imageData: ImageData, regions: InpaintRegion[]): ImageData {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data);

  for (const region of regions) {
    const rx = Math.max(0, Math.floor(region.x));
    const ry = Math.max(0, Math.floor(region.y));
    const rw = Math.min(width - rx, Math.ceil(region.width));
    const rh = Math.min(height - ry, Math.ceil(region.height));

    if (rw < 2 || rh < 2) continue;

    const samples: Array<[number, number, number, number]> = [];
    const edgeSize = 2;

    for (let x = rx; x < rx + rw; x++) {
      for (let dy = 0; dy < edgeSize && ry + dy < height; dy++) {
        const idx = ((ry + dy) * width + x) * 4;
        samples.push([data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]);
      }
      for (let dy = 0; dy < edgeSize && ry + rh - 1 - dy >= 0; dy++) {
        const idx = ((ry + rh - 1 - dy) * width + x) * 4;
        samples.push([data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]);
      }
    }
    for (let y = ry; y < ry + rh; y++) {
      for (let dx = 0; dx < edgeSize && rx + dx < width; dx++) {
        const idx = (y * width + (rx + dx)) * 4;
        samples.push([data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]);
      }
      for (let dx = 0; dx < edgeSize && rx + rw - 1 - dx >= 0; dx++) {
        const idx = (y * width + (rx + rw - 1 - dx)) * 4;
        samples.push([data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]);
      }
    }

    if (samples.length === 0) continue;

    let avgR = 0, avgG = 0, avgB = 0, avgA = 0;
    for (const [r, g, b, a] of samples) {
      avgR += r; avgG += g; avgB += b; avgA += a;
    }
    avgR = avgR / samples.length | 0;
    avgG = avgG / samples.length | 0;
    avgB = avgB / samples.length | 0;
    avgA = avgA / samples.length | 0;

    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        const idx = (y * width + x) * 4;
        out[idx] = avgR;
        out[idx + 1] = avgG;
        out[idx + 2] = avgB;
        out[idx + 3] = avgA;
      }
    }

    const blurPass = new Uint8ClampedArray(out);
    for (let y = Math.max(1, ry - 1); y < Math.min(height - 1, ry + rh + 1); y++) {
      for (let x = Math.max(1, rx - 1); x < Math.min(width - 1, rx + rw + 1); x++) {
        let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            sr += out[idx];
            sg += out[idx + 1];
            sb += out[idx + 2];
            sa += out[idx + 3];
            n++;
          }
        }
        const idx = (y * width + x) * 4;
        blurPass[idx] = sr / n | 0;
        blurPass[idx + 1] = sg / n | 0;
        blurPass[idx + 2] = sb / n | 0;
        blurPass[idx + 3] = sa / n | 0;
      }
    }

    for (let y = Math.max(0, ry - 1); y < Math.min(height, ry + rh + 1); y++) {
      for (let x = Math.max(0, rx - 1); x < Math.min(width, rx + rw + 1); x++) {
        const inside = x >= rx && x < rx + rw && y >= ry && y < ry + rh;
        const onEdge = !inside || x === rx || x === rx + rw - 1 || y === ry || y === ry + rh - 1;
        if (onEdge) {
          const idx = (y * width + x) * 4;
          out[idx] = blurPass[idx];
          out[idx + 1] = blurPass[idx + 1];
          out[idx + 2] = blurPass[idx + 2];
          out[idx + 3] = blurPass[idx + 3];
        }
      }
    }
  }

  return new ImageData(out, width, height);
}

export function inpaintBasicCanvas(
  source: HTMLCanvasElement | HTMLImageElement,
  regions: InpaintRegion[],
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width || (source as HTMLImageElement).naturalWidth;
  canvas.height = source.height || (source as HTMLImageElement).naturalHeight;
  const ctx = canvas.getContext('2d')!;

  if (source instanceof HTMLCanvasElement) {
    ctx.drawImage(source, 0, 0);
  } else {
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const inpainted = inpaintImage(imageData, regions);
  ctx.putImageData(inpainted, 0, 0);

  return canvas;
}
