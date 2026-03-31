import { useCallback, useEffect, useRef } from 'react';
import type Konva from 'konva';
import { useEditorStore } from '../stores/useEditorStore';
import { getWheelViewportTransform } from '../features/canvas/canvasPerformance';

/**
 * Provides wheel-zoom and drag handlers for the Konva Stage.
 */
export function useCanvasInteraction() {
  const applyViewportTransform = useEditorStore((s) => s.applyViewportTransform);
  const setStagePosition = useEditorStore((s) => s.setStagePosition);
  const wheelFrameRef = useRef<number | null>(null);
  const pendingViewportRef = useRef<ReturnType<typeof getWheelViewportTransform> | null>(null);

  useEffect(() => () => {
    if (wheelFrameRef.current !== null) {
      window.cancelAnimationFrame(wheelFrameRef.current);
    }
  }, []);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const baseViewport = pendingViewportRef.current ?? {
        zoom: stage.scaleX(),
        stagePosition: { x: stage.x(), y: stage.y() },
      };

      pendingViewportRef.current = getWheelViewportTransform({
        zoom: baseViewport.zoom,
        stagePosition: baseViewport.stagePosition,
          pointer,
          deltaY: e.evt.deltaY,
        });

      if (wheelFrameRef.current === null) {
        wheelFrameRef.current = window.requestAnimationFrame(() => {
          wheelFrameRef.current = null;
          const nextViewport = pendingViewportRef.current;
          if (!nextViewport) return;
          pendingViewportRef.current = null;
          applyViewportTransform(nextViewport);
        });
      }
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
