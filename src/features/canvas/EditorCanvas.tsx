import { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect } from 'react-konva';
import type Konva from 'konva';
import { usePageStore } from '../../stores/usePageStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useRegionStore } from '../../stores/useRegionStore';
import { useImageLoader } from '../../hooks/useImageLoader';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { useFileDrop } from '../../hooks/useFileDrop';
import { RegionRect } from './RegionRect';
import { CanvasGrid } from './CanvasGrid';
import { Minimap } from './Minimap';
import { ContextMenu } from '../../components/ContextMenu';
import {
  ImagePlus,
  Upload,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from 'lucide-react';

interface CtxMenuState {
  x: number;
  y: number;
  regionId: string;
}

export function EditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);

  const activePage = usePageStore((s) => {
    const id = s.activePageId;
    return id ? s.pages.find((p) => p.id === id) : undefined;
  });
  const zoom = useEditorStore((s) => s.zoom);
  const stagePosition = useEditorStore((s) => s.stagePosition);
  const viewMode = useEditorStore((s) => s.viewMode);
  const tool = useEditorStore((s) => s.tool);
  const regionOverlaysVisible = useEditorStore((s) => s.regionOverlaysVisible);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const minimapVisible = useEditorStore((s) => s.minimapVisible);
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition);
  const viewRequestNonce = useEditorStore((s) => s.viewRequestNonce);
  const applyViewportTransform = useEditorStore((s) => s.applyViewportTransform);
  const selectedRegionId = useRegionStore((s) => s.selectedRegionId);
  const selectRegion = useRegionStore((s) => s.selectRegion);
  const addRegion = useRegionStore((s) => s.addRegion);
  const updateRegion = useRegionStore((s) => s.updateRegion);
  const duplicateRegion = useRegionStore((s) => s.duplicateRegion);
  const deleteRegion = useRegionStore((s) => s.deleteRegion);
  const activePageId = usePageStore((s) => s.activePageId);

  const image = useImageLoader(activePage?.imageUrl);
  const { handleWheel, handleDragEnd } = useCanvasInteraction();
  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useFileDrop();

  // Drawing state
  const isDrawing = useRef(false);
  const drawStart = useRef({ x: 0, y: 0 });
  const [drawRect, setDrawRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const previousPageIdRef = useRef<string | null>(null);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
        y: effectiveViewMode === 'fit-width' && scaledHeight > size.height - padding * 2
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

  const getScaledPointer = useCallback(
    (stage: Konva.Stage) => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return null;
      return {
        x: (pointer.x - stage.x()) / stage.scaleX(),
        y: (pointer.y - stage.y()) / stage.scaleY(),
      };
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool !== 'draw') return;
      const stage = e.target.getStage();
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
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Update cursor position for status bar
      const stage = e.target.getStage();
      if (stage) {
        const pos = getScaledPointer(stage);
        if (pos) setCursorPosition({ x: pos.x, y: pos.y });
      }

      if (!isDrawing.current || tool !== 'draw') return;
      if (!stage) return;
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
    addRegion(activePageId, {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }, [tool, drawRect, activePageId, addRegion]);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) {
        selectRegion(null);
        setCtxMenu(null);
      }
    },
    [selectRegion],
  );

  const handleRegionContextMenu = useCallback(
    (regionId: string) => (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
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

  // Build context menu items
  const getContextMenuItems = () => {
    if (!ctxMenu || !activePageId) return [];
    const region = activePage?.regions.find((r) => r.id === ctxMenu.regionId);
    if (!region) return [];

    return [
      {
        label: region.locked ? 'Разблокировать' : 'Заблокировать',
        icon: region.locked ? <Unlock size={13} /> : <Lock size={13} />,
        onClick: () =>
          updateRegion(activePageId, region.id, { locked: !region.locked }),
      },
      {
        label: region.visible ? 'Скрыть' : 'Показать',
        icon: region.visible ? <EyeOff size={13} /> : <Eye size={13} />,
        onClick: () =>
          updateRegion(activePageId, region.id, { visible: !region.visible }),
      },
      {
        label: 'Дублировать',
        icon: <Copy size={13} />,
        shortcut: 'Ctrl+D',
        onClick: () => duplicateRegion(activePageId, region.id),
      },
      {
        label: 'Удалить',
        icon: <Trash2 size={13} />,
        shortcut: 'Del',
        danger: true,
        onClick: () => deleteRegion(activePageId, region.id),
      },
    ];
  };

  const cursorMap = {
    select: 'default',
    draw: 'crosshair',
    pan: 'grab',
  };

  // Empty state with drag & drop
  if (!activePage) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={`flex flex-col items-center justify-center h-full gap-4 text-center px-8 transition-colors ${isDragging ? 'bg-indigo-500/5' : ''}`}>
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${isDragging ? 'bg-indigo-500/20 scale-110' : 'bg-zinc-800/60'}`}>
            {isDragging ? (
              <Upload size={32} className="text-indigo-400 animate-bounce" />
            ) : (
              <ImagePlus size={32} className="text-zinc-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-300">
              {isDragging ? 'Отпусти изображения здесь' : 'Страница не выбрана'}
            </p>
            <p className="text-xs text-zinc-600 mt-1.5 max-w-64">
              Загрузи изображения через тулбар или перетащи файлы сюда
            </p>
          </div>
          {!isDragging && (
            <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                V
              </kbd>
              Выбор
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                R
              </kbd>
              Рисование
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                H
              </kbd>
              Панорама
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{ cursor: cursorMap[tool] }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-indigo-500/5 border-2 border-dashed border-indigo-500/30 rounded-lg pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} className="text-indigo-400 animate-bounce" />
            <p className="text-sm text-indigo-300 font-medium">Отпусти, чтобы добавить страницы</p>
          </div>
        </div>
      )}

      <Stage
        width={size.width}
        height={size.height}
        scaleX={zoom}
        scaleY={zoom}
        x={stagePosition.x}
        y={stagePosition.y}
        draggable={tool === 'pan'}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleStageClick}
      >
        <Layer>
          {/* Checkerboard background placeholder */}
          <Rect
            x={0}
            y={0}
            width={activePage.naturalWidth}
            height={activePage.naturalHeight}
            fill="#1a1a2e"
            cornerRadius={0}
            listening={false}
          />

          {/* Source image */}
          {image && (
            <KonvaImage
              image={image}
              width={activePage.naturalWidth}
              height={activePage.naturalHeight}
              listening={false}
            />
          )}

          {/* Grid overlay */}
          {gridVisible && (
            <CanvasGrid
              width={activePage.naturalWidth}
              height={activePage.naturalHeight}
            />
          )}

          {/* Regions */}
          {regionOverlaysVisible &&
            [...activePage.regions].sort((a, b) => a.order - b.order).map((r) => (
              <RegionRect
                key={r.id}
                region={r}
                isSelected={r.id === selectedRegionId}
                onContextMenu={handleRegionContextMenu(r.id)}
              />
            ))}

          {/* Draw preview */}
          {drawRect && (
            <Rect
              x={drawRect.x}
              y={drawRect.y}
              width={drawRect.width}
              height={drawRect.height}
              fill="rgba(99,102,241,0.08)"
              stroke="#6366f1"
              strokeWidth={1.5}
              dash={[6, 4]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {/* Minimap */}
      {minimapVisible && activePage && (
        <Minimap
          imageUrl={activePage.imageUrl}
          imageWidth={activePage.naturalWidth}
          imageHeight={activePage.naturalHeight}
          stageWidth={size.width}
          stageHeight={size.height}
        />
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={getContextMenuItems()}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
