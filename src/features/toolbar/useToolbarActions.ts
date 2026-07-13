import { useMemo } from 'react';
import { pickRenderedPageExportPath } from '../export/renderExport';
import { useJobStore } from '../../stores/useJobStore';
import { usePageStore } from '../../stores/usePageStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useRegionStore } from '../../stores/useRegionStore';
import { useToastStore } from '../../stores/useToastStore';
import { useEditorStore } from '../../stores/useEditorStore';
import {
  exportPageImage,
  hydrateProjectFile,
  openProjectFile,
  saveProjectFile,
} from '../../utils/persistence';
import { getStitchPreview, suggestSafeStitch } from '../../utils/stitch';
import { isDesktopRuntime } from '../../utils/runtime';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { buildOcrTargets, buildTranslationTargets } from './toolbarTargets';
import { importFolder } from '../../services/batchImport';

export function useToolbarActions() {
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

  const clearHistory = useHistoryStore((state) => state.clear);

  const pushToast = useToastStore((state) => state.push);
  const setMeta = useProjectStore((state) => state.setMeta);
  const selectedRegionId = useRegionStore((state) => state.selectedRegionId);

  const activePage = activePageId ? pages.find((page) => page.id === activePageId) : null;
  const selectedSet = useMemo(() => new Set(selectedPageIds), [selectedPageIds]);
  const selectedPagesInOrder = useMemo(
    () => pages.filter((page) => selectedSet.has(page.id)),
    [pages, selectedSet],
  );

  const ocrTargets = useMemo(
    () =>
      buildOcrTargets({
        activePageId,
        selectedPageIds,
        selectedRegionId,
      }),
    [activePageId, selectedPageIds, selectedRegionId],
  );
  const translationTargets = useMemo(
    () =>
      buildTranslationTargets({
        activePageId,
        selectedPageIds,
        selectedRegionId,
      }),
    [activePageId, selectedPageIds, selectedRegionId],
  );

  const canStitch = selectedPageIds.length >= 2 && !stitching;
  const canRunOcr = ocrTargets.length > 0;
  const canRunTranslation = translationTargets.length > 0;

  const stitchPreview = useMemo(
    () =>
      selectedPagesInOrder.length >= 2
        ? getStitchPreview(
            selectedPagesInOrder.map((page) => ({
              width: page.naturalWidth,
              height: page.naturalHeight,
            })),
            stitchOptions,
          )
        : null,
    [selectedPagesInOrder, stitchOptions],
  );

  const safeSuggestion = useMemo(
    () =>
      selectedPagesInOrder.length >= 2
        ? suggestSafeStitch(
            selectedPagesInOrder.map((page) => ({
              width: page.naturalWidth,
              height: page.naturalHeight,
            })),
            stitchOptions,
          )
        : null,
    [selectedPagesInOrder, stitchOptions],
  );

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      void addPages(files).then((count) => {
        pushToast(`Загружено страниц: ${count}`, 'success');
      });
    }
    event.target.value = '';
  };

  const handleImportFolder = async () => {
    const files = await importFolder();
    if (files.length > 0) {
      void addPages(files).then((count) => {
        pushToast(`Загружена глава: ${count} страниц`, 'success');
      });
    }
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
      pushToast('OCR уже выполняется для выбранных страниц или страница не выбраны', 'warning');
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
    if (!outputPath && isDesktopRuntime()) {
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
      useEditorStore.getState().requestFitToPage();
    } catch {
      pushToast('Не удалось открыть проект', 'error');
    }
  };

  return {
    activePage,
    selectedPageIds,
    stitchOptions,
    setStitchOptions,
    stitchPages,
    canStitch,
    canRunOcr,
    canRunTranslation,
    canProcessAll: pages.length > 0,
    stitchPreview,
    safeSuggestion,
    handleFiles,
    handleImportFolder,
    handleStitch,
    handleOcr,
    handleTranslate,
    handleSaveProject,
    handleExportActive,
    handleOpenProject,
  };
}
