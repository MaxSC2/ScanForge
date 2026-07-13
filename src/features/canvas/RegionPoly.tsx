import { useCallback, useRef, useEffect, useMemo } from 'react';
import { Line, Group, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { Region } from '../../types';
import { getRegionColor, createDefaultTextStyle } from '../../types';
import type { TextStyleRecord } from '../../types';
import { useRegionStore } from '../../stores/useRegionStore';
import { usePageStore } from '../../stores/usePageStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectDomainStore } from '../../stores/useProjectDomainStore';

function resolveRegionStyle(
  region: Region,
  styles: TextStyleRecord[],
  defaultId?: string,
  projectId?: string,
): TextStyleRecord {
  return (
    styles.find((s) => s.id === region.textStyleId) ??
    styles.find((s) => s.id === defaultId) ??
    (projectId ? createDefaultTextStyle(projectId) : styles[0]) ??
    { id: '', projectId: '', name: '', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 28, lineHeight: 1.15, letterSpacing: 0, align: 'center', fill: '#ffffff', stroke: '#111111', strokeWidth: 3 }
  );
}

interface RegionPolyProps {
  region: Region;
  isSelected: boolean;
  isMultiSelected?: boolean;
  showLabelOverlay: boolean;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
}

export function RegionPoly({
  region,
  isSelected,
  isMultiSelected = false,
  showLabelOverlay,
  onContextMenu,
}: RegionPolyProps) {
  const lineRef = useRef<Konva.Line>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const selectRegion = useRegionStore((s) => s.selectRegion);
  const updateRegion = useRegionStore((s) => s.updateRegion);
  const activePageId = usePageStore((s) => s.activePageId);
  const tool = useEditorStore((s) => s.tool);
  const setEditingRegionId = useEditorStore((s) => s.setEditingRegionId);
  const textStyles = useProjectDomainStore((s) => s.textStyles);
  const defaultStyleId = useProjectDomainStore((s) => s.settings?.defaultTextStyleId);
  const projectId = useProjectDomainStore((s) => s.projectId);

  const stroke = getRegionColor(region.kind);
  const canManipulate = tool === 'select' && !region.locked;
  const displaySelected = isSelected || isMultiSelected;

  const textStyle = useMemo(
    () => resolveRegionStyle(region, textStyles, defaultStyleId, projectId ?? undefined),
    [region, textStyles, defaultStyleId, projectId],
  );

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool !== 'select') return;
    selectRegion(region.id, e.evt?.shiftKey);
    setEditingRegionId(null);
  };

  const handleDblClick = useCallback(() => {
    if (tool !== 'select') return;
    setEditingRegionId(region.id);
  }, [region.id, tool, setEditingRegionId]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!activePageId || region.locked) return;
    updateRegion(activePageId, region.id, {
      x: Math.round(e.target.x()),
      y: Math.round(e.target.y()),
    });
  };

  useEffect(() => {
    if (isSelected && trRef.current && lineRef.current) {
      trRef.current.nodes([lineRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, canManipulate]);

  const points = region.polygon
    ? region.polygon.flatMap((p) => [p.x, p.y])
    : [0, 0, region.width, 0, region.width, region.height, 0, region.height];

  if (!region.visible) return null;

  return (
    <Group>
      <Line
        ref={lineRef}
        x={region.x}
        y={region.y}
        points={points}
        closed
        fill={displaySelected ? `${stroke}25` : `${stroke}12`}
        stroke={isMultiSelected ? '#a78bfa' : stroke}
        strokeWidth={displaySelected ? 2.5 : 1.5}
        dash={isMultiSelected ? [4, 3] : undefined}
        draggable={canManipulate}
        onClick={handleSelect}
        onTap={handleSelect}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        onDragEnd={handleDragEnd}
        onContextMenu={onContextMenu}
        hitStrokeWidth={8}
        perfectDrawEnabled={false}
        listening={tool === 'select'}
      />

      {showLabelOverlay && (
        <Group x={region.x} y={region.y - 18} listening={false}>
          <Line
            points={[0, 0, Math.min(region.label.length * 6 + 16, region.width + 20), 0, Math.min(region.label.length * 6 + 16, region.width + 20), 16, 0, 16]}
            closed
            fill={stroke}
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

      {region.translatedText && (
        <Text
          x={region.x + 4}
          y={region.y + 4}
          width={region.width - 8}
          height={region.height - (region.sourceText ? 22 : 8)}
          text={region.translatedText}
          fontSize={Math.max(8, Math.round(textStyle.fontSize * 0.4))}
          fontFamily={textStyle.fontFamily}
          fill={textStyle.fill}
          stroke={textStyle.strokeWidth > 0 ? textStyle.stroke : undefined}
          strokeWidth={Math.max(0.5, Math.round(textStyle.strokeWidth * 0.4))}
          align={textStyle.align}
          lineHeight={textStyle.lineHeight}
          ellipsis
          listening={false}
        />
      )}

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
