import { useCallback } from 'react';
import type Konva from 'konva';
import { useEditorStore } from '../stores/useEditorStore';

const ZOOM_FACTOR = 1.08;

/**
 * Provides wheel-zoom and drag handlers for the Konva Stage.
 */
export function useCanvasInteraction() {
  const setZoom = useEditorStore((s) => s.setZoom);
  const setStagePosition = useEditorStore((s) => s.setStagePosition);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      if (!stage) return;

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const newScale =
        direction > 0 ? oldScale * ZOOM_FACTOR : oldScale / ZOOM_FACTOR;

      const clampedScale = Math.min(5, Math.max(0.1, newScale));

      const newPos = {
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      };

      setZoom(clampedScale);
      setStagePosition(newPos);
    },
    [setZoom, setStagePosition],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;
      setStagePosition({ x: stage.x(), y: stage.y() });
    },
    [setStagePosition],
  );

  return { handleWheel, handleDragEnd };
}
