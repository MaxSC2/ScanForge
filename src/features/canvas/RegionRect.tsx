import { useCallback, useRef, useEffect, useMemo } from 'react';
import { Rect, Transformer, Group, Text, Circle } from 'react-konva';
import type Konva from 'konva';
import type { Region } from '../../types';
import { getRegionColor, createDefaultTextStyle } from '../../types';
import type { TextStyleRecord } from '../../types';
import { useRegionStore } from '../../stores/useRegionStore';
import { usePageStore } from '../../stores/usePageStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectDomainStore } from '../../stores/useProjectDomainStore';
import { snapRect, SNAP_THRESHOLD, GRID_STEP } from '../../utils/snapping';

const GROUP_COLORS = [
  '#22d3ee', '#f472b6', '#34d399', '#fb923c',
  '#a78bfa', '#facc15', '#818cf8', '#f87171',
];

/**
 * Deterministically assigns a group indicator color from the GROUP_COLORS palette
 * based on the group ID's hash. Used to give each region group a unique visual color
 * (cyan, pink, green, orange, purple, yellow, indigo, red).
 */
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

function getGroupColor(groupId: string): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = ((hash << 5) - hash + groupId.charCodeAt(i)) | 0;
  }
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

/** Props for the RegionRect canvas component that renders a single region on the Konva stage. */
interface RegionRectProps {
  region: Region;
  isSelected: boolean;
  isMultiSelected?: boolean;
  showLabelOverlay: boolean;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
}

/**
 * Renders a single region rectangle on the Konva canvas with:
 * - Kind-based stroke color (via `getRegionColor`).
 * - Multi-select purple styling (dashed border, purple stroke).
 * - Label overlay above the rect with a colored badge.
 * - Lock indicator ("L" icon) centered on the right edge.
 * - Source and translated text overlays.
 * - Group visual indicator: a colored dashed border and a clickable "G" badge
 *   that selects all regions in the same group.
 * - A Konva Transformer for resize operations on the primary selection.
 * - Snapping to grid and other regions on drag/resize.
 * - Group-member offset logic: dragging a grouped region moves all siblings by the same delta.
 */
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
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const snapGuidesH = useEditorStore((s) => s.snapGuidesH);
  const snapGuidesV = useEditorStore((s) => s.snapGuidesV);
  const textStyles = useProjectDomainStore((s) => s.textStyles);
  const defaultStyleId = useProjectDomainStore((s) => s.settings?.defaultTextStyleId);
  const projectId = useProjectDomainStore((s) => s.projectId);

  const otherRegions = (activePage?.regions ?? [])
    .filter((r) => r.id !== region.id && r.visible)
    .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));

  const stroke = getRegionColor(region.kind);
  const canManipulate = tool === 'select' && !region.locked;
  const displaySelected = isSelected || isMultiSelected;
  const groupColor = useMemo(
    () => (region.groupId ? getGroupColor(region.groupId) : null),
    [region.groupId],
  );

  const textStyle = useMemo(
    () => resolveRegionStyle(region, textStyles, defaultStyleId, projectId ?? undefined),
    [region, textStyles, defaultStyleId, projectId],
  );

  const handleSelectGroup = useCallback(() => {
    if (!activePage || !region.groupId) return;
    const groupIds = activePage.regions
      .filter((r) => r.groupId === region.groupId)
      .map((r) => r.id);
    useRegionStore.setState({ selectedRegionId: groupIds[0], multiSelectedRegionIds: groupIds.slice(1) });
  }, [activePage, region.groupId]);

  const handleDblClick = useCallback(() => {
    if (tool !== 'select') return;
    setEditingRegionId(region.id);
  }, [region.id, tool, setEditingRegionId]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, canManipulate]);

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool !== 'select') return;
    selectRegion(region.id, e.evt?.shiftKey);
    setEditingRegionId(null);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!activePageId || region.locked) return;
    const snapped = snapRect(
      { x: e.target.x(), y: e.target.y(), width: region.width, height: region.height },
      gridVisible,
      GRID_STEP,
      SNAP_THRESHOLD,
      otherRegions,
      snapGuidesH,
      snapGuidesV,
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
    });
  };

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
      snapGuidesH,
      snapGuidesV,
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

  if (!region.visible) return null;

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

      {/* Confidence indicator bar — always visible */}
      {region.ocrConfidence !== undefined && region.ocrConfidence < 0.8 && (
        <Rect
          x={region.x}
          y={region.y + region.height - 3}
          width={region.width * region.ocrConfidence}
          height={3}
          fill={region.ocrConfidence < 0.5 ? '#ef4444' : '#f59e0b'}
          opacity={0.8}
          cornerRadius={[0, 0, 0, 2]}
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

      {/* Group indicator border */}
      {region.groupId && groupColor && (
        <Rect
          x={region.x - 3}
          y={region.y - 3}
          width={region.width + 6}
          height={region.height + 6}
          stroke={groupColor}
          strokeWidth={1.5}
          dash={[4, 3]}
          cornerRadius={5}
          listening={false}
          opacity={0.6}
        />
      )}

      {/* Group badge */}
      {region.groupId && groupColor && showLabelOverlay && (
        <Group
          x={region.x + region.width - 10}
          y={region.y - 10}
          onClick={handleSelectGroup}
          onTap={handleSelectGroup}
          listening={canManipulate}
        >
          <Circle radius={7} fill={groupColor} opacity={0.9} />
          <Text
            x={-3.5}
            y={-4.5}
            text="G"
            fontSize={9}
            fill="#fff"
            fontStyle="bold"
            listening={false}
          />
        </Group>
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
