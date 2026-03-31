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
      void addPages(files);
      pushToast(`Р—Р°РіСЂСѓР¶РµРЅРѕ СЃС‚СЂР°РЅРёС†: ${files.length}`, 'success');
    }
    event.target.value = '';
  };

  const handleStitch = async () => {
    if (!canStitch) return;
    const page = await stitchPages(selectedPageIds, stitchOptions);

    if (!page) {
      pushToast('Р’С‹Р±РµСЂРё РјРёРЅРёРјСѓРј РґРІРµ СЃС‚СЂР°РЅРёС†С‹ РґР»СЏ СЃРєР»РµР№РєРё', 'info');
      return;
    }

    if (stitchOptions.exportAfterStitch) {
      await exportPageImage(page);
    }

    pushToast(`РЎРѕР·РґР°РЅРѕ: ${page.fileName}. РЎС‚СЂР°РЅРёС†: ${selectedPageIds.length}`, 'success');
  };

  const handleOcr = () => {
    const queued = queueOcrJobs(ocrTargets);
    if (queued === 0) {
      pushToast('OCR СѓР¶Рµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ РґР»СЏ РІС‹Р±СЂР°РЅРЅС‹С… СЃС‚СЂР°РЅРёС† РёР»Рё СЃС‚СЂР°РЅРёС†Р° РЅРµ РІС‹Р±СЂР°РЅС‹', 'warning');
    }
  };

  const handleTranslate = () => {
    const queued = queueTranslationJobs(translationTargets);
    if (queued === 0) {
      pushToast('РџРµСЂРµРІРѕРґ СѓР¶Рµ СЃС‚РѕРёС‚ РІ РѕС‡РµСЂРµРґРё РґР»СЏ РІС‹Р±СЂР°РЅРЅРѕР№ С†РµР»Рё РёР»Рё РЅРёС‡РµРіРѕ РЅРµ РІС‹Р±СЂР°РЅРѕ', 'warning');
    }
  };

  const handleSaveProject = async () => {
    try {
      const data = await toProjectFile();
      await saveProjectFile(data);
      pushToast('РџСЂРѕРµРєС‚ СЃРѕС…СЂР°РЅРµРЅ', 'success');
    } catch {
      pushToast('РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕРµРєС‚', 'error');
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
      pushToast('Р­РєСЃРїРѕСЂС‚ СѓР¶Рµ СЃС‚РѕРёС‚ РІ РѕС‡РµСЂРµРґРё РґР»СЏ Р°РєС‚РёРІРЅРѕР№ СЃС‚СЂР°РЅРёС†С‹ РёР»Рё СЃС‚СЂР°РЅРёС†Р° РЅРµ РІС‹Р±СЂР°РЅР°', 'warning');
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
      pushToast('РџСЂРѕРµРєС‚ Р·Р°РіСЂСѓР¶РµРЅ', 'success');
      useEditorStore.getState().requestFitToPage();
    } catch {
      pushToast('РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєСЂС‹С‚СЊ РїСЂРѕРµРєС‚', 'error');
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
    stitchPreview,
    safeSuggestion,
    handleFiles,
    handleStitch,
    handleOcr,
    handleTranslate,
    handleSaveProject,
    handleExportActive,
    handleOpenProject,
  };
}
