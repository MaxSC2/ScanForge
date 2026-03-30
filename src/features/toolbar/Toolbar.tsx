import { type ReactNode, useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import {
  Check,
  ChevronDown,
  Combine,
  Download,
  Eye,
  EyeOff,
  FileJson,
  Focus,
  FolderOpen,
  Hand,
  Languages,
  Maximize,
  MousePointer2,
  Redo2,
  Save,
  ScanText,
  Square,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { IconButton } from '../../components/IconButton';
import { StitchDialog } from '../../components/StitchDialog';
import { pickRenderedPageExportPath } from '../export/renderExport';
import { useEditorStore, type EditorTool } from '../../stores/useEditorStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useJobStore } from '../../stores/useJobStore';
import { usePageStore } from '../../stores/usePageStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useRegionStore } from '../../stores/useRegionStore';
import { useToastStore } from '../../stores/useToastStore';
import {
  exportPageImage,
  hydrateProjectFile,
  openProjectFile,
  saveProjectFile,
} from '../../utils/persistence';
import { getStitchPreview, suggestSafeStitch } from '../../utils/stitch';

export function Toolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const [stitchDialogOpen, setStitchDialogOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  const addPages = usePageStore((state) => state.addPages);
  const setProjectState = usePageStore((state) => state.setProjectState);
  const toProjectFile = usePageStore((state) => state.toProjectFile);
  const selectedPageIds = usePageStore((state) => state.selectedPageIds);
  const activePageId = usePageStore((state) => state.activePageId);
  const pages = usePageStore((state) => state.pages);
  const stitchOptions = usePageStore((state) => state.stitchOptions);
  const setStitchOptions = usePageStore((state) => state.setStitchOptions);
  const stitchPages = usePageStore((state) => state.stitchPages);
  const stitching = usePageStore((state) => state.stitching);

  const queueOcrJobs = useJobStore((state) => state.queueOcrJobs);
  const queueTranslationJobs = useJobStore((state) => state.queueTranslationJobs);
  const queueExportJobs = useJobStore((state) => state.queueExportJobs);

  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);
  const canUndo = useHistoryStore((state) => state.canUndo);
  const canRedo = useHistoryStore((state) => state.canRedo);
  const clearHistory = useHistoryStore((state) => state.clear);

  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const focusMode = useEditorStore((state) => state.focusMode);
  const cleanView = useEditorStore((state) => state.cleanView);
  const toggleFocusMode = useEditorStore((state) => state.toggleFocusMode);
  const toggleCleanView = useEditorStore((state) => state.toggleCleanView);
  const viewMode = useEditorStore((state) => state.viewMode);
  const regionOverlaysVisible = useEditorStore((state) => state.regionOverlaysVisible);
  const requestFitToPage = useEditorStore((state) => state.requestFitToPage);
  const requestFitToWidth = useEditorStore((state) => state.requestFitToWidth);
  const requestActualSize = useEditorStore((state) => state.requestActualSize);
  const toggleRegionOverlays = useEditorStore((state) => state.toggleRegionOverlays);
  const zoom = useEditorStore((state) => state.zoom);
  const zoomIn = useEditorStore((state) => state.zoomIn);
  const zoomOut = useEditorStore((state) => state.zoomOut);
  const resetZoom = useEditorStore((state) => state.resetZoom);

  const pushToast = useToastStore((state) => state.push);
  const setMeta = useProjectStore((state) => state.setMeta);
  const selectedRegionId = useRegionStore((state) => state.selectedRegionId);

  const activePage = activePageId ? pages.find((page) => page.id === activePageId) : null;
  const selectedSet = new Set(selectedPageIds);
  const selectedPagesInOrder = pages.filter((page) => selectedSet.has(page.id));
  const ocrTargets =
    selectedRegionId && activePageId
      ? [{ pageId: activePageId, regionIds: [selectedRegionId] }]
      : (selectedPageIds.length > 0 ? selectedPageIds : activePageId ? [activePageId] : []).map(
          (pageId) => ({ pageId }),
        );
  const translationTargets =
    selectedRegionId && activePageId
      ? [{ pageId: activePageId, regionIds: [selectedRegionId] }]
      : (selectedPageIds.length > 0 ? selectedPageIds : activePageId ? [activePageId] : []).map(
          (pageId) => ({ pageId }),
        );

  const canStitch = selectedPageIds.length >= 2 && !stitching;
  const canRunOcr = ocrTargets.length > 0;
  const canRunTranslation = translationTargets.length > 0;
  const viewModeLabel = {
    manual: 'Ручной',
    'fit-page': 'По странице',
    'fit-width': 'По ширине',
    actual: '1:1',
  } as const;

  const tools: { id: EditorTool; icon: ReactNode; label: string; shortcut: string }[] = [
    { id: 'select', icon: <MousePointer2 size={14} />, label: 'Выбор', shortcut: 'V' },
    { id: 'draw', icon: <Square size={14} />, label: 'Рисование региона', shortcut: 'R' },
    { id: 'pan', icon: <Hand size={14} />, label: 'Панорама', shortcut: 'H' },
  ];

  const stitchPreview =
    selectedPagesInOrder.length >= 2
      ? getStitchPreview(
          selectedPagesInOrder.map((page) => ({
            width: page.naturalWidth,
            height: page.naturalHeight,
          })),
          stitchOptions,
        )
      : null;

  const safeSuggestion =
    selectedPagesInOrder.length >= 2
      ? suggestSafeStitch(
          selectedPagesInOrder.map((page) => ({
            width: page.naturalWidth,
            height: page.naturalHeight,
          })),
          stitchOptions,
        )
      : null;

  useEffect(() => {
    if (!viewMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!viewMenuRef.current?.contains(event.target as Node)) {
        setViewMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setViewMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [viewMenuOpen]);

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      void addPages(files);
      pushToast(`Загружено страниц: ${files.length}`, 'success');
    }
    event.target.value = '';
  };

  const handleStitch = async () => {
    if (!canStitch) return;
    const page = await stitchPages(selectedPageIds, stitchOptions);

    if (!page) {
      pushToast('Выбери минимум две страницы для склейки', 'info');
      return;
    }

    if (stitchOptions.exportAfterStitch) {
      await exportPageImage(page);
    }

    pushToast(`Создано: ${page.fileName}. Страниц: ${selectedPageIds.length}`, 'success');
  };

  const handleOcr = () => {
    const queued = queueOcrJobs(ocrTargets);
    if (queued === 0) {
      pushToast('OCR уже выполняется для выбранных страниц или страницы не выбраны', 'warning');
    }
  };

  const handleTranslate = () => {
    const queued = queueTranslationJobs(translationTargets);
    if (queued === 0) {
      pushToast('Перевод уже стоит в очереди для выбранной цели или ничего не выбрано', 'warning');
    }
  };

  const handleSaveProject = async () => {
    try {
      const data = await toProjectFile();
      await saveProjectFile(data);
      pushToast('Проект сохранен', 'success');
    } catch {
      pushToast('Не удалось сохранить проект', 'error');
    }
  };

  const handleExportActive = async () => {
    if (!activePage) return;

    const outputPath = await pickRenderedPageExportPath(activePage);
    if (!outputPath && isTauri()) {
      return;
    }

    const queued = queueExportJobs([
      {
        pageId: activePage.id,
        ...(outputPath ? { outputPath } : {}),
      },
    ]);
    if (queued === 0) {
      pushToast('Экспорт уже стоит в очереди для активной страницы или страница не выбрана', 'warning');
    }
  };

  const handleOpenProject = async () => {
    try {
      const data = await openProjectFile();
      if (!data) return;

      const hydrated = await hydrateProjectFile(data);
      setMeta(hydrated.meta);
      setProjectState({
        pages: hydrated.pages,
        activePageId: hydrated.activePageId,
      });
      await useJobStore.getState().loadJobsForCurrentProject();
      clearHistory();
      pushToast('Проект загружен', 'success');
      requestFitToPage();
    } catch {
      pushToast('Не удалось открыть проект', 'error');
    }
  };

  return (
    <>
      <div className="mr-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-black text-white">
          SF
        </div>
        <span className="hidden text-sm font-bold tracking-wide text-zinc-200 lg:inline">
          ScanForge
        </span>
      </div>

      <div className="h-5 w-px bg-zinc-700/60" />

      <IconButton onClick={() => fileRef.current?.click()} tooltip="Открыть изображения">
        <FolderOpen size={14} />
        <span className="hidden sm:inline">Открыть</span>
      </IconButton>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <IconButton onClick={handleOpenProject} tooltip="Открыть файл проекта (.scanforge.json)">
        <FileJson size={14} />
        <span className="hidden xl:inline">Открыть проект</span>
      </IconButton>

      <IconButton onClick={handleSaveProject} tooltip="Сохранить проект">
        <Save size={14} />
        <span className="hidden xl:inline">Сохранить</span>
      </IconButton>

      <IconButton
        onClick={handleExportActive}
        tooltip="Экспорт рендера активной страницы в PNG (Ctrl+Shift+E)"
        disabled={!activePage}
      >
        <Download size={14} />
        <span className="hidden xl:inline">Рендер PNG</span>
      </IconButton>

      <IconButton
        onClick={handleOcr}
        tooltip="Запустить OCR по выбранным страницам (Ctrl+Shift+O)"
        disabled={!canRunOcr}
      >
        <ScanText size={14} />
        <span className="hidden xl:inline">OCR</span>
      </IconButton>

      <IconButton
        onClick={handleTranslate}
        tooltip="Запустить перевод для выбранной страницы или региона (Ctrl+Shift+T)"
        disabled={!canRunTranslation}
      >
        <Languages size={14} />
        <span className="hidden xl:inline">Перевод</span>
      </IconButton>

      <IconButton
        onClick={() => setStitchDialogOpen(true)}
        tooltip="Склеить выбранные страницы (Ctrl+M)"
        disabled={!canStitch}
      >
        <Combine size={14} />
        <span className="hidden xl:inline">Склеить</span>
      </IconButton>

      <div className="h-5 w-px bg-zinc-700/60" />

      <div className="flex items-center gap-0.5 rounded-lg bg-zinc-800/50 p-0.5">
        {tools.map((item) => (
          <IconButton
            key={item.id}
            active={tool === item.id}
            onClick={() => setTool(item.id)}
            tooltip={`${item.label} (${item.shortcut})`}
            variant="ghost"
          >
            {item.icon}
          </IconButton>
        ))}
      </div>

      <div className="flex-1" />

      <div className="mr-2 flex items-center gap-0.5">
        <IconButton onClick={undo} disabled={!canUndo} tooltip="Отменить (Ctrl+Z)" variant="ghost">
          <Undo2 size={14} />
        </IconButton>
        <IconButton
          onClick={redo}
          disabled={!canRedo}
          tooltip="Повторить (Ctrl+Shift+Z)"
          variant="ghost"
        >
          <Redo2 size={14} />
        </IconButton>
      </div>

      <div className="flex items-center gap-0.5">
        <IconButton onClick={zoomOut} tooltip="Уменьшить (Ctrl+-)" variant="ghost">
          <ZoomOut size={14} />
        </IconButton>

        <button
          onClick={resetZoom}
          className="h-7 rounded px-2 text-[11px] tabular-nums text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          title="Ручной сброс масштаба (Ctrl+0)"
        >
          {Math.round(zoom * 100)}%
        </button>

        <IconButton onClick={zoomIn} tooltip="Увеличить (Ctrl+=)" variant="ghost">
          <ZoomIn size={14} />
        </IconButton>
      </div>

      <div ref={viewMenuRef} className="relative z-10 ml-2">
        <button
          type="button"
          onClick={() => setViewMenuOpen((state) => !state)}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          title="Настройки просмотра"
        >
          <Eye size={14} className="text-zinc-500" />
          <span>Вид</span>
          <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {viewModeLabel[viewMode]}
          </span>
          <ChevronDown
            size={13}
            className={`text-zinc-500 transition-transform ${viewMenuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {viewMenuOpen && (
          <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-52 rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Просмотр
            </div>

            <ViewMenuItem
              label="Реальный масштаб"
              hint="1:1"
              active={viewMode === 'actual'}
              onClick={requestActualSize}
            />
            <ViewMenuItem
              label="По ширине"
              hint="Ширина"
              active={viewMode === 'fit-width'}
              onClick={requestFitToWidth}
            />
            <ViewMenuItem
              label="По странице"
              hint="Страница"
              active={viewMode === 'fit-page'}
              onClick={requestFitToPage}
            />

            <div className="my-1 h-px bg-zinc-800" />

            <ViewMenuItem
              icon={regionOverlaysVisible ? <Eye size={13} /> : <EyeOff size={13} />}
              label="Оверлеи регионов"
              hint={regionOverlaysVisible ? 'Показаны' : 'Скрыты'}
              active={regionOverlaysVisible}
              onClick={toggleRegionOverlays}
            />
            <ViewMenuItem
              icon={<Focus size={13} />}
              label="Фокус-режим"
              hint="Ctrl+."
              active={focusMode}
              onClick={toggleFocusMode}
            />
            <ViewMenuItem
              icon={<Maximize size={13} />}
              label="Чистый режим"
              hint="Ctrl+Shift+."
              active={cleanView}
              onClick={toggleCleanView}
            />
          </div>
        )}
      </div>

      <StitchDialog
        open={stitchDialogOpen}
        value={stitchOptions}
        preview={stitchPreview}
        safeSuggestion={safeSuggestion}
        onClose={() => setStitchDialogOpen(false)}
        onChange={setStitchOptions}
        onAutoFix={() => {
          if (!safeSuggestion) return;
          setStitchOptions(safeSuggestion.patch);
          pushToast(`Применен безопасный размер: ${safeSuggestion.targetCrossAxis}px`, 'info');
        }}
        onAutoFixAndSubmit={async () => {
          if (!safeSuggestion) return;

          const nextOptions = { ...stitchOptions, ...safeSuggestion.patch };
          setStitchOptions(safeSuggestion.patch);
          const page = await stitchPages(selectedPageIds, nextOptions);

          if (!page) return;
          if (nextOptions.exportAfterStitch) {
            await exportPageImage(page);
          }

          pushToast(
            `Автофикс применен (${safeSuggestion.targetCrossAxis}px), склейка выполнена`,
            'success',
          );
          setStitchDialogOpen(false);
        }}
        onSubmit={async () => {
          if (stitchPreview?.safety.maxAreaExceeded || stitchPreview?.safety.maxDimensionExceeded) {
            pushToast('Склейка заблокирована: превышены безопасные лимиты canvas', 'error');
            return;
          }

          await handleStitch();
          setStitchDialogOpen(false);
        }}
      />
    </>
  );
}

function ViewMenuItem({
  icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-medium transition-colors ${
        active
          ? 'bg-indigo-500/15 text-indigo-200'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
      }`}
    >
      <span className={`flex h-5 w-5 items-center justify-center rounded-md ${active ? 'bg-indigo-500/10 text-indigo-300' : 'bg-zinc-900 text-zinc-500'}`}>
        {icon ?? <Check size={12} className={active ? 'opacity-100' : 'opacity-0'} />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint ? <span className="text-[10px] text-zinc-500">{hint}</span> : null}
    </button>
  );
}
