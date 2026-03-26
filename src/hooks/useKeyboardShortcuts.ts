import { useEffect } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useJobStore } from '../stores/useJobStore';
import { usePageStore } from '../stores/usePageStore';
import { useRegionStore } from '../stores/useRegionStore';
import { exportPageImage } from '../utils/persistence';

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

      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (!ctrl && key === 'v') {
        event.preventDefault();
        useEditorStore.getState().setTool('select');
        return;
      }

      if (!ctrl && key === 'r') {
        event.preventDefault();
        useEditorStore.getState().setTool('draw');
        return;
      }

      if (!ctrl && key === 'h') {
        event.preventDefault();
        useEditorStore.getState().setTool('pan');
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const regionId = useRegionStore.getState().selectedRegionId;
        const pageId = usePageStore.getState().activePageId;

        if (regionId && pageId) {
          event.preventDefault();
          useRegionStore.getState().deleteRegion(pageId, regionId);
        }
        return;
      }

      if (event.key === 'Escape') {
        const { focusMode, sidebarOpen, inspectorOpen, toggleSidebar, toggleInspector } =
          useEditorStore.getState();

        if (focusMode && (sidebarOpen || inspectorOpen)) {
          if (sidebarOpen) toggleSidebar();
          if (inspectorOpen) toggleInspector();
          return;
        }

        useRegionStore.getState().selectRegion(null);
        return;
      }

      if (ctrl && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        useEditorStore.getState().zoomIn();
        return;
      }

      if (ctrl && event.key === '-') {
        event.preventDefault();
        useEditorStore.getState().zoomOut();
        return;
      }

      if (ctrl && event.key === '0') {
        event.preventDefault();
        useEditorStore.getState().resetZoom();
        return;
      }

      if (ctrl && key === '.') {
        event.preventDefault();
        useEditorStore.getState().toggleFocusMode();
        return;
      }

      if (ctrl && event.shiftKey && key === 'o') {
        const { activePageId, selectedPageIds } = usePageStore.getState();
        const pageIds = selectedPageIds.length > 0 ? selectedPageIds : activePageId ? [activePageId] : [];

        if (pageIds.length > 0) {
          event.preventDefault();
          useJobStore.getState().queueOcrJobs(pageIds);
        }
        return;
      }

      if (ctrl && key === 'm') {
        const { selectedPageIds, stitchPages, stitchOptions } = usePageStore.getState();
        if (selectedPageIds.length >= 2) {
          event.preventDefault();
          void stitchPages(selectedPageIds, stitchOptions);
        }
        return;
      }

      if (ctrl && event.shiftKey && key === 'e') {
        const { activePageId, pages } = usePageStore.getState();
        const page = activePageId ? pages.find((item) => item.id === activePageId) : null;
        if (page) {
          event.preventDefault();
          void exportPageImage(page);
        }
        return;
      }

      if (ctrl && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        useHistoryStore.getState().undo();
        return;
      }

      if (ctrl && ((key === 'z' && event.shiftKey) || key === 'y')) {
        event.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      if (ctrl && key === 'b') {
        event.preventDefault();
        useEditorStore.getState().toggleSidebar();
        return;
      }

      if (ctrl && key === 'i') {
        event.preventDefault();
        useEditorStore.getState().toggleInspector();
        return;
      }

      if (!ctrl && key === 'g') {
        event.preventDefault();
        useEditorStore.getState().toggleGrid();
        return;
      }

      const arrowKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
      if (arrowKeys.includes(key)) {
        const pageId = usePageStore.getState().activePageId;
        const regionId = useRegionStore.getState().selectedRegionId;
        if (!pageId || !regionId) return;

        const page = usePageStore.getState().getActivePage();
        const region = page?.regions.find((item) => item.id === regionId);
        if (!region || region.locked) return;

        event.preventDefault();
        const delta = event.shiftKey ? 10 : 1;
        const vector = {
          x: key === 'arrowleft' ? -delta : key === 'arrowright' ? delta : 0,
          y: key === 'arrowup' ? -delta : key === 'arrowdown' ? delta : 0,
        };

        if (event.altKey) {
          useRegionStore.getState().updateRegion(pageId, regionId, {
            width: Math.max(10, region.width + vector.x),
            height: Math.max(10, region.height + vector.y),
          });
        } else {
          useRegionStore.getState().updateRegion(pageId, regionId, {
            x: region.x + vector.x,
            y: region.y + vector.y,
          });
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
