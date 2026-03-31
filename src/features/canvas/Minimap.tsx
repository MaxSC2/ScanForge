import { memo, useMemo } from 'react';
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

  return (
    <div
      className="absolute bottom-3 right-3 border border-zinc-700/60 rounded-lg overflow-hidden bg-zinc-900/90 backdrop-blur-sm shadow-lg shadow-black/30"
      style={{ width: viewport.mapWidth, height: viewport.mapHeight }}
    >
      {/* Page preview */}
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-75"
        decoding="async"
        loading="eager"
      />
      <div className="absolute inset-0 bg-black/20" />

      {/* Left/right anchors help read alignment quickly */}
      <div className="absolute inset-y-0 left-0 w-px bg-zinc-300/40" />
      <div className="absolute inset-y-0 right-0 w-px bg-zinc-300/40" />

      {/* Viewport indicator */}
      <div
        className="absolute border-2 border-indigo-500/60 bg-indigo-500/8 rounded-sm"
        style={{
          left: viewport.viewportX,
          top: viewport.viewportY,
          width: viewport.viewportWidth,
          height: viewport.viewportHeight,
        }}
      />

      <span className="absolute top-1 left-1.5 text-[9px] text-zinc-300/90 font-semibold">L</span>
      <span className="absolute top-1 right-1.5 text-[9px] text-zinc-300/90 font-semibold">R</span>
      <span className="absolute bottom-1 left-1.5 text-[9px] text-zinc-300/90 font-medium">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}

/**
 * A small overview of the full page, showing viewport position.
 */
export const Minimap = memo(MinimapBase);
