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

interface MinimapViewportArgs {
  zoom: number;
  stagePosition: { x: number; y: number };
  imageWidth: number;
  imageHeight: number;
  stageWidth: number;
  stageHeight: number;
  mapWidth: number;
}

const VIEWPORT_PADDING = 120;
const LABEL_VISIBILITY_MIN_ZOOM = 0.55;
const CANVAS_ZOOM_MIN = 0.1;
const CANVAS_ZOOM_MAX = 5;
const WHEEL_ZOOM_FACTOR = 1.08;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

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

export function getMinimapViewport({
  zoom,
  stagePosition,
  imageWidth,
  imageHeight,
  stageWidth,
  stageHeight,
  mapWidth,
}: MinimapViewportArgs) {
  const aspect = imageHeight / imageWidth;
  const mapHeight = mapWidth * aspect;
  const scale = mapWidth / imageWidth;

  const unclampedX = (-stagePosition.x / zoom) * scale;
  const unclampedY = (-stagePosition.y / zoom) * scale;
  const rawWidth = (stageWidth / zoom) * scale;
  const rawHeight = (stageHeight / zoom) * scale;

  const viewportX = clamp(unclampedX, 0, mapWidth);
  const viewportY = clamp(unclampedY, 0, mapHeight);
  const viewportWidth = clamp(rawWidth - Math.max(0, -unclampedX), 0, mapWidth - viewportX);
  const viewportHeight = clamp(rawHeight - Math.max(0, -unclampedY), 0, mapHeight - viewportY);

  return {
    mapWidth,
    mapHeight,
    viewportX,
    viewportY,
    viewportWidth,
    viewportHeight,
  };
}
