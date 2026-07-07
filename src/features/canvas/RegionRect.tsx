import { useCallback, useRef, useEffect } from 'react';
import { Rect, Transformer, Group, Text } from 'react-konva';
import type Konva from 'konva';
import type { Region } from '../../types';
import { getRegionColor } from '../../types';
import { useRegionStore } from '../../stores/useRegionStore';
import { usePageStore } from '../../stores/usePageStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { snapRect, SNAP_THRESHOLD, GRID_STEP } from '../../utils/snapping';

interface RegionRectProps {
  region: Region;
  isSelected: boolean;
  isMultiSelected?: boolean;
  showLabelOverlay: boolean;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
}

export function RegionRect({
  region,
  isSelected,
  isMultiSelected = false,
  showLabelOverlay,
  onContextMenu,
}: RegionRectProps) {
  const shapeRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const selectRegion = useRegionStore((s) => s.selectRegion);
  const updateRegion = useRegionStore((s) => s.updateRegion);
  const activePageId = usePageStore((s) => s.activePageId);
  const activePage = usePageStore((s) => {
    const id = s.activePageId;
    return id ? s.pages.find((p) => p.id === id) : undefined;
  });
  const tool = useEditorStore((s) => s.tool);
  const setEditingRegionId = useEditorStore((s) => s.setEditingRegionId);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  if (!region.visible) return null;

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool !== 'select') return;
    selectRegion(region.id, e.evt?.shiftKey);
    setEditingRegionId(null);
  };

  const gridVisible = useEditorStore((s) => s.gridVisible);

  const otherRegions = (activePage?.regions ?? [])
    .filter((r) => r.id !== region.id && r.visible)
    .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!activePageId || region.locked) return;
    const snapped = snapRect(
      { x: e.target.x(), y: e.target.y(), width: region.width, height: region.height },
      gridVisible,
      GRID_STEP,
      SNAP_THRESHOLD,
      otherRegions,
    );

    // If region is grouped, offset all group members by the same delta
    const dx = Math.round(snapped.x) - region.x;
    const dy = Math.round(snapped.y) - region.y;
    if (region.groupId && (dx !== 0 || dy !== 0)) {
      const groupRegions = (activePage?.regions ?? []).filter(
        (r) => r.groupId === region.groupId && r.id !== region.id,
      );
      for (const gr of groupRegions) {
        updateRegion(activePageId, gr.id, { x: gr.x + dx, y: gr.y + dy });
      }
    }

    updateRegion(activePageId, region.id, {
      x: Math.round(snapped.x),
      y: Math.round(snapped.y),
    });
  };

  const handleDblClick = useCallback(() => {
    if (tool !== 'select') return;
    setEditingRegionId(region.id);
  }, [region.id, tool, setEditingRegionId]);

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node || !activePageId || region.locked) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const snapped = snapRect(
      {
        x: node.x(),
        y: node.y(),
        width: node.width() * scaleX,
        height: node.height() * scaleY,
      },
      gridVisible,
      GRID_STEP,
      SNAP_THRESHOLD,
      otherRegions,
    );

    const dx = Math.round(snapped.x) - region.x;
    const dy = Math.round(snapped.y) - region.y;
    if (region.groupId && (dx !== 0 || dy !== 0)) {
      const groupRegions = (activePage?.regions ?? []).filter(
        (r) => r.groupId === region.groupId && r.id !== region.id,
      );
      for (const gr of groupRegions) {
        updateRegion(activePageId, gr.id, { x: gr.x + dx, y: gr.y + dy });
      }
    }

    updateRegion(activePageId, region.id, {
      x: Math.round(snapped.x),
      y: Math.round(snapped.y),
      width: Math.round(Math.max(5, snapped.width)),
      height: Math.round(Math.max(5, snapped.height)),
    });
  };

  const stroke = getRegionColor(region.kind);
  const canManipulate = tool === 'select' && !region.locked;
  const displaySelected = isSelected || isMultiSelected;

  return (
    <Group>
      <Rect
        ref={shapeRef}
        x={region.x}
        y={region.y}
        width={region.width}
        height={region.height}
        fill={displaySelected ? `${stroke}25` : `${stroke}12`}
        stroke={isMultiSelected ? '#a78bfa' : stroke}
        strokeWidth={displaySelected ? 2.5 : 1.5}
        dash={isMultiSelected ? [4, 3] : undefined}
        cornerRadius={3}
        draggable={canManipulate}
        onClick={handleSelect}
        onTap={handleSelect}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onContextMenu={onContextMenu}
        hitStrokeWidth={8}
        perfectDrawEnabled={false}
        listening={tool === 'select'}
      />

      {/* Label overlay */}
      {showLabelOverlay && (
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
      {region.locked && showLabelOverlay && (
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

      {/* Source text display */}
      {region.sourceText && (
        <Text
          x={region.x + 4}
          y={region.y + region.height - 18}
          width={region.width - 8}
          text={region.sourceText}
          fontSize={10}
          fontFamily="Inter, system-ui, sans-serif"
          fill="rgba(255,255,255,0.35)"
          fontStyle="italic"
          ellipsis
          listening={false}
        />
      )}

      {/* Translated text display */}
      {region.translatedText && (
        <Text
          x={region.x + 4}
          y={region.y + 4}
          width={region.width - 8}
          height={region.height - (region.sourceText ? 22 : 8)}
          text={region.translatedText}
          fontSize={11}
          fontFamily="Inter, system-ui, sans-serif"
          fill="rgba(255,255,255,0.8)"
          ellipsis
          listening={false}
        />
      )}

      {/* Transformer — only for primary selection */}
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
