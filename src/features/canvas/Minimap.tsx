import { useEditorStore } from '../../stores/useEditorStore';

interface MinimapProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  stageWidth: number;
  stageHeight: number;
}

const MINIMAP_W = 160;

/**
 * A small overview of the full page, showing viewport position.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function Minimap({
  imageUrl,
  imageWidth,
  imageHeight,
  stageWidth,
  stageHeight,
}: MinimapProps) {
  const zoom = useEditorStore((s) => s.zoom);
  const stagePos = useEditorStore((s) => s.stagePosition);

  const aspect = imageHeight / imageWidth;
  const mapW = MINIMAP_W;
  const mapH = mapW * aspect;
  const scale = mapW / imageWidth;

  const unclampedX = (-stagePos.x / zoom) * scale;
  const unclampedY = (-stagePos.y / zoom) * scale;
  const rawW = (stageWidth / zoom) * scale;
  const rawH = (stageHeight / zoom) * scale;
  const vpX = clamp(unclampedX, 0, mapW);
  const vpY = clamp(unclampedY, 0, mapH);
  const vpW = clamp(rawW - Math.max(0, -unclampedX), 0, mapW - vpX);
  const vpH = clamp(rawH - Math.max(0, -unclampedY), 0, mapH - vpY);

  return (
    <div
      className="absolute bottom-3 right-3 border border-zinc-700/60 rounded-lg overflow-hidden bg-zinc-900/90 backdrop-blur-sm shadow-lg shadow-black/30"
      style={{ width: mapW, height: mapH }}
    >
      {/* Page preview */}
      <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-75" />
      <div className="absolute inset-0 bg-black/20" />

      {/* Left/right anchors help read alignment quickly */}
      <div className="absolute inset-y-0 left-0 w-px bg-zinc-300/40" />
      <div className="absolute inset-y-0 right-0 w-px bg-zinc-300/40" />

      {/* Viewport indicator */}
      <div
        className="absolute border-2 border-indigo-500/60 bg-indigo-500/8 rounded-sm"
        style={{
          left: vpX,
          top: vpY,
          width: vpW,
          height: vpH,
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
