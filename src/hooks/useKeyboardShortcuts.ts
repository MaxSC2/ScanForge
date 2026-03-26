import { useEffect } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { useRegionStore } from '../stores/useRegionStore';
import { usePageStore } from '../stores/usePageStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { exportPageImage } from '../utils/persistence';

/**
 * Global keyboard shortcut handler.
 * Attach once in the App shell.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Skip if typing in an input or textarea
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )
        return;

      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Tool shortcuts
      if (!ctrl && key === 'v') {
        e.preventDefault();
        useEditorStore.getState().setTool('select');
        return;
      }
      if (!ctrl && key === 'r') {
        e.preventDefault();
        useEditorStore.getState().setTool('draw');
        return;
      }
      if (!ctrl && key === 'h') {
        e.preventDefault();
        useEditorStore.getState().setTool('pan');
        return;
      }

      // Delete region
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const regionId = useRegionStore.getState().selectedRegionId;
        const pageId = usePageStore.getState().activePageId;
        if (regionId && pageId) {
          e.preventDefault();
          useRegionStore.getState().deleteRegion(pageId, regionId);
        }
        return;
      }

      // Escape → deselect
      if (e.key === 'Escape') {
        useRegionStore.getState().selectRegion(null);
        return;
      }

      // Zoom
      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        useEditorStore.getState().zoomIn();
        return;
      }
      if (ctrl && e.key === '-') {
        e.preventDefault();
        useEditorStore.getState().zoomOut();
        return;
      }
      if (ctrl && e.key === '0') {
        e.preventDefault();
        useEditorStore.getState().resetZoom();
        return;
      }

      // Stitch selected pages
      if (ctrl && key === 'm') {
        const { selectedPageIds, stitchPages, stitchOptions } = usePageStore.getState();
        if (selectedPageIds.length >= 2) {
          e.preventDefault();
          void stitchPages(selectedPageIds, stitchOptions);
        }
        return;
      }

      // Export active page
      if (ctrl && e.shiftKey && key === 'e') {
        const { activePageId, pages } = usePageStore.getState();
        const page = activePageId ? pages.find((item) => item.id === activePageId) : null;
        if (page) {
          e.preventDefault();
          void exportPageImage(page);
        }
        return;
      }

      if (ctrl && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().undo();
        return;
      }

      if (ctrl && ((key === 'z' && e.shiftKey) || key === 'y')) {
        e.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      // Toggle panels
      if (ctrl && key === 'b') {
        e.preventDefault();
        useEditorStore.getState().toggleSidebar();
        return;
      }
      if (ctrl && key === 'i') {
        e.preventDefault();
        useEditorStore.getState().toggleInspector();
        return;
      }

      // Toggle grid
      if (!ctrl && key === 'g') {
        e.preventDefault();
        useEditorStore.getState().toggleGrid();
        return;
      }

      // Keyboard transform for the selected region.
      const arrowKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
      if (arrowKeys.includes(key)) {
        const pageId = usePageStore.getState().activePageId;
        const regionId = useRegionStore.getState().selectedRegionId;
        if (!pageId || !regionId) return;

        const page = usePageStore.getState().getActivePage();
        const region = page?.regions.find((r) => r.id === regionId);
        if (!region || region.locked) return;

        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        const vector = {
          x: key === 'arrowleft' ? -delta : key === 'arrowright' ? delta : 0,
          y: key === 'arrowup' ? -delta : key === 'arrowdown' ? delta : 0,
        };

        if (e.altKey) {
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
