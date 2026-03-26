import type { StitchDirection, StitchOptions } from '../types';

export interface StitchSourceSize {
  width: number;
  height: number;
}

export interface StitchRenderPlan {
  width: number;
  height: number;
  scale: number;
}

export interface StitchPreviewResult {
  width: number;
  height: number;
  pageCount: number;
  minScale: number;
  maxScale: number;
  targetCrossAxis: number | null;
  pixelCount: number;
  estimatedPngMiB: {
    low: number;
    high: number;
  };
  safety: {
    maxDimensionExceeded: boolean;
    maxAreaExceeded: boolean;
  };
}

export interface SafeStitchSuggestion {
  patch: Partial<StitchOptions>;
  targetCrossAxis: number;
}

/**
 * Browser canvas limits differ by engine/GPU.
 * These values are conservative guardrails that catch common failure cases.
 */
const SAFE_MAX_CANVAS_DIMENSION = 32_767;
const SAFE_MAX_CANVAS_AREA = 268_435_456; // 16,384 x 16,384

function estimatePngMiB(pixelCount: number): { low: number; high: number } {
  // PNG size depends on content entropy. Typical manga pages compress well,
  // so we provide a range using two rough bits-per-pixel assumptions.
  const lowBytes = (pixelCount * 1.6) / 8;
  const highBytes = (pixelCount * 4.8) / 8;
  const toMiB = (bytes: number) => Number((bytes / (1024 * 1024)).toFixed(2));
  return {
    low: toMiB(lowBytes),
    high: toMiB(highBytes),
  };
}

export function buildStitchRenderPlans(
  sourceSizes: StitchSourceSize[],
  stitch: StitchOptions,
): StitchRenderPlan[] {
  if (sourceSizes.length === 0) return [];

  if (stitch.scaleMode === 'original') {
    return sourceSizes.map((source) => ({
      width: source.width,
      height: source.height,
      scale: 1,
    }));
  }

  const crossSizes =
    stitch.direction === 'vertical'
      ? sourceSizes.map((source) => source.width)
      : sourceSizes.map((source) => source.height);
  const maxCrossAxis = Math.max(...crossSizes);
  const targetCrossAxis =
    stitch.crossAxisSize && stitch.crossAxisSize > 0
      ? Math.floor(stitch.crossAxisSize)
      : maxCrossAxis;

  return sourceSizes.map((source) => {
    const currentCrossAxis = stitch.direction === 'vertical' ? source.width : source.height;
    const scaleRaw = targetCrossAxis / currentCrossAxis;
    const scale = stitch.allowUpscale ? scaleRaw : Math.min(scaleRaw, 1);
    return {
      width: Math.max(1, Math.round(source.width * scale)),
      height: Math.max(1, Math.round(source.height * scale)),
      scale,
    };
  });
}

export function computeStitchOutputSize(
  plans: StitchRenderPlan[],
  direction: StitchDirection,
  gap: number,
): { width: number; height: number } {
  if (plans.length === 0) return { width: 0, height: 0 };
  const safeGap = Math.max(0, Math.floor(gap));

  const width =
    direction === 'vertical'
      ? Math.max(...plans.map((plan) => plan.width))
      : plans.reduce((sum, plan) => sum + plan.width, 0) + safeGap * (plans.length - 1);
  const height =
    direction === 'vertical'
      ? plans.reduce((sum, plan) => sum + plan.height, 0) + safeGap * (plans.length - 1)
      : Math.max(...plans.map((plan) => plan.height));

  return { width, height };
}

export function getStitchPreview(
  sourceSizes: StitchSourceSize[],
  stitch: StitchOptions,
): StitchPreviewResult | null {
  if (sourceSizes.length === 0) return null;

  const plans = buildStitchRenderPlans(sourceSizes, stitch);
  const output = computeStitchOutputSize(plans, stitch.direction, stitch.gap);
  const scales = plans.map((plan) => plan.scale);
  const minScale = Math.min(...scales);
  const maxScale = Math.max(...scales);
  const pixelCount = output.width * output.height;

  let targetCrossAxis: number | null = null;
  if (stitch.scaleMode === 'normalize-cross-axis') {
    const crossSizes =
      stitch.direction === 'vertical'
        ? sourceSizes.map((source) => source.width)
        : sourceSizes.map((source) => source.height);
    const maxCrossAxis = Math.max(...crossSizes);
    targetCrossAxis =
      stitch.crossAxisSize && stitch.crossAxisSize > 0
        ? Math.floor(stitch.crossAxisSize)
        : maxCrossAxis;
  }

  return {
    width: output.width,
    height: output.height,
    pageCount: sourceSizes.length,
    minScale,
    maxScale,
    targetCrossAxis,
    pixelCount,
    estimatedPngMiB: estimatePngMiB(pixelCount),
    safety: {
      maxDimensionExceeded:
        output.width > SAFE_MAX_CANVAS_DIMENSION || output.height > SAFE_MAX_CANVAS_DIMENSION,
      maxAreaExceeded: pixelCount > SAFE_MAX_CANVAS_AREA,
    },
  };
}

export function suggestSafeStitch(
  sourceSizes: StitchSourceSize[],
  stitch: StitchOptions,
): SafeStitchSuggestion | null {
  if (sourceSizes.length < 2) return null;

  const baseOptions: StitchOptions = {
    ...stitch,
    scaleMode: 'normalize-cross-axis',
  };
  const current = getStitchPreview(sourceSizes, baseOptions);
  if (!current) return null;

  const hasRisk = current.safety.maxAreaExceeded || current.safety.maxDimensionExceeded;
  if (!hasRisk) return null;

  const crossSizes =
    baseOptions.direction === 'vertical'
      ? sourceSizes.map((source) => source.width)
      : sourceSizes.map((source) => source.height);
  const defaultMaxCross = Math.max(...crossSizes);
  const initialTarget =
    baseOptions.crossAxisSize && baseOptions.crossAxisSize > 0
      ? Math.floor(baseOptions.crossAxisSize)
      : defaultMaxCross;

  // Find the largest cross-axis value that still produces a safe output.
  let low = 1;
  let high = Math.max(1, initialTarget);
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const probe = getStitchPreview(sourceSizes, {
      ...baseOptions,
      crossAxisSize: mid,
    });
    const safe =
      !!probe && !probe.safety.maxDimensionExceeded && !probe.safety.maxAreaExceeded;

    if (safe) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best < 1) return null;

  return {
    patch: {
      scaleMode: 'normalize-cross-axis',
      crossAxisSize: best,
    },
    targetCrossAxis: best,
  };
}