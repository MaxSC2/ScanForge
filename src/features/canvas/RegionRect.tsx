import { useRef, useEffect } from 'react';
import { Rect, Transformer, Group, Text } from 'react-konva';
import type Konva from 'konva';
import type { Region } from '../../types';
import { getRegionColor } from '../../types';
import { useRegionStore } from '../../stores/useRegionStore';
import { usePageStore } from '../../stores/usePageStore';
import { useEditorStore } from '../../stores/useEditorStore';

interface RegionRectProps {
  region: Region;
  isSelected: boolean;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
}

export function RegionRect({ region, isSelected, onContextMenu }: RegionRectProps) {
  const shapeRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const selectRegion = useRegionStore((s) => s.selectRegion);
  const updateRegion = useRegionStore((s) => s.updateRegion);
  const activePageId = usePageStore((s) => s.activePageId);
  const labelsVisible = useEditorStore((s) => s.labelsVisible);
  const tool = useEditorStore((s) => s.tool);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  if (!region.visible) return null;

  const handleSelect = () => {
    if (tool !== 'select') return;
    selectRegion(region.id);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!activePageId || region.locked) return;
    updateRegion(activePageId, region.id, {
      x: Math.round(e.target.x()),
      y: Math.round(e.target.y()),
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node || !activePageId || region.locked) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    updateRegion(activePageId, region.id, {
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.round(Math.max(5, node.width() * scaleX)),
      height: Math.round(Math.max(5, node.height() * scaleY)),
    });
  };

  const stroke = getRegionColor(region.kind);
  const canManipulate = tool === 'select' && !region.locked;

  return (
    <Group>
      <Rect
        ref={shapeRef}
        x={region.x}
        y={region.y}
        width={region.width}
        height={region.height}
        fill={isSelected ? `${stroke}25` : `${stroke}12`}
        stroke={stroke}
        strokeWidth={isSelected ? 2.5 : 1.5}
        cornerRadius={3}
        draggable={canManipulate}
        onClick={handleSelect}
        onTap={handleSelect}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onContextMenu={onContextMenu}
        hitStrokeWidth={8}
      />

      {/* Label overlay */}
      {labelsVisible && (
        <Group x={region.x} y={region.y - 18} listening={false}>
          <Rect
            width={Math.min(region.label.length * 6 + 16, region.width + 20)}
            height={16}
            fill={stroke}
            cornerRadius={[3, 3, 0, 0]}
            opacity={0.85}
          />
          <Text
            text={region.label}
            fontSize={10}
            fontFamily="Inter, system-ui, sans-serif"
            fill="#fff"
            padding={3}
            width={Math.min(region.label.length * 6 + 16, region.width + 20)}
            ellipsis
          />
        </Group>
      )}

      {/* Lock indicator */}
      {region.locked && labelsVisible && (
        <Text
          x={region.x + region.width - 16}
          y={region.y + 2}
          text="L"
          fontSize={10}
          fill="#f59e0b"
          fontStyle="bold"
          listening={false}
        />
      )}

      {/* Transformer */}
      {isSelected && canManipulate && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          anchorSize={7}
          anchorCornerRadius={2}
          borderStroke={stroke}
          anchorStroke={stroke}
          anchorFill="#18181b"
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
            'middle-left',
            'middle-right',
            'top-center',
            'bottom-center',
          ]}
          boundBoxFunc={(_old, newBox) => ({
            ...newBox,
            width: Math.max(10, newBox.width),
            height: Math.max(10, newBox.height),
          })}
        />
      )}
    </Group>
  );
}
