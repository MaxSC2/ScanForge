import { type ReactNode, useRef, useState } from 'react';
import {
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
  RotateCcw,
  Save,
  ScanText,
  Square,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { IconButton } from '../../components/IconButton';
import { StitchDialog } from '../../components/StitchDialog';
import { exportRenderedPageAsPng } from '../export/renderExport';
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
  const [stitchDialogOpen, setStitchDialogOpen] = useState(false);

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

  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);
  const canUndo = useHistoryStore((state) => state.canUndo);
  const canRedo = useHistoryStore((state) => state.canRedo);
  const clearHistory = useHistoryStore((state) => state.clear);

  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const focusMode = useEditorStore((state) => state.focusMode);
  const cleanView = useEditorStore((state) => state.cleanView);
  const translationOverwrite = useEditorStore((state) => state.translationOverwrite);
  const toggleFocusMode = useEditorStore((state) => state.toggleFocusMode);
  const toggleCleanView = useEditorStore((state) => state.toggleCleanView);
  const toggleTranslationOverwrite = useEditorStore((state) => state.toggleTranslationOverwrite);
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
  const ocrTargetPageIds =
    selectedPageIds.length > 0 ? selectedPageIds : activePageId ? [activePageId] : [];
  const translationTargets =
    selectedRegionId && activePageId
      ? [{ pageId: activePageId, regionIds: [selectedRegionId] }]
      : (selectedPageIds.length > 0 ? selectedPageIds : activePageId ? [activePageId] : []).map(
          (pageId) => ({ pageId }),
        );

  const canStitch = selectedPageIds.length >= 2 && !stitching;
  const canRunOcr = ocrTargetPageIds.length > 0;
  const canRunTranslation = translationTargets.length > 0;

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
    const queued = queueOcrJobs(ocrTargetPageIds);
    if (queued === 0) {
      pushToast('OCR уже выполняется для выбранных страниц или страницы не выбраны', 'warning');
    }
  };

  const handleTranslate = () => {
    const queued = queueTranslationJobs(translationTargets);
    if (queued === 0) {
      pushToast('Translation already queued for the selected target or nothing is selected', 'warning');
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

    try {
      const saved = await exportRenderedPageAsPng(activePage);
      if (saved) {
        pushToast(`Рендер экспортирован: ${activePage.fileName}`, 'success');
      }
    } catch {
      pushToast('Не удалось экспортировать рендер страницы', 'error');
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
        tooltip="Run translation for the selected page or region (Ctrl+Shift+T)"
        disabled={!canRunTranslation}
      >
        <Languages size={14} />
        <span className="hidden xl:inline">Translate</span>
      </IconButton>

      <IconButton
        active={translationOverwrite}
        onClick={toggleTranslationOverwrite}
        tooltip="Overwrite existing translations when running translation"
        variant="ghost"
      >
        <RotateCcw size={14} />
        <span className="hidden 2xl:inline">Overwrite</span>
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
        <IconButton
          active={focusMode}
          onClick={toggleFocusMode}
          tooltip="Focus mode: панели открываются поверх холста (Ctrl+.)"
          variant="ghost"
        >
          <Focus size={14} />
        </IconButton>

        <IconButton
          active={cleanView}
          onClick={toggleCleanView}
          tooltip="Clean view: скрыть весь UI кроме холста (Ctrl+Shift+.)"
          variant="ghost"
        >
          <Maximize size={14} />
        </IconButton>

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

      <div className="ml-2 flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/70 p-1">
        <ViewPresetButton
          label="1:1"
          active={viewMode === 'actual'}
          onClick={requestActualSize}
          title="Показать в 100%"
        />
        <ViewPresetButton
          label="Width"
          active={viewMode === 'fit-width'}
          onClick={requestFitToWidth}
          title="Подогнать по ширине"
        />
        <ViewPresetButton
          label="Page"
          active={viewMode === 'fit-page'}
          onClick={requestFitToPage}
          title="Подогнать в окно"
        />
        <IconButton
          active={!regionOverlaysVisible}
          onClick={toggleRegionOverlays}
          tooltip="Показать или скрыть region overlays"
          variant="ghost"
        >
          {regionOverlaysVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </IconButton>
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

function ViewPresetButton({
  label,
  active,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
        active
          ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/20'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
      }`}
    >
      {label}
    </button>
  );
}
