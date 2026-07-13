export interface EdgeGuides {
  horizontal: number[];
  vertical: number[];
}

export function detectEdgeGuides(
  imageUrl: string,
  width: number,
  height: number,
): Promise<EdgeGuides> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const gray = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const p = i * 4;
        gray[i] = Math.round(data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114);
      }

      const step = 4;
      const hThreshold = 40;
      const linesH: Set<number> = new Set();
      const linesV: Set<number> = new Set();

      for (let y = step; y < height - step; y += step) {
        for (let x = step; x < width - step; x += step) {
          const gx = Math.abs(gray[y * width + x + 1] - gray[y * width + x - 1]);
          const gy = Math.abs(gray[(y + 1) * width + x] - gray[(y - 1) * width + x]);
          if (gx > hThreshold) linesV.add(x);
          if (gy > hThreshold) linesH.add(y);
        }
      }

      const toSorted = (s: Set<number>) => Array.from(s).sort((a, b) => a - b);
      resolve({ horizontal: toSorted(linesH), vertical: toSorted(linesV) });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}
