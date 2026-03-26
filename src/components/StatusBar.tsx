import {
  Focus,
  Grid3X3,
  Map,
  MousePointer2,
  ScanText,
  Tag,
  Layers,
  ZoomIn,
} from 'lucide-react';
import { useEditorStore } from '../stores/useEditorStore';
import { useJobStore } from '../stores/useJobStore';
import { usePageStore } from '../stores/usePageStore';
import { useRegionStore } from '../stores/useRegionStore';

export function StatusBar() {
  const activePage = usePageStore((state) => {
    const id = state.activePageId;
    return id ? state.pages.find((page) => page.id === id) : undefined;
  });
  const pageCount = usePageStore((state) => state.pages.length);
  const selectedPageIds = usePageStore((state) => state.selectedPageIds);
  const stitching = usePageStore((state) => state.stitching);

  const runningJobs = useJobStore((state) => state.jobs.filter((job) => job.status === 'running').length);
  const queuedJobs = useJobStore((state) => state.jobs.filter((job) => job.status === 'queued').length);

  const zoom = useEditorStore((state) => state.zoom);
  const cursorPos = useEditorStore((state) => state.cursorPosition);
  const tool = useEditorStore((state) => state.tool);
  const focusMode = useEditorStore((state) => state.focusMode);
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const labelsVisible = useEditorStore((state) => state.labelsVisible);
  const minimapVisible = useEditorStore((state) => state.minimapVisible);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const toggleLabels = useEditorStore((state) => state.toggleLabels);
  const toggleMinimap = useEditorStore((state) => state.toggleMinimap);

  const selectedRegionId = useRegionStore((state) => state.selectedRegionId);
  const regionCount = activePage?.regions.length ?? 0;
  const selectedRegion = activePage?.regions.find((region) => region.id === selectedRegionId);

  const toolLabels = {
    select: 'Выбор',
    draw: 'Рисование',
    pan: 'Панорама',
  } as const;

  return (
    <footer className="flex h-7 flex-none items-center gap-0 border-t border-zinc-800 bg-zinc-900 px-1 text-[11px] text-zinc-500 select-none">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex items-center gap-1 pl-1">
          <MousePointer2 size={11} />
          {toolLabels[tool]}
        </span>

        {activePage ? (
          <span className="max-w-48 truncate">
            {activePage.fileName}
            <span className="ml-1 text-zinc-600">
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

        <span className="flex items-center gap-1">
          <Layers size={11} />
          Регионов: {regionCount}
        </span>

        {selectedRegion && (
          <span className="max-w-32 truncate text-indigo-400">• {selectedRegion.label}</span>
        )}

        {(runningJobs > 0 || queuedJobs > 0) && (
          <span className="flex items-center gap-1 text-zinc-400">
            <ScanText size={11} />
            OCR: {runningJobs} active / {queuedJobs} queued
          </span>
        )}

        {focusMode && (
          <span className="flex items-center gap-1 text-zinc-400">
            <Focus size={11} />
            Focus mode
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={toggleGrid}
          className={`rounded p-1 transition-colors ${
            gridVisible ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
          }`}
          title="Сетка (G)"
        >
          <Grid3X3 size={12} />
        </button>

        <button
          onClick={toggleLabels}
          className={`rounded p-1 transition-colors ${
            labelsVisible ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
          }`}
          title="Подписи регионов"
        >
          <Tag size={12} />
        </button>

        <button
          onClick={toggleMinimap}
          className={`rounded p-1 transition-colors ${
            minimapVisible ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
          }`}
          title="Миникарта"
        >
          <Map size={12} />
        </button>

        <div className="mx-1 h-3.5 w-px bg-zinc-800" />

        <span className="w-24 text-right tabular-nums text-zinc-600">
          X:{Math.round(cursorPos.x)} Y:{Math.round(cursorPos.y)}
        </span>

        <div className="mx-1 h-3.5 w-px bg-zinc-800" />

        <span className="flex w-16 items-center justify-end gap-1 pr-1 tabular-nums">
          <ZoomIn size={11} />
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </footer>
  );
}
