import { useRef, useState } from 'react';
import { usePageStore } from '../../stores/usePageStore';
import { useEditorStore, type EditorTool } from '../../stores/useEditorStore';
import { useToastStore } from '../../stores/useToastStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { IconButton } from '../../components/IconButton';
import { StitchDialog } from '../../components/StitchDialog';
import {
  exportPageImage,
  hydrateProjectFile,
  openProjectFile,
  saveProjectFile,
} from '../../utils/persistence';
import { getStitchPreview, suggestSafeStitch } from '../../utils/stitch';
import {
  FolderOpen,
  FileJson,
  Save,
  Download,
  MousePointer2,
  Square,
  Hand,
  Combine,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
} from 'lucide-react';

export function Toolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stitchDialogOpen, setStitchDialogOpen] = useState(false);
  const addPages = usePageStore((s) => s.addPages);
  const setProjectState = usePageStore((s) => s.setProjectState);
  const toProjectFile = usePageStore((s) => s.toProjectFile);
  const selectedPageIds = usePageStore((s) => s.selectedPageIds);
  const activePageId = usePageStore((s) => s.activePageId);
  const pages = usePageStore((s) => s.pages);
  const stitchOptions = usePageStore((s) => s.stitchOptions);
  const setStitchOptions = usePageStore((s) => s.setStitchOptions);
  const stitchPages = usePageStore((s) => s.stitchPages);
  const stitching = usePageStore((s) => s.stitching);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const clearHistory = useHistoryStore((s) => s.clear);
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const zoom = useEditorStore((s) => s.zoom);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const resetZoom = useEditorStore((s) => s.resetZoom);
  const requestFitToPage = useEditorStore((s) => s.requestFitToPage);
  const pushToast = useToastStore((s) => s.push);
  const setMeta = useProjectStore((s) => s.setMeta);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) {
      addPages(files);
      pushToast(`Загружено страниц: ${files.length}`, 'success');
    }
    e.target.value = '';
  };

  const tools: { id: EditorTool; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { id: 'select', icon: <MousePointer2 size={14} />, label: 'Выбор', shortcut: 'V' },
    { id: 'draw', icon: <Square size={14} />, label: 'Рисование региона', shortcut: 'R' },
    { id: 'pan', icon: <Hand size={14} />, label: 'Панорама', shortcut: 'H' },
  ];

  const canStitch = selectedPageIds.length >= 2 && !stitching;
  const activePage = activePageId ? pages.find((page) => page.id === activePageId) : null;
  const selectedSet = new Set(selectedPageIds);
  const selectedPagesInOrder = pages.filter((page) => selectedSet.has(page.id));
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

  const handleStitch = async () => {
    if (!canStitch) return;
    const page = await stitchPages(selectedPageIds, stitchOptions);
    if (page) {
      if (stitchOptions.exportAfterStitch) {
        await exportPageImage(page);
      }
      pushToast(
        `Создано: ${page.fileName}. Страниц: ${selectedPageIds.length}`,
        'success',
      );
    } else {
      pushToast('Выбери минимум две страницы для склейки', 'info');
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
      const saved = await exportPageImage(activePage);
      if (saved) {
        pushToast(`Экспортировано: ${activePage.fileName}`, 'success');
      }
    } catch {
      pushToast('Не удалось экспортировать изображение', 'error');
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
      clearHistory();
      pushToast('Проект загружен', 'success');
      requestFitToPage();
    } catch {
      pushToast('Не удалось открыть проект', 'error');
    }
  };

  return (
    <>
      {/* Brand */}
      <div className="flex items-center gap-2 mr-3">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-black">
          SF
        </div>
        <span className="text-sm font-bold tracking-wide text-zinc-200 hidden lg:inline">
          ScanForge
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-zinc-700/60" />

      {/* File loader */}
      <IconButton
        onClick={() => fileRef.current?.click()}
        tooltip="Открыть изображения"
      >
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

      <IconButton
        onClick={handleOpenProject}
        tooltip="Открыть файл проекта (.scanforge.json)"
      >
        <FileJson size={14} />
        <span className="hidden xl:inline">Открыть проект</span>
      </IconButton>

      <IconButton onClick={handleSaveProject} tooltip="Сохранить проект">
        <Save size={14} />
        <span className="hidden xl:inline">Сохранить</span>
      </IconButton>

      <IconButton
        onClick={handleExportActive}
        tooltip="Экспорт активной страницы в PNG (Ctrl+Shift+E)"
        disabled={!activePage}
      >
        <Download size={14} />
        <span className="hidden xl:inline">Экспорт PNG</span>
      </IconButton>

      <IconButton
        onClick={() => setStitchDialogOpen(true)}
        tooltip="Склеить выбранные страницы (Ctrl+M)"
        disabled={!canStitch}
      >
        <Combine size={14} />
        <span className="hidden xl:inline">Склеить</span>
      </IconButton>

      {/* Separator */}
      <div className="w-px h-5 bg-zinc-700/60" />

      {/* Tools */}
      <div className="flex items-center gap-0.5 bg-zinc-800/50 p-0.5 rounded-lg">
        {tools.map((t) => (
          <IconButton
            key={t.id}
            active={tool === t.id}
            onClick={() => setTool(t.id)}
            tooltip={`${t.label} (${t.shortcut})`}
            variant="ghost"
          >
            {t.icon}
          </IconButton>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      <div className="flex items-center gap-0.5 mr-2">
        <IconButton onClick={undo} disabled={!canUndo} tooltip="Отменить (Ctrl+Z)" variant="ghost">
          <Undo2 size={14} />
        </IconButton>
        <IconButton onClick={redo} disabled={!canRedo} tooltip="Повторить (Ctrl+Shift+Z)" variant="ghost">
          <Redo2 size={14} />
        </IconButton>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5">
        <IconButton onClick={zoomOut} tooltip="Уменьшить (Ctrl+−)" variant="ghost">
          <ZoomOut size={14} />
        </IconButton>

        <button
          onClick={resetZoom}
          className="h-7 px-2 rounded text-[11px] tabular-nums text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Сбросить масштаб (Ctrl+0)"
        >
          {Math.round(zoom * 100)}%
        </button>

        <IconButton onClick={zoomIn} tooltip="Увеличить (Ctrl+=)" variant="ghost">
          <ZoomIn size={14} />
        </IconButton>

        <IconButton onClick={requestFitToPage} tooltip="Подогнать в окно" variant="ghost">
          <Maximize size={14} />
        </IconButton>

        <IconButton onClick={resetZoom} tooltip="Сбросить вид (Ctrl+0)" variant="ghost">
          <RotateCcw size={14} />
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
          if (safeSuggestion) {
            setStitchOptions(safeSuggestion.patch);
              pushToast(`Применен безопасный размер: ${safeSuggestion.targetCrossAxis}px`, 'info');
          }
        }}
          onAutoFixAndSubmit={async () => {
            if (!safeSuggestion) return;
            const nextOptions = { ...stitchOptions, ...safeSuggestion.patch };
            setStitchOptions(safeSuggestion.patch);
            const page = await stitchPages(selectedPageIds, nextOptions);
            if (page) {
              if (nextOptions.exportAfterStitch) {
                await exportPageImage(page);
              }
              pushToast(
                `Автофикс применен (${safeSuggestion.targetCrossAxis}px), склейка выполнена`,
                'success',
              );
              setStitchDialogOpen(false);
            }
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
