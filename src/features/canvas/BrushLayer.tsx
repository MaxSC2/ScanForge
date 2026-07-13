import { useCallback, useRef, useState } from 'react';
import { Line, Layer, Circle, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import { useEditorStore } from '../../stores/useEditorStore';

interface BrushState {
  points: number[];
  erasing: boolean;
  size: number;
}

export function BrushCanvas({ width, height }: { width: number; height: number }) {
  const tool = useEditorStore((s) => s.tool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const brushErase = useEditorStore((s) => s.brushErase);
  const setBrushMask = useEditorStore((s) => s.setBrushMask);
  const brushMask = useEditorStore((s) => s.brushMask);
  const [strokes, setStrokes] = useState<BrushState[]>([]);
  const isPainting = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorPos = useRef({ x: 0, y: 0 });

  const renderMaskToDataUrl = useCallback((allStrokes: BrushState[]) => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const c = canvasRef.current;
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const s of allStrokes) {
      if (s.points.length < 4) continue;
      ctx.beginPath();
      ctx.moveTo(s.points[0], s.points[1]);
      for (let i = 2; i < s.points.length; i += 2) {
        ctx.lineTo(s.points[i], s.points[i + 1]);
      }
      if (s.erasing) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#ffffff';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#ffffff';
      }
      ctx.lineWidth = s.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    setBrushMask(c.toDataURL());
  }, [width, height, setBrushMask]);

  const handleMouseDown = () => {
    if (tool !== 'brush') return;
    isPainting.current = true;
    setStrokes((prev) => [...prev, { points: [], erasing: brushErase, size: brushSize }]);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const x = (pos.x - stage.x()) / stage.scaleX();
    const y = (pos.y - stage.y()) / stage.scaleY();
    cursorPos.current = { x, y };

    if (!isPainting.current || tool !== 'brush') return;

    setStrokes((prev) => {
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      last.points = [...last.points, x, y];
      updated[updated.length - 1] = last;
      return updated;
    });
  };

  const handleMouseUp = () => {
    if (!isPainting.current) return;
    isPainting.current = false;
    renderMaskToDataUrl(strokes);
  };

  if (tool !== 'brush') return null;

  return (
    <Layer
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      listening={tool === 'brush'}
    >
      {brushMask && (
        <KonvaImage
          image={(() => {
            const img = new window.Image();
            img.src = brushMask;
            return img;
          })()}
          width={width}
          height={height}
          opacity={0.5}
          listening={false}
        />
      )}
      {strokes.map((s, i) => (
        <Line
          key={i}
          points={s.points}
          stroke={s.erasing ? '#ff4444' : '#ffffff'}
          strokeWidth={s.size}
          lineCap="round"
          lineJoin="round"
          opacity={s.erasing ? 0.8 : 0.6}
          listening={false}
        />
      ))}
      <Circle
        x={cursorPos.current.x}
        y={cursorPos.current.y}
        radius={brushSize / 2}
        stroke={brushErase ? '#ff4444' : '#ffffff'}
        strokeWidth={1.5}
        dash={[4, 3]}
        fill="transparent"
        listening={false}
      />
    </Layer>
  );
}
