import type { Region } from '../../types';

export interface CanvasViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CanvasPointerPosition {
  x: number;
  y: number;
}

interface ViewportArgs {
  zoom: number;
  stagePosition: { x: number; y: number };
  canvasWidth: number;
  canvasHeight: number;
  padding?: number;
}

interface LabelVisibilityArgs {
  labelsVisible: boolean;
  zoom: number;
  isSelected: boolean;
}

const VIEWPORT_PADDING = 120;
const LABEL_VISIBILITY_MIN_ZOOM = 0.55;
const CANVAS_ZOOM_MIN = 0.1;
const CANVAS_ZOOM_MAX = 5;
const WHEEL_ZOOM_FACTOR = 1.08;

export function getCanvasViewportBounds({
  zoom,
  stagePosition,
  canvasWidth,
  canvasHeight,
  padding = VIEWPORT_PADDING,
}: ViewportArgs): CanvasViewportBounds {
  const safeZoom = zoom > 0 ? zoom : 1;
  const left = (-stagePosition.x / safeZoom) - padding;
  const top = (-stagePosition.y / safeZoom) - padding;
  const right = left + (canvasWidth / safeZoom) + padding * 2;
  const bottom = top + (canvasHeight / safeZoom) + padding * 2;

  return { left, top, right, bottom };
}

export function isRegionWithinViewport(region: Region, viewport: CanvasViewportBounds) {
  if (!region.visible) {
    return false;
  }

  return !(
    region.x + region.width < viewport.left ||
    region.y + region.height < viewport.top ||
    region.x > viewport.right ||
    region.y > viewport.bottom
  );
}

export function shouldRenderRegionLabel({
  labelsVisible,
  zoom,
  isSelected,
}: LabelVisibilityArgs) {
  if (!labelsVisible) {
    return false;
  }

  return isSelected || zoom >= LABEL_VISIBILITY_MIN_ZOOM;
}

export function getWheelViewportTransform({
  zoom,
  stagePosition,
  pointer,
  deltaY,
}: {
  zoom: number;
  stagePosition: CanvasPointerPosition;
  pointer: CanvasPointerPosition;
  deltaY: number;
}) {
  const direction = deltaY < 0 ? 1 : -1;
  const nextZoom = direction > 0 ? zoom * WHEEL_ZOOM_FACTOR : zoom / WHEEL_ZOOM_FACTOR;
  const clampedZoom = Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, nextZoom));

  const pointerInPageSpace = {
    x: (pointer.x - stagePosition.x) / zoom,
    y: (pointer.y - stagePosition.y) / zoom,
  };

  return {
    zoom: clampedZoom,
    stagePosition: {
      x: pointer.x - pointerInPageSpace.x * clampedZoom,
      y: pointer.y - pointerInPageSpace.y * clampedZoom,
    },
  };
}
