import { useEffect } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useJobStore } from '../stores/useJobStore';
import { usePageStore } from '../stores/usePageStore';
import { useRegionStore } from '../stores/useRegionStore';
import { pickRenderedPageExportPath } from '../features/export/renderExport';
import { isDesktopRuntime } from '../utils/runtime';
import { matchEvent, useShortcutsStore } from '../stores/useShortcutsStore';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const b = (id: string) => useShortcutsStore.getState().getBinding(id);

      if (matchEvent(event, b('tool_select'))) {
        event.preventDefault();
        useEditorStore.getState().setTool('select');
        return;
      }

      if (matchEvent(event, b('tool_draw'))) {
        event.preventDefault();
        useEditorStore.getState().setTool('draw');
        return;
      }

      if (matchEvent(event, b('tool_pan'))) {
        event.preventDefault();
        useEditorStore.getState().setTool('pan');
        return;
      }

      if (matchEvent(event, b('delete_region'))) {
        const store = useRegionStore.getState();
        const pageId = usePageStore.getState().activePageId;
        if (!pageId) return;
        event.preventDefault();
        const ids = store.multiSelectedRegionIds.length > 0
          ? [store.selectedRegionId, ...store.multiSelectedRegionIds].filter(Boolean) as string[]
          : store.selectedRegionId ? [store.selectedRegionId] : [];
        for (const rid of [...new Set(ids)]) {
          store.deleteRegion(pageId, rid);
        }
        return;
      }

      if (matchEvent(event, b('escape'))) {
        const { cleanView, focusMode, sidebarOpen, inspectorOpen, setCleanView, toggleSidebar, toggleInspector } =
          useEditorStore.getState();
        if (cleanView) {
          setCleanView(false);
          return;
        }
        if (focusMode && (sidebarOpen || inspectorOpen)) {
          if (sidebarOpen) toggleSidebar();
          if (inspectorOpen) toggleInspector();
          return;
        }
        useRegionStore.getState().selectRegion(null);
        return;
      }

      if (matchEvent(event, b('zoom_in'))) {
        event.preventDefault();
        useEditorStore.getState().zoomIn();
        return;
      }

      if (matchEvent(event, b('zoom_out'))) {
        event.preventDefault();
        useEditorStore.getState().zoomOut();
        return;
      }

      if (matchEvent(event, b('zoom_reset'))) {
        event.preventDefault();
        useEditorStore.getState().resetZoom();
        return;
      }

      if (matchEvent(event, b('toggle_focus'))) {
        event.preventDefault();
        useEditorStore.getState().toggleFocusMode();
        return;
      }

      if (matchEvent(event, b('toggle_clean'))) {
        event.preventDefault();
        useEditorStore.getState().toggleCleanView();
        return;
      }

      if (matchEvent(event, b('next_page_clean')) && useEditorStore.getState().cleanView) {
        event.preventDefault();
        usePageStore.getState().goToAdjacentPage('next');
        return;
      }

      if (matchEvent(event, b('prev_page_clean')) && useEditorStore.getState().cleanView) {
        event.preventDefault();
        usePageStore.getState().goToAdjacentPage('previous');
        return;
      }

      if (matchEvent(event, b('view_actual'))) {
        event.preventDefault();
        useEditorStore.getState().requestActualSize();
        return;
      }

      if (matchEvent(event, b('view_fit_width'))) {
        event.preventDefault();
        useEditorStore.getState().requestFitToWidth();
        return;
      }

      if (matchEvent(event, b('view_fit_page'))) {
        event.preventDefault();
        useEditorStore.getState().requestFitToPage();
        return;
      }

      if (matchEvent(event, b('toggle_overlays'))) {
        event.preventDefault();
        useEditorStore.getState().toggleRegionOverlays();
        return;
      }

      if (matchEvent(event, b('queue_ocr'))) {
        const { activePageId, selectedPageIds } = usePageStore.getState();
        const selectedRegionId = useRegionStore.getState().selectedRegionId;
        const targets =
          selectedRegionId && activePageId
            ? [{ pageId: activePageId, regionIds: [selectedRegionId] }]
            : (selectedPageIds.length > 0
                ? selectedPageIds
                : activePageId
                  ? [activePageId]
                  : []
              ).map((pageId: string) => ({ pageId }));

        if (targets.length > 0) {
          event.preventDefault();
          useJobStore.getState().queueOcrJobs(targets);
        }
        return;
      }

      if (matchEvent(event, b('queue_translate'))) {
        const { activePageId, selectedPageIds } = usePageStore.getState();
        const selectedRegionId = useRegionStore.getState().selectedRegionId;
        const targets =
          selectedRegionId && activePageId
            ? [{ pageId: activePageId, regionIds: [selectedRegionId] }]
            : (selectedPageIds.length > 0
                ? selectedPageIds
                : activePageId
                  ? [activePageId]
                  : []
              ).map((pageId: string) => ({ pageId }));

        if (targets.length > 0) {
          event.preventDefault();
          useJobStore.getState().queueTranslationJobs(targets);
        }
        return;
      }

      if (matchEvent(event, b('stitch_pages'))) {
        const { selectedPageIds, stitchPages, stitchOptions } = usePageStore.getState();
        if (selectedPageIds.length >= 2) {
          event.preventDefault();
          void stitchPages(selectedPageIds, stitchOptions);
        }
        return;
      }

      if (matchEvent(event, b('export_png'))) {
        const { activePageId, pages } = usePageStore.getState();
        const page = activePageId ? pages.find((item) => item.id === activePageId) : null;
        if (page) {
          event.preventDefault();
          void (async () => {
            const outputPath = await pickRenderedPageExportPath(page);
            if (!outputPath && isDesktopRuntime()) return;
            useJobStore.getState().queueExportJobs([
              { pageId: page.id, ...(outputPath ? { outputPath } : {}) },
            ]);
          })();
        }
        return;
      }

      if (matchEvent(event, b('undo'))) {
        event.preventDefault();
        useHistoryStore.getState().undo();
        return;
      }

      if (matchEvent(event, b('redo'))) {
        event.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      if (matchEvent(event, b('toggle_sidebar'))) {
        event.preventDefault();
        useEditorStore.getState().toggleSidebar();
        return;
      }

      if (matchEvent(event, b('toggle_inspector'))) {
        event.preventDefault();
        useEditorStore.getState().toggleInspector();
        return;
      }

      if (matchEvent(event, b('select_all'))) {
        event.preventDefault();
        useRegionStore.getState().selectAllRegions();
        return;
      }

      if (matchEvent(event, b('duplicate_region'))) {
        event.preventDefault();
        const pageId = usePageStore.getState().activePageId;
        const regionId = useRegionStore.getState().selectedRegionId;
        if (pageId && regionId) {
          useRegionStore.getState().duplicateRegion(pageId, regionId);
        }
        return;
      }

      if (matchEvent(event, b('next_region'))) {
        event.preventDefault();
        const page = usePageStore.getState().getActivePage();
        if (!page || page.regions.length === 0) return;
        const sortedRegions = [...page.regions].sort((a, b) => a.order - b.order);
        const currentIdx = useRegionStore.getState().selectedRegionId
          ? sortedRegions.findIndex((r) => r.id === useRegionStore.getState().selectedRegionId)
          : -1;
        const nextIdx = (currentIdx + 1) % sortedRegions.length;
        useRegionStore.getState().selectRegion(sortedRegions[nextIdx].id);
        return;
      }

      if (matchEvent(event, b('prev_region'))) {
        event.preventDefault();
        const page = usePageStore.getState().getActivePage();
        if (!page || page.regions.length === 0) return;
        const sortedRegions = [...page.regions].sort((a, b) => a.order - b.order);
        const currentIdx = useRegionStore.getState().selectedRegionId
          ? sortedRegions.findIndex((r) => r.id === useRegionStore.getState().selectedRegionId)
          : -1;
        const prevIdx = (currentIdx - 1 + sortedRegions.length) % sortedRegions.length;
        useRegionStore.getState().selectRegion(sortedRegions[prevIdx].id);
        return;
      }

      if (matchEvent(event, b('bring_to_front'))) {
        event.preventDefault();
        const pageId = usePageStore.getState().activePageId;
        const regionId = useRegionStore.getState().selectedRegionId;
        if (!pageId || !regionId) return;
        const page = usePageStore.getState().getActivePage();
        if (!page) return;
        const sorted = [...page.regions].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((r) => r.id === regionId);
        if (idx < sorted.length - 1) {
          useRegionStore.getState().reorderRegions(pageId, idx, sorted.length - 1);
        }
        return;
      }

      if (matchEvent(event, b('send_to_back'))) {
        event.preventDefault();
        const pageId = usePageStore.getState().activePageId;
        const regionId = useRegionStore.getState().selectedRegionId;
        if (!pageId || !regionId) return;
        const page = usePageStore.getState().getActivePage();
        if (!page) return;
        const sorted = [...page.regions].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((r) => r.id === regionId);
        if (idx > 0) {
          useRegionStore.getState().reorderRegions(pageId, idx, 0);
        }
        return;
      }

      if (matchEvent(event, b('group_regions'))) {
        event.preventDefault();
        const store = useRegionStore.getState();
        const pageId = usePageStore.getState().activePageId;
        if (!pageId || !store.selectedRegionId) return;
        const newGroupId = crypto.randomUUID?.() ?? `${Date.now()}`;
        const ids = [store.selectedRegionId, ...store.multiSelectedRegionIds].filter(Boolean) as string[];
        for (const rid of [...new Set(ids)]) {
          store.updateRegion(pageId, rid, { groupId: newGroupId });
        }
        return;
      }

      if (matchEvent(event, b('ungroup_regions'))) {
        event.preventDefault();
        const store = useRegionStore.getState();
        const pageId = usePageStore.getState().activePageId;
        if (!pageId || !store.selectedRegionId) return;
        const ids = [store.selectedRegionId, ...store.multiSelectedRegionIds].filter(Boolean) as string[];
        for (const rid of [...new Set(ids)]) {
          store.updateRegion(pageId, rid, { groupId: undefined });
        }
        return;
      }

      if (matchEvent(event, b('toggle_grid'))) {
        event.preventDefault();
        useEditorStore.getState().toggleGrid();
        return;
      }

      const arrowIds = ['move_up', 'move_down', 'move_left', 'move_right',
                        'move_10_up', 'move_10_down', 'move_10_left', 'move_10_right',
                        'resize_up', 'resize_down', 'resize_left', 'resize_right'] as const;

      for (const arrowId of arrowIds) {
        if (matchEvent(event, b(arrowId))) {
          if (useEditorStore.getState().cleanView) {
            event.preventDefault();
            const dir = arrowId.includes('left') || arrowId.includes('up') ? 'previous' : 'next';
            usePageStore.getState().goToAdjacentPage(dir);
            return;
          }

          const pageId = usePageStore.getState().activePageId;
          const regionId = useRegionStore.getState().selectedRegionId;
          if (!pageId || !regionId) return;

          const page = usePageStore.getState().getActivePage();
          const region = page?.regions.find((item) => item.id === regionId);
          if (!region || region.locked) return;

          event.preventDefault();
          const delta = arrowId.startsWith('move_10') ? 10 : 1;
          const isResize = arrowId.startsWith('resize');

          const dx = arrowId.includes('left') ? -delta : arrowId.includes('right') ? delta : 0;
          const dy = arrowId.includes('up') ? -delta : arrowId.includes('down') ? delta : 0;

          const store = useRegionStore.getState();
          const multiIds = store.multiSelectedRegionIds;
          const allIds = multiIds.includes(regionId)
            ? multiIds
            : [regionId];

          if (isResize) {
            store.batchUpdateRegions(pageId, allIds, {
              width: Math.max(10, region.width + dx),
              height: Math.max(10, region.height + dy),
            });
          } else {
            for (const rid of allIds) {
              const r = page?.regions.find((item) => item.id === rid);
              if (!r || r.locked) continue;
              store.updateRegion(pageId, rid, {
                x: r.x + dx,
                y: r.y + dy,
              });
            }
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
