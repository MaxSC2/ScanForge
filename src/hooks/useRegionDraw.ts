import { useRef, useCallback } from 'react';
import type Konva from 'konva';
import { useRegionStore } from '../stores/useRegionStore';
import { usePageStore } from '../stores/usePageStore';
import { useEditorStore } from '../stores/useEditorStore';

interface DrawState {
  isDrawing: boolean;
  startX: number;
  startY: number;
}

const MIN_SIZE = 8;

/**
 * Manages the rectangle-drawing gesture on the canvas.
 * Returns stage event handlers + a transient rect for preview.
 */
export function useRegionDraw() {
  const drawRef = useRef<DrawState>({ isDrawing: false, startX: 0, startY: 0 });
  const previewRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const addRegion = useRegionStore((s) => s.addRegion);
  const tool = useEditorStore((s) => s.tool);

  const getPointer = useCallback((stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const scale = stage.scaleX();
    return {
      x: (pointer.x - stage.x()) / scale,
      y: (pointer.y - stage.y()) / scale,
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool !== 'draw') return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = getPointer(stage);
      if (!pos) return;

      drawRef.current = { isDrawing: true, startX: pos.x, startY: pos.y };
      previewRef.current = { x: pos.x, y: pos.y, width: 0, height: 0 };
    },
    [tool, getPointer],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!drawRef.current.isDrawing || tool !== 'draw') return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = getPointer(stage);
      if (!pos) return;

      const { startX, startY } = drawRef.current;
      previewRef.current = {
        x: Math.min(startX, pos.x),
        y: Math.min(startY, pos.y),
        width: Math.abs(pos.x - startX),
        height: Math.abs(pos.y - startY),
      };
    },
    [tool, getPointer],
  );

  const handleMouseUp = useCallback(() => {
    if (!drawRef.current.isDrawing || tool !== 'draw') return;
    drawRef.current.isDrawing = false;

    const rect = previewRef.current;
    previewRef.current = null;
    if (!rect || rect.width < MIN_SIZE || rect.height < MIN_SIZE) return;

    const pageId = usePageStore.getState().activePageId;
    if (!pageId) return;

    addRegion(pageId, rect);
  }, [tool, addRegion]);

  return {
    previewRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
