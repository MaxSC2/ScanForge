import type { Region } from '../../types';

export interface CanvasViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
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
