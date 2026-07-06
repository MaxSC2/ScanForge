import { memo, useCallback, useMemo, useRef } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { getMinimapViewport } from './canvasPerformance';

interface MinimapProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  stageWidth: number;
  stageHeight: number;
}

const MINIMAP_W = 160;

function MinimapBase({
  imageUrl,
  imageWidth,
  imageHeight,
  stageWidth,
  stageHeight,
}: MinimapProps) {
  const zoom = useEditorStore((s) => s.zoom);
  const stagePos = useEditorStore((s) => s.stagePosition);
  const applyViewportTransform = useEditorStore((s) => s.applyViewportTransform);
  const mapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const viewport = useMemo(
    () =>
      getMinimapViewport({
        zoom,
        stagePosition: stagePos,
        imageWidth,
        imageHeight,
        stageWidth,
        stageHeight,
        mapWidth: MINIMAP_W,
      }),
    [zoom, stagePos, imageWidth, imageHeight, stageWidth, stageHeight],
  );

  const scale = imageWidth > 0 ? MINIMAP_W / imageWidth : 1;

  const navigateTo = useCallback(
    (clientX: number, clientY: number) => {
      const el = mapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;
      const pageX = clickX / scale;
      const pageY = clickY / scale;
      applyViewportTransform({
        zoom,
        stagePosition: {
          x: stageWidth / 2 - pageX * zoom,
          y: stageHeight / 2 - pageY * zoom,
        },
      });
    },
    [zoom, scale, stageWidth, stageHeight, applyViewportTransform],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      navigateTo(e.clientX, e.clientY);
    },
    [navigateTo],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      navigateTo(e.clientX, e.clientY);
    },
    [navigateTo],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  return (
    <div
      ref={mapRef}
      className="absolute bottom-3 right-3 border border-zinc-700/60 rounded-lg overflow-hidden bg-zinc-900/90 backdrop-blur-sm shadow-lg shadow-black/30 cursor-pointer select-none"
      style={{ width: viewport.mapWidth, height: viewport.mapHeight }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Page preview */}
      <img
        src={imageUrl}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75"
        decoding="async"
        loading="eager"
      />
      <div className="pointer-events-none absolute inset-0 bg-black/20" />

      {/* Left/right anchors help read alignment quickly */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-zinc-300/40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-zinc-300/40" />

      {/* Viewport indicator (draggable) */}
      <div
        className="absolute border-2 border-indigo-500/60 bg-indigo-500/8 rounded-sm pointer-events-none"
        style={{
          left: viewport.viewportX,
          top: viewport.viewportY,
          width: viewport.viewportWidth,
          height: viewport.viewportHeight,
        }}
      />

      <span className="pointer-events-none absolute top-1 left-1.5 text-[9px] text-zinc-300/90 font-semibold">L</span>
      <span className="pointer-events-none absolute top-1 right-1.5 text-[9px] text-zinc-300/90 font-semibold">R</span>
      <span className="pointer-events-none absolute bottom-1 left-1.5 text-[9px] text-zinc-300/90 font-medium">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}

/**
 * A small overview of the full page, showing viewport position.
 * Click or drag to navigate the main canvas viewport.
 */
export const Minimap = memo(MinimapBase);
