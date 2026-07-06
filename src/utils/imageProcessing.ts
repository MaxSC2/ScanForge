export interface ImageProcessOptions {
  brightness?: number;
  contrast?: number;
  denoise?: boolean;
  deskew?: number;
  sharpen?: number;
  threshold?: number | null;
  grayscale?: boolean;
}

const DEFAULT_OPTIONS: ImageProcessOptions = {
  brightness: 0,
  contrast: 0,
  denoise: false,
  deskew: 0,
  sharpen: 0,
  threshold: null,
  grayscale: false,
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url.slice(0, 50)}...`));
    img.src = url;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function processImage(
  imageUrl: string,
  options: ImageProcessOptions,
): Promise<string> {
  return process(imageUrl, options);
}

export async function previewProcessedImage(
  imageUrl: string,
  options: ImageProcessOptions,
): Promise<string> {
  return process(imageUrl, options, 400);
}

async function process(
  imageUrl: string,
  options: ImageProcessOptions,
  maxDimension?: number,
): Promise<string> {
  const img = await loadImage(imageUrl);
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let srcWidth = img.naturalWidth;
  let srcHeight = img.naturalHeight;

  if (maxDimension && maxDimension > 0) {
    const scale = Math.min(maxDimension / srcWidth, maxDimension / srcHeight, 1);
    srcWidth = Math.round(srcWidth * scale);
    srcHeight = Math.round(srcHeight * scale);
  }

  const bbox = computeRotatedBbox(srcWidth, srcHeight, opts.deskew ?? 0);
  const canvas = document.createElement('canvas');
  canvas.width = bbox.width;
  canvas.height = bbox.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const deskew = opts.deskew ?? 0;
  if (deskew !== 0) {
    const cx = bbox.width / 2;
    const cy = bbox.height / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((deskew * Math.PI) / 180);
    ctx.drawImage(img, -srcWidth / 2, -srcHeight / 2, srcWidth, srcHeight);
    ctx.restore();
  } else {
    ctx.drawImage(img, 0, 0, srcWidth, srcHeight);
  }

  let imageData = ctx.getImageData(0, 0, bbox.width, bbox.height);
  const data = imageData.data;

  const hasBrightness = opts.brightness !== 0;
  const hasContrast = opts.contrast !== 0;
  const doGrayscale = opts.grayscale === true;
  const doThreshold = opts.threshold !== null && opts.threshold !== undefined;
  const doDenoise = opts.denoise === true;
  const doSharpen = opts.sharpen !== undefined && opts.sharpen > 0;

  if (hasBrightness || hasContrast || doGrayscale || doThreshold) {
    const contrastFactor = hasContrast
      ? (259 * ((opts.contrast ?? 0) + 255)) / (255 * (259 - (opts.contrast ?? 0)))
      : 1;
    const brightness = opts.brightness ?? 0;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (hasContrast) {
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;
      }

      if (hasBrightness) {
        r += brightness;
        g += brightness;
        b += brightness;
      }

      if (doGrayscale || doThreshold) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        if (doThreshold) {
          const val = gray > (opts.threshold ?? 128) ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        } else {
          data[i] = clamp(Math.round(gray), 0, 255);
          data[i + 1] = clamp(Math.round(gray), 0, 255);
          data[i + 2] = clamp(Math.round(gray), 0, 255);
        }
      } else {
        data[i] = clamp(Math.round(r), 0, 255);
        data[i + 1] = clamp(Math.round(g), 0, 255);
        data[i + 2] = clamp(Math.round(b), 0, 255);
      }
    }
  }

  if (doDenoise) {
    applyBoxBlur(imageData, bbox.width, bbox.height);
  }

  if (doSharpen) {
    applySharpen(imageData, bbox.width, bbox.height, opts.sharpen ?? 0);
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas toBlob failed'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

function computeRotatedBbox(
  w: number,
  h: number,
  angleDeg: number,
): { width: number; height: number } {
  const rad = (Math.abs(angleDeg) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: Math.max(1, Math.round(w * cos + h * sin)),
    height: Math.max(1, Math.round(w * sin + h * cos)),
  };
}

function applyBoxBlur(imageData: ImageData, w: number, h: number): void {
  const src = new Uint8ClampedArray(imageData.data);
  const dst = imageData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const sx = x + dx;
          const sy = y + dy;
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            const si = (sy * w + sx) * 4;
            r += src[si];
            g += src[si + 1];
            b += src[si + 2];
            count++;
          }
        }
      }
      const di = (y * w + x) * 4;
      dst[di] = Math.round(r / count);
      dst[di + 1] = Math.round(g / count);
      dst[di + 2] = Math.round(b / count);
    }
  }
}

function applySharpen(imageData: ImageData, w: number, h: number, amount: number): void {
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const src = new Uint8ClampedArray(imageData.data);
  const dst = imageData.data;
  const strength = amount / 50;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      let ki = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const sx = x + dx;
          const sy = y + dy;
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            const si = (sy * w + sx) * 4;
            const k = kernel[ki];
            r += src[si] * k;
            g += src[si + 1] * k;
            b += src[si + 2] * k;
          } else {
            r += 0;
            g += 0;
            b += 0;
          }
          ki++;
        }
      }
      const di = (y * w + x) * 4;
      const origR = src[di];
      const origG = src[di + 1];
      const origB = src[di + 2];
      dst[di] = clamp(Math.round(origR + (r - origR) * strength), 0, 255);
      dst[di + 1] = clamp(Math.round(origG + (g - origG) * strength), 0, 255);
      dst[di + 2] = clamp(Math.round(origB + (b - origB) * strength), 0, 255);
    }
  }
}
