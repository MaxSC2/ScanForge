import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import {
  Copy,
  Unlock,
  ClipboardList,
} from 'lucide-react';
import {
  EyeIcon,
  EyeOffIcon,
  LanguagesIcon,
  ListOrderedIcon,
  LockIcon,
  ScanTextIcon,
  Trash2Icon,
  TypeIcon,
} from '../../icons';
import { REGION_KIND_OPTIONS } from '../../types/region';
import { usePageStore } from '../../stores/usePageStore';
import { useEditorStore, type EditorTool } from '../../stores/useEditorStore';
import { useJobStore } from '../../stores/useJobStore';
import { useRegionStore } from '../../stores/useRegionStore';
import { useImageLoader } from '../../hooks/useImageLoader';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { useFileDrop } from '../../hooks/useFileDrop';
import {
  getCanvasViewportBounds,
  isRegionWithinViewport,
} from './canvasPerformance';
import { snapRect, SNAP_THRESHOLD, GRID_STEP } from '../../utils/snapping';

interface CtxMenuState {
  x: number;
  y: number;
  regionId: string;
}

function getCanvasCursor(tool: EditorTool) {
  switch (tool) {
    case 'draw':
      return 'crosshair';
    case 'pan':
      return 'grab';
    default:
      return 'default';
  }
}

export function useEditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [drawRect, setDrawRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const cursorFrameRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawing = useRef(false);
  const drawStart = useRef({ x: 0, y: 0 });
  const previousPageIdRef = useRef<string | null>(null);

  const activePage = usePageStore((s) => {
    const id = s.activePageId;
    return id ? s.pages.find((p) => p.id === id) : undefined;
  });
  const activePageId = usePageStore((s) => s.activePageId);

  const zoom = useEditorStore((s) => s.zoom);
  const stagePosition = useEditorStore((s) => s.stagePosition);
  const viewMode = useEditorStore((s) => s.viewMode);
  const tool = useEditorStore((s) => s.tool);
  const cleanView = useEditorStore((s) => s.cleanView);
  const regionOverlaysVisible = useEditorStore((s) => s.regionOverlaysVisible);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const labelsVisible = useEditorStore((s) => s.labelsVisible);
  const minimapVisible = useEditorStore((s) => s.minimapVisible);
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition);
  const viewRequestNonce = useEditorStore((s) => s.viewRequestNonce);
  const applyViewportTransform = useEditorStore((s) => s.applyViewportTransform);
  const setEditingRegionId = useEditorStore((s) => s.setEditingRegionId);

  const selectedRegionId = useRegionStore((s) => s.selectedRegionId);
  const multiSelectedRegionIds = useRegionStore((s) => s.multiSelectedRegionIds);
  const selectRegion = useRegionStore((s) => s.selectRegion);
  const addRegion = useRegionStore((s) => s.addRegion);
  const updateRegion = useRegionStore((s) => s.updateRegion);
  const duplicateRegion = useRegionStore((s) => s.duplicateRegion);
  const deleteRegion = useRegionStore((s) => s.deleteRegion);
  const reorderRegions = useRegionStore((s) => s.reorderRegions);
  const queueOcrJobs = useJobStore((s) => s.queueOcrJobs);
  const queueTranslationJobs = useJobStore((s) => s.queueTranslationJobs);

  const image = useImageLoader(activePage?.imageUrl);
  const { handleWheel, handleDragEnd } = useCanvasInteraction();
  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useFileDrop();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (cursorFrameRef.current !== null) {
        window.cancelAnimationFrame(cursorFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!activePage || size.width <= 0 || size.height <= 0) return;

    const pageChanged = previousPageIdRef.current !== activePage.id;
    previousPageIdRef.current = activePage.id;

    const effectiveViewMode = pageChanged && viewMode === 'manual' ? 'fit-page' : viewMode;
    if (effectiveViewMode === 'manual') return;

    const padding = 40;
    const safeWidth = Math.max(1, size.width - padding * 2);
    const safeHeight = Math.max(1, size.height - padding * 2);

    let nextZoom = 1;

    if (effectiveViewMode === 'fit-width') {
      nextZoom = safeWidth / activePage.naturalWidth;
    } else if (effectiveViewMode === 'fit-page') {
      nextZoom = Math.min(
        safeWidth / activePage.naturalWidth,
        safeHeight / activePage.naturalHeight,
      );
    }

    if (!Number.isFinite(nextZoom) || nextZoom <= 0) {
      nextZoom = 1;
    }

    const scaledWidth = activePage.naturalWidth * nextZoom;
    const scaledHeight = activePage.naturalHeight * nextZoom;
    const centeredY = (size.height - scaledHeight) / 2;

    applyViewportTransform({
      zoom: nextZoom,
      stagePosition: {
        x: (size.width - scaledWidth) / 2,
        y:
          effectiveViewMode === 'fit-width' && scaledHeight > size.height - padding * 2
            ? padding
            : centeredY,
      },
    });
  }, [
    viewRequestNonce,
    viewMode,
    activePage?.id,
    activePage?.naturalWidth,
    activePage?.naturalHeight,
    size.width,
    size.height,
    applyViewportTransform,
  ]);

  const getScaledPointer = useCallback((stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };
  }, []);

  const handleMouseDown = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool !== 'draw') return;
      const stage = event.target.getStage();
      if (!stage) return;
      const pos = getScaledPointer(stage);
      if (!pos) return;
      isDrawing.current = true;
      drawStart.current = pos;
      setDrawRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    },
    [tool, getScaledPointer],
  );

  const handleMouseMove = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = event.target.getStage();
      if (stage) {
        const pos = getScaledPointer(stage);
        if (pos) {
          pendingCursorRef.current = { x: pos.x, y: pos.y };
          if (cursorFrameRef.current === null) {
            cursorFrameRef.current = window.requestAnimationFrame(() => {
              cursorFrameRef.current = null;
              const nextCursor = pendingCursorRef.current;
              if (nextCursor) {
                setCursorPosition(nextCursor);
              }
            });
          }
        }
      }

      if (!isDrawing.current || tool !== 'draw' || !stage) return;
      const pos = getScaledPointer(stage);
      if (!pos) return;
      const { x: sx, y: sy } = drawStart.current;
      setDrawRect({
        x: Math.min(sx, pos.x),
        y: Math.min(sy, pos.y),
        width: Math.abs(pos.x - sx),
        height: Math.abs(pos.y - sy),
      });
    },
    [tool, getScaledPointer, setCursorPosition],
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing.current || tool !== 'draw') return;
    isDrawing.current = false;
    const rect = drawRect;
    setDrawRect(null);
    if (!rect || rect.width < 8 || rect.height < 8 || !activePageId) return;
    const snapped = snapRect(rect, gridVisible, GRID_STEP, SNAP_THRESHOLD);
    addRegion(activePageId, {
      x: Math.round(snapped.x),
      y: Math.round(snapped.y),
      width: Math.round(snapped.width),
      height: Math.round(snapped.height),
    });
  }, [tool, drawRect, activePageId, addRegion, gridVisible]);

  const handleStageClick = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      if (event.target === event.target.getStage()) {
        selectRegion(null);
        setEditingRegionId(null);
        setCtxMenu(null);
      }
    },
    [selectRegion, setEditingRegionId],
  );

  const handleRegionContextMenu = useCallback(
    (regionId: string) => (event: Konva.KonvaEventObject<PointerEvent>) => {
      event.evt.preventDefault();
      const stage = event.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const container = stage.container().getBoundingClientRect();
      selectRegion(regionId);
      setCtxMenu({
        x: container.left + pointer.x,
        y: container.top + pointer.y,
        regionId,
      });
    },
    [selectRegion],
  );

  const contextMenuItems = useMemo(() => {
    if (!ctxMenu || !activePage || !activePageId) return [];
    const region = activePage.regions.find((item) => item.id === ctxMenu.regionId);
    if (!region) return [];

    const currentKindIndex = REGION_KIND_OPTIONS.findIndex((k) => k.value === region.kind);
    const nextKind = REGION_KIND_OPTIONS[(currentKindIndex + 1) % REGION_KIND_OPTIONS.length];

    const doAutoNumber = () => {
      const sorted = [...activePage.regions].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
      for (let i = 0; i < sorted.length; i++) {
        updateRegion(activePageId, sorted[i].id, { order: i + 1 });
      }
    };

    return [
      {
        label: 'OCR региона',
        icon: <ScanTextIcon size={13} />,
        onClick: () => queueOcrJobs([{ pageId: activePageId, regionIds: [region.id] }]),
      },
      {
        label: 'Перевести регион',
        icon: <LanguagesIcon size={13} />,
        disabled: !region.sourceText,
        onClick: () => queueTranslationJobs([{ pageId: activePageId, regionIds: [region.id] }]),
      },
      { separator: true },
      {
        label: `Тип: ${nextKind.label}`,
        icon: <TypeIcon size={13} />,
        onClick: () => updateRegion(activePageId, region.id, { kind: nextKind.value }),
      },
      {
        label: region.locked ? 'Разблокировать' : 'Заблокировать',
        icon: region.locked ? <Unlock size={13} /> : <LockIcon size={13} />,
        onClick: () => updateRegion(activePageId, region.id, { locked: !region.locked }),
      },
      {
        label: region.visible ? 'Скрыть' : 'Показать',
        icon: region.visible ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />,
        onClick: () => updateRegion(activePageId, region.id, { visible: !region.visible }),
      },
      { separator: true },
      {
        label: 'На передний план',
        icon: <span className="text-[10px] font-bold">↑</span>,
        onClick: () => {
          const sorted = [...activePage.regions].sort((a, b) => a.order - b.order);
          const idx = sorted.findIndex((r) => r.id === region.id);
          if (idx < sorted.length - 1) {
            reorderRegions(activePageId, idx, sorted.length - 1);
          }
        },
      },
      {
        label: 'На задний план',
        icon: <span className="text-[10px] font-bold">↓</span>,
        onClick: () => {
          const sorted = [...activePage.regions].sort((a, b) => a.order - b.order);
          const idx = sorted.findIndex((r) => r.id === region.id);
          if (idx > 0) {
            reorderRegions(activePageId, idx, 0);
          }
        },
      },
      { separator: true },
      {
        label: region.groupId ? 'Разгруппировать' : 'Сгруппировать',
        icon: <span className="text-[10px] font-bold">{region.groupId ? '∄' : '⊕'}</span>,
        onClick: () => {
          if (region.groupId) {
            updateRegion(activePageId, region.id, { groupId: undefined });
          } else {
            const newGroupId = crypto.randomUUID?.() ?? `${Date.now()}-${region.id}`;
            const targets = [region.id, ...multiSelectedRegionIds].filter(
              (id) => id !== region.id,
            );
            updateRegion(activePageId, region.id, { groupId: newGroupId });
            for (const tid of targets) {
              updateRegion(activePageId, tid, { groupId: newGroupId });
            }
          }
        },
      },
      { separator: true },
      {
        label: 'Автонумеровать страницу',
        icon: <ListOrderedIcon size={13} />,
        onClick: doAutoNumber,
      },
      {
        label: 'Копировать текст',
        icon: <ClipboardList size={13} />,
        disabled: !region.sourceText,
        onClick: () => navigator.clipboard?.writeText(region.sourceText),
      },
      {
        label: 'Дублировать',
        icon: <Copy size={13} />,
        shortcut: 'Ctrl+D',
        onClick: () => duplicateRegion(activePageId, region.id),
      },
      { separator: true },
      {
        label: 'Удалить',
        icon: <Trash2Icon size={13} />,
        shortcut: 'Del',
        danger: true,
        onClick: () => deleteRegion(activePageId, region.id),
      },
    ];
  }, [ctxMenu, activePage, activePageId, updateRegion, duplicateRegion, deleteRegion, queueOcrJobs, queueTranslationJobs, reorderRegions, multiSelectedRegionIds]);

  const viewportBounds = useMemo(
    () =>
      getCanvasViewportBounds({
        zoom,
        stagePosition,
        canvasWidth: size.width,
        canvasHeight: size.height,
      }),
    [zoom, stagePosition, size.width, size.height],
  );

  const visibleRegions = useMemo(() => {
    if (!activePage) return [];
    return [...activePage.regions]
      .sort((a, b) => a.order - b.order)
      .filter(
        (region) =>
          region.id === selectedRegionId || isRegionWithinViewport(region, viewportBounds),
      );
  }, [activePage, selectedRegionId, viewportBounds]);

  return {
    containerRef,
    size,
    ctxMenu,
    setCtxMenu,
    drawRect,
    activePage,
    activePageId,
    zoom,
    stagePosition,
    tool,
    cleanView,
    regionOverlaysVisible,
    gridVisible,
    labelsVisible,
    minimapVisible,
    selectedRegionId,
    multiSelectedRegionIds,
    image,
    isDragging,
    visibleRegions,
    contextMenuItems,
    cursor: getCanvasCursor(tool),
    handleWheel,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleStageClick,
    handleRegionContextMenu,
  };
}
