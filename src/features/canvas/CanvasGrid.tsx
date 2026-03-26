import { Line } from 'react-konva';

interface CanvasGridProps {
  width: number;
  height: number;
  step?: number;
}

/**
 * Renders a translucent grid overlay on the canvas.
 */
export function CanvasGrid({ width, height, step = 50 }: CanvasGridProps) {
  const lines: React.ReactNode[] = [];

  // Vertical lines
  for (let x = 0; x <= width; x += step) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, height]}
        stroke="#3f3f46"
        strokeWidth={0.5}
        opacity={x % (step * 4) === 0 ? 0.5 : 0.2}
        listening={false}
      />,
    );
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += step) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}
        stroke="#3f3f46"
        strokeWidth={0.5}
        opacity={y % (step * 4) === 0 ? 0.5 : 0.2}
        listening={false}
      />,
    );
  }

  return <>{lines}</>;
}
