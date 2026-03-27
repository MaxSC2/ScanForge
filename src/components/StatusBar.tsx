import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Focus,
  Grid3X3,
  Languages,
  Layers,
  LoaderCircle,
  Map,
  MousePointer2,
  Save,
  ScanText,
  Tag,
  ZoomIn,
} from 'lucide-react';
import { useEditorStore } from '../stores/useEditorStore';
import { useJobStore } from '../stores/useJobStore';
import { usePageStore } from '../stores/usePageStore';
import { usePersistenceStore } from '../stores/usePersistenceStore';
import { useRegionStore } from '../stores/useRegionStore';

function formatSavedAt(value: number | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value);
}

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
  const translationQueued = useJobStore(
    (state) =>
      state.jobs.filter((job) => job.stage === 'translate' && job.status !== 'done' && job.status !== 'failed')
        .length,
  );
  const ocrQueued = useJobStore(
    (state) =>
      state.jobs.filter((job) => job.stage === 'ocr' && job.status !== 'done' && job.status !== 'failed')
        .length,
  );

  const zoom = useEditorStore((state) => state.zoom);
  const cursorPos = useEditorStore((state) => state.cursorPosition);
  const tool = useEditorStore((state) => state.tool);
  const focusMode = useEditorStore((state) => state.focusMode);
  const viewMode = useEditorStore((state) => state.viewMode);
  const regionOverlaysVisible = useEditorStore((state) => state.regionOverlaysVisible);
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const labelsVisible = useEditorStore((state) => state.labelsVisible);
  const minimapVisible = useEditorStore((state) => state.minimapVisible);
  const toggleRegionOverlays = useEditorStore((state) => state.toggleRegionOverlays);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const toggleLabels = useEditorStore((state) => state.toggleLabels);
  const toggleMinimap = useEditorStore((state) => state.toggleMinimap);

  const selectedRegionId = useRegionStore((state) => state.selectedRegionId);
  const regionCount = activePage?.regions.length ?? 0;
  const selectedRegion = activePage?.regions.find((region) => region.id === selectedRegionId);
  const saveState = usePersistenceStore((state) => state.saveState);
  const lastSavedAt = usePersistenceStore((state) => state.lastSavedAt);
  const lastError = usePersistenceStore((state) => state.lastError);
  const recoveryNotice = usePersistenceStore((state) => state.recoveryNotice);

  const toolLabels = {
    select: 'Выбор',
    draw: 'Рисование',
    pan: 'Панорама',
  } as const;

  const viewModeLabel = {
    manual: 'Manual',
    'fit-page': 'Fit page',
    'fit-width': 'Fit width',
    actual: '1:1',
  } as const;

  const savedAtLabel = formatSavedAt(lastSavedAt);

  const persistencePresentation =
    saveState === 'saving'
      ? {
          label: 'Saving...',
          title: 'Local project autosave is in progress',
          icon: <LoaderCircle size={11} className="animate-spin" />,
          className: 'text-indigo-400',
        }
      : saveState === 'pending'
        ? {
            label: 'Autosave pending',
            title: 'Local project changes are queued for autosave',
            icon: <Save size={11} />,
            className: 'text-zinc-400',
          }
        : saveState === 'error'
          ? {
              label: 'Autosave failed',
              title: lastError ?? 'Local project autosave failed',
              icon: <AlertTriangle size={11} />,
              className: 'text-amber-400',
            }
          : {
              label: savedAtLabel ? `Saved ${savedAtLabel}` : 'Autosave ready',
              title: savedAtLabel
                ? `Last local save completed at ${savedAtLabel}`
                : 'Local project autosave is ready',
              icon: <CheckCircle2 size={11} />,
              className: 'text-emerald-400',
            };

  return (
    <footer className="flex h-7 flex-none select-none items-center gap-0 border-t border-zinc-800 bg-zinc-900 px-1 text-[11px] text-zinc-500">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex items-center gap-1 pl-1">
          <MousePointer2 size={11} />
          {toolLabels[tool]}
        </span>

        {activePage ? (
          <span className="max-w-48 truncate">
            {activePage.fileName}
            <span className="ml-1 text-zinc-600">
              {activePage.naturalWidth}x{activePage.naturalHeight}
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

        <span className="text-zinc-600">View: {viewModeLabel[viewMode]}</span>

        {(runningJobs > 0 || queuedJobs > 0) && (
          <span className="flex items-center gap-1 text-zinc-400">
            <ScanText size={11} />
            Jobs: {runningJobs} active / {queuedJobs} queued
          </span>
        )}

        {translationQueued > 0 && (
          <span className="flex items-center gap-1 text-zinc-400">
            <Languages size={11} />
            TR: {translationQueued}
          </span>
        )}

        {ocrQueued > 0 && translationQueued === 0 && (
          <span className="text-zinc-600">OCR queue: {ocrQueued}</span>
        )}

        {focusMode && (
          <span className="flex items-center gap-1 text-zinc-400">
            <Focus size={11} />
            Focus mode
          </span>
        )}

        <span
          className={`flex items-center gap-1 ${persistencePresentation.className}`}
          title={persistencePresentation.title}
        >
          {persistencePresentation.icon}
          {persistencePresentation.label}
        </span>

        {recoveryNotice && (
          <span className="flex items-center gap-1 text-amber-400" title={recoveryNotice}>
            <AlertTriangle size={11} />
            Recovery warning
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
          onClick={toggleRegionOverlays}
          className={`rounded p-1 transition-colors ${
            regionOverlaysVisible ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
          }`}
          title="Показать или скрыть region overlays"
        >
          {regionOverlaysVisible ? <Eye size={12} /> : <EyeOff size={12} />}
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
