import { useEditorStore } from '../stores/useEditorStore';
import { usePageStore } from '../stores/usePageStore';
import { useRegionStore } from '../stores/useRegionStore';
import {
  MousePointer2,
  Layers,
  ZoomIn,
  Grid3X3,
  Tag,
  Map,
} from 'lucide-react';

export function StatusBar() {
  const activePage = usePageStore((s) => {
    const id = s.activePageId;
    return id ? s.pages.find((p) => p.id === id) : undefined;
  });
  const pageCount = usePageStore((s) => s.pages.length);
  const selectedPageIds = usePageStore((s) => s.selectedPageIds);
  const stitching = usePageStore((s) => s.stitching);
  const zoom = useEditorStore((s) => s.zoom);
  const cursorPos = useEditorStore((s) => s.cursorPosition);
  const tool = useEditorStore((s) => s.tool);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const labelsVisible = useEditorStore((s) => s.labelsVisible);
  const minimapVisible = useEditorStore((s) => s.minimapVisible);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const toggleLabels = useEditorStore((s) => s.toggleLabels);
  const toggleMinimap = useEditorStore((s) => s.toggleMinimap);
  const selectedRegionId = useRegionStore((s) => s.selectedRegionId);

  const regionCount = activePage?.regions.length ?? 0;
  const selectedRegion = activePage?.regions.find(
    (r) => r.id === selectedRegionId,
  );

  const toolLabels = { select: 'Выбор', draw: 'Рисование', pan: 'Панорама' };

  return (
    <footer className="flex-none h-7 flex items-center gap-0 px-1 border-t border-zinc-800 bg-zinc-900 text-[11px] text-zinc-500 select-none">
      {/* Left section */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Tool */}
        <span className="flex items-center gap-1 pl-1">
          <MousePointer2 size={11} />
          {toolLabels[tool]}
        </span>

        {/* Page info */}
        {activePage ? (
          <span className="truncate max-w-48">
            {activePage.fileName}
            <span className="text-zinc-600 ml-1">
              {activePage.naturalWidth}×{activePage.naturalHeight}
            </span>
          </span>
        ) : (
          <span className="text-zinc-600">Страниц: {pageCount}</span>
        )}

        {selectedPageIds.length > 0 && (
          <span className="text-zinc-600">
            Пакет: {selectedPageIds.length}
            {stitching ? ' (склейка...)' : ''}
          </span>
        )}

        {/* Regions */}
        <span className="flex items-center gap-1">
          <Layers size={11} />
          Регионов: {regionCount}
        </span>

        {selectedRegion && (
          <span className="text-indigo-400 truncate max-w-32">
            ▸ {selectedRegion.label}
          </span>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* Toggle buttons */}
        <button
          onClick={toggleGrid}
          className={`p-1 rounded transition-colors ${gridVisible ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-600 hover:text-zinc-400'}`}
          title="Сетка (G)"
        >
          <Grid3X3 size={12} />
        </button>
        <button
          onClick={toggleLabels}
          className={`p-1 rounded transition-colors ${labelsVisible ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-600 hover:text-zinc-400'}`}
          title="Подписи регионов"
        >
          <Tag size={12} />
        </button>
        <button
          onClick={toggleMinimap}
          className={`p-1 rounded transition-colors ${minimapVisible ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-600 hover:text-zinc-400'}`}
          title="Миникарта"
        >
          <Map size={12} />
        </button>

        <div className="w-px h-3.5 bg-zinc-800 mx-1" />

        {/* Cursor position */}
        <span className="tabular-nums w-24 text-right text-zinc-600">
          X:{Math.round(cursorPos.x)} Y:{Math.round(cursorPos.y)}
        </span>

        <div className="w-px h-3.5 bg-zinc-800 mx-1" />

        {/* Zoom */}
        <span className="flex items-center gap-1 tabular-nums w-16 justify-end pr-1">
          <ZoomIn size={11} />
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </footer>
  );
}
