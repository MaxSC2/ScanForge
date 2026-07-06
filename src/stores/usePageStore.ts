import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Page, ProjectFile, StitchOptions } from '../types';
import { buildStitchRenderPlans, computeStitchOutputSize } from '../utils/stitch';
import { isDesktopRuntime } from '../utils/runtime';
import { useHistoryStore } from './useHistoryStore';
import { useProjectStore } from './useProjectStore';

const DEFAULT_STITCH_OPTIONS: StitchOptions = {
  direction: 'vertical',
  gap: 0,
  background: '#000000',
  align: 'start',
  scaleMode: 'normalize-cross-axis',
  crossAxisSize: null,
  allowUpscale: false,
  exportAfterStitch: false,
};

interface PageState {
  pages: Page[];
  activePageId: string | null;
  selectedPageIds: string[];
  lastSelectedPageId: string | null;
  stitching: boolean;
  stitchOptions: StitchOptions;

  addPages: (files: File[]) => Promise<void>;
  removePage: (id: string) => void;
  duplicatePage: (pageId: string) => void;
  setActivePage: (id: string | null) => void;
  goToAdjacentPage: (direction: 'previous' | 'next') => void;
  getActivePage: () => Page | undefined;
  reorderPage: (fromIndex: number, toIndex: number) => void;
  selectPage: (id: string, mode?: 'replace' | 'toggle' | 'range') => void;
  togglePageSelection: (id: string) => void;
  clearPageSelection: () => void;
  selectAllPages: () => void;
  setStitchOptions: (patch: Partial<StitchOptions>) => void;
  updatePageImage: (pageId: string, dataUrl: string) => Promise<void>;
  stitchPages: (pageIds: string[], options?: StitchOptions) => Promise<Page | null>;
  setProjectState: (payload: {
    pages: Page[];
    activePageId: string | null;
    selectedPageIds?: string[];
  }) => void;
  toProjectFile: () => Promise<ProjectFile>;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to encode image data'));
    reader.readAsDataURL(blob);
  });
}

/** Helper: read a File into a stable data-url and resolve natural dimensions */
async function loadImage(file: File): Promise<Omit<Page, 'regions'>> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${file.name}`));
    img.src = dataUrl;
  });

  const pageId = uuid();
  let imagePath = dataUrl;

  if (isDesktopRuntime()) {
    const projectId = useProjectStore.getState().meta.localProjectId;
    if (projectId) {
      try {
        imagePath = await invoke<string>('save_page_image', {
          projectId,
          pageId,
          dataUrl,
        });
      } catch {
        imagePath = dataUrl;
      }
    }
  }

  return {
    id: pageId,
    fileName: file.name,
    imagePath,
    imageUrl: dataUrl,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
  };
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to decode image at ${url}`));
    img.src = url;
  });
}

function sortPagesByProjectOrder(pageIds: string[], pages: Page[]): Page[] {
  const idSet = new Set(pageIds);
  return pages
    .filter((page) => idSet.has(page.id))
    .sort((a, b) => pageIds.indexOf(a.id) - pageIds.indexOf(b.id));
}

export const usePageStore = create<PageState>((set, get) => ({
  pages: [],
  activePageId: null,
  selectedPageIds: [],
  lastSelectedPageId: null,
  stitching: false,
  stitchOptions: DEFAULT_STITCH_OPTIONS,

  addPages: async (files) => {
    const loaded = await Promise.all(files.map(loadImage));
    const newPages: Page[] = loaded.map((p) => ({ ...p, regions: [] }));
    set((s) => {
      useHistoryStore.getState().capture();
      const pages = [...s.pages, ...newPages];
      return {
        pages,
        activePageId: s.activePageId ?? newPages[0]?.id ?? null,
        selectedPageIds: newPages.length > 0 ? [newPages[0].id] : s.selectedPageIds,
        lastSelectedPageId: newPages[0]?.id ?? s.lastSelectedPageId,
      };
    });
    useProjectStore.getState().touch();
  },

  removePage: (id) => {
    const { pages } = get();
    const page = pages.find((p) => p.id === id);
    if (page && !page.imagePath.startsWith('data:') && isDesktopRuntime()) {
      const projectId = useProjectStore.getState().meta.localProjectId;
      if (projectId) {
        invoke('delete_page_image', { projectId, pageId: id }).catch(() => {});
      }
    }

    useHistoryStore.getState().capture();
    set((s) => {
      const remaining = s.pages.filter((p) => p.id !== id);
      const activePageId =
        s.activePageId === id ? (remaining[0]?.id ?? null) : s.activePageId;
      return {
        pages: remaining,
        activePageId,
        selectedPageIds: s.selectedPageIds.filter((pageId) => pageId !== id),
        lastSelectedPageId:
          s.lastSelectedPageId === id ? (remaining[0]?.id ?? null) : s.lastSelectedPageId,
      };
    });
    useProjectStore.getState().touch();
  },

  duplicatePage: (pageId) => {
    const { pages } = get();
    const source = pages.find((p) => p.id === pageId);
    if (!source) return;

    useHistoryStore.getState().capture();

    const clonedPage: Page = {
      ...source,
      id: uuid(),
      fileName: `${source.fileName} (копия)`,
      regions: source.regions.map((r) => ({ ...r, id: uuid() })),
    };

    set((s) => {
      const idx = s.pages.findIndex((p) => p.id === pageId);
      const newPages = [...s.pages];
      newPages.splice(idx + 1, 0, clonedPage);
      return { pages: newPages, selectedPageIds: [clonedPage.id], activePageId: clonedPage.id, lastSelectedPageId: clonedPage.id };
    });
    useProjectStore.getState().touch();
  },

  setActivePage: (id) =>
    set(() => ({
      activePageId: id,
      selectedPageIds: id ? [id] : [],
      lastSelectedPageId: id,
    })),

  goToAdjacentPage: (direction) =>
    set((state) => {
      if (state.pages.length === 0) {
        return state;
      }

      const currentIndex = state.activePageId
        ? state.pages.findIndex((page) => page.id === state.activePageId)
        : -1;

      const fallbackIndex = direction === 'next' ? 0 : state.pages.length - 1;
      const safeCurrentIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
      const delta = direction === 'next' ? 1 : -1;
      const nextIndex = Math.min(
        state.pages.length - 1,
        Math.max(0, safeCurrentIndex + delta),
      );

      if (nextIndex === safeCurrentIndex && currentIndex >= 0) {
        return state;
      }

      const nextPage = state.pages[nextIndex];
      if (!nextPage) {
        return state;
      }

      return {
        activePageId: nextPage.id,
        selectedPageIds: [nextPage.id],
        lastSelectedPageId: nextPage.id,
      };
    }),

  getActivePage: () => {
    const { pages, activePageId } = get();
    return pages.find((p) => p.id === activePageId);
  },

  reorderPage: (fromIndex, toIndex) => {
    useHistoryStore.getState().capture();
    set((s) => {
      const pages = [...s.pages];
      const [moved] = pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, moved);
      return { pages };
    });
    useProjectStore.getState().touch();
  },

  selectPage: (id, mode = 'replace') =>
    set((s) => {
      const currentIds = s.selectedPageIds;
      if (mode === 'replace') {
        return { selectedPageIds: [id], activePageId: id, lastSelectedPageId: id };
      }
      if (mode === 'toggle') {
        const selectedPageIds = currentIds.includes(id)
          ? currentIds.filter((v) => v !== id)
          : [...currentIds, id];
        return {
          selectedPageIds,
          activePageId: id,
          lastSelectedPageId: id,
        };
      }
      const anchorId = s.lastSelectedPageId ?? id;
      const allIds = s.pages.map((p) => p.id);
      const from = allIds.indexOf(anchorId);
      const to = allIds.indexOf(id);
      if (from < 0 || to < 0) {
        return { selectedPageIds: [id], activePageId: id, lastSelectedPageId: id };
      }
      const min = Math.min(from, to);
      const max = Math.max(from, to);
      const selectedPageIds = allIds.slice(min, max + 1);
      return { selectedPageIds, activePageId: id };
    }),

  togglePageSelection: (id) =>
    get().selectPage(id, 'toggle'),

  clearPageSelection: () => set({ selectedPageIds: [], lastSelectedPageId: null }),

  selectAllPages: () =>
    set((s) => ({
      selectedPageIds: s.pages.map((page) => page.id),
      lastSelectedPageId: s.pages[0]?.id ?? null,
    })),

  setStitchOptions: (patch) =>
    set((s) => ({ stitchOptions: { ...s.stitchOptions, ...patch } })),

  updatePageImage: async (pageId, dataUrl) => {
    const img = await loadImageElement(dataUrl);

    useHistoryStore.getState().capture();

    let imagePath = dataUrl;
    if (isDesktopRuntime()) {
      const projectId = useProjectStore.getState().meta.localProjectId;
      if (projectId) {
        try {
          imagePath = await invoke<string>('save_page_image', {
            projectId,
            pageId,
            dataUrl,
          });
        } catch {
          imagePath = dataUrl;
        }
      }
    }

    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              imageUrl: dataUrl,
              imagePath,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
            }
          : p,
      ),
    }));
    useProjectStore.getState().touch();
  },

  stitchPages: async (pageIds, options) => {
    const uniqueIds = Array.from(new Set(pageIds));
    if (uniqueIds.length < 2) return null;

    const { pages } = get();
    const sourcePages = sortPagesByProjectOrder(uniqueIds, pages);
    if (sourcePages.length < 2) return null;

    set({ stitching: true });

    try {
      useHistoryStore.getState().capture();
      const stitch = options ?? get().stitchOptions;
      const images = await Promise.all(
        sourcePages.map((page) => loadImageElement(page.imageUrl)),
      );

      const plans = buildStitchRenderPlans(
        images.map((img) => ({ width: img.naturalWidth, height: img.naturalHeight })),
        stitch,
      );
      const gap = Math.max(0, Math.floor(stitch.gap));
      const { width, height } = computeStitchOutputSize(plans, stitch.direction, gap);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context is unavailable');

      ctx.fillStyle = stitch.background;
      ctx.fillRect(0, 0, width, height);

      let xOffset = 0;
      let yOffset = 0;
      for (let i = 0; i < images.length; i += 1) {
        const img = images[i];
        const plan = plans[i];
        const crossOffset =
          stitch.align === 'start'
            ? 0
            : stitch.align === 'end'
              ? stitch.direction === 'vertical'
                ? width - plan.width
                : height - plan.height
              : stitch.direction === 'vertical'
                ? Math.floor((width - plan.width) / 2)
                : Math.floor((height - plan.height) / 2);

        if (stitch.direction === 'vertical') {
          ctx.drawImage(img, crossOffset, yOffset, plan.width, plan.height);
          yOffset += plan.height + gap;
        } else {
          ctx.drawImage(img, xOffset, crossOffset, plan.width, plan.height);
          xOffset += plan.width + gap;
        }
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('Failed to produce stitched image blob');

      const imageDataUrl = await blobToDataUrl(blob);
      const stitchedId = uuid();
      let stitchedPath = imageDataUrl;

      if (isDesktopRuntime()) {
        const projectId = useProjectStore.getState().meta.localProjectId;
        if (projectId) {
          try {
            stitchedPath = await invoke<string>('save_page_image', {
              projectId,
              pageId: stitchedId,
              dataUrl: imageDataUrl,
            });
          } catch {
            stitchedPath = imageDataUrl;
          }
        }
      }

      const stitchedPage: Page = {
        id: stitchedId,
        fileName: `stitched-${stitch.direction}-${sourcePages.length}-pages.png`,
        imagePath: stitchedPath,
        imageUrl: imageDataUrl,
        naturalWidth: width,
        naturalHeight: height,
        regions: [],
      };

      set((s) => ({
        pages: [...s.pages, stitchedPage],
        activePageId: stitchedPage.id,
        selectedPageIds: [stitchedPage.id],
        lastSelectedPageId: stitchedPage.id,
      }));
      useProjectStore.getState().touch();

      return stitchedPage;
    } finally {
      set({ stitching: false });
    }
  },

  setProjectState: ({ pages, activePageId, selectedPageIds }) =>
    set({
      pages,
      activePageId,
      selectedPageIds: selectedPageIds ?? (activePageId ? [activePageId] : []),
      lastSelectedPageId: activePageId,
    }),

  toProjectFile: async () => {
    const { pages, activePageId } = get();
    const pageData = await Promise.all(
      pages.map(async (page) => {
        const isDataUrl = page.imagePath.startsWith('data:');
        const imageDataUrl = isDataUrl
          ? page.imagePath
          : page.imagePath;
        return {
          id: page.id,
          fileName: page.fileName,
          imageDataUrl,
          naturalWidth: page.naturalWidth,
          naturalHeight: page.naturalHeight,
          regions: page.regions,
        };
      }),
    );
    return {
      version: 1 as const,
      meta: useProjectStore.getState().meta,
      pages: pageData,
      activePageId,
    };
  },
}));
