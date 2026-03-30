import { useCallback } from 'react';
import type Konva from 'konva';
import { useEditorStore } from '../stores/useEditorStore';
import { getWheelViewportTransform } from '../features/canvas/canvasPerformance';

/**
 * Provides wheel-zoom and drag handlers for the Konva Stage.
 */
export function useCanvasInteraction() {
  const applyViewportTransform = useEditorStore((s) => s.applyViewportTransform);
  const setStagePosition = useEditorStore((s) => s.setStagePosition);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      if (!stage) return;

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      applyViewportTransform(
        getWheelViewportTransform({
          zoom: oldScale,
          stagePosition: { x: stage.x(), y: stage.y() },
          pointer,
          deltaY: e.evt.deltaY,
        }),
      );
    },
    [applyViewportTransform],
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
