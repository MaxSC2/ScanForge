import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Region } from '../types';
import { normalizeRegion } from '../types/region';
import { usePageStore } from './usePageStore';
import { useHistoryStore } from './useHistoryStore';
import { useEditorStore } from './useEditorStore';
import { resolveRegionHistoryCaptureOptions } from './regionHistoryPolicy';
import { applyRegionLifecyclePatch } from './regionLifecyclePolicy';
import { useProjectStore } from './useProjectStore';

interface RegionState {
  selectedRegionId: string | null;

  selectRegion: (id: string | null) => void;
  getSelectedRegion: () => Region | undefined;

  addRegion: (pageId: string, rect: { x: number; y: number; width: number; height: number }) => Region;
  updateRegion: (pageId: string, regionId: string, patch: Partial<Region>) => void;
  deleteRegion: (pageId: string, regionId: string) => void;
  duplicateRegion: (pageId: string, regionId: string) => void;
  reorderRegions: (pageId: string, fromIndex: number, toIndex: number) => void;
}

/** Mutates the page store's region list (co-located helper). */
function mutatePage(pageId: string, fn: (regions: Region[]) => Region[]) {
  usePageStore.setState((s) => ({
    pages: s.pages.map((p) =>
      p.id === pageId ? { ...p, regions: fn(p.regions) } : p,
    ),
  }));
}

export const useRegionStore = create<RegionState>((set, get) => ({
  selectedRegionId: null,

  selectRegion: (id) => set({ selectedRegionId: id }),

  getSelectedRegion: () => {
    const { selectedRegionId } = get();
    if (!selectedRegionId) return undefined;
    const page = usePageStore.getState().getActivePage();
    return page?.regions.find((r) => r.id === selectedRegionId);
  },

  addRegion: (pageId, rect) => {
    useHistoryStore.getState().capture();
    const page = usePageStore.getState().pages.find((p) => p.id === pageId);
    const index = (page?.regions.length ?? 0) + 1;
    const region: Region = {
      id: uuid(),
      label: `Region ${index}`,
      ...rect,
      rotation: 0,
      orientation: 'horizontal',
      sourceText: '',
      translatedText: '',
      status: 'idle',
      ocrStatus: 'idle',
      translationStatus: 'idle',
      kind: 'speech',
      order: index,
      notes: '',
      locked: false,
      visible: true,
    };
    mutatePage(pageId, (regions) => [...regions, region]);
    set({ selectedRegionId: region.id });
    useEditorStore.getState().setInspectorOpen(true);
    useProjectStore.getState().touch();
    return region;
  },

  updateRegion: (pageId, regionId, patch) => {
    useHistoryStore.getState().capture(resolveRegionHistoryCaptureOptions(pageId, regionId, patch));
    mutatePage(pageId, (regions) =>
      regions
        .map((r) =>
          r.id === regionId
            ? normalizeRegion({
                ...r,
                ...patch,
                ...applyRegionLifecyclePatch(r, patch),
              })
            : r,
        )
        .sort((a, b) => a.order - b.order)
        .map((r, i) => ({ ...r, order: i + 1 })),
    );
    useProjectStore.getState().touch();
  },

  deleteRegion: (pageId, regionId) => {
    useHistoryStore.getState().capture();
    mutatePage(pageId, (regions) =>
      regions
        .filter((r) => r.id !== regionId)
        .map((r, i) => ({ ...r, order: i + 1 })),
    );
    useProjectStore.getState().touch();
    set((s) => ({
      selectedRegionId: s.selectedRegionId === regionId ? null : s.selectedRegionId,
    }));
  },

  duplicateRegion: (pageId, regionId) => {
    useHistoryStore.getState().capture();
    const page = usePageStore.getState().pages.find((p) => p.id === pageId);
    const source = page?.regions.find((r) => r.id === regionId);
    if (!source) return;
    const newRegion: Region = {
      ...source,
      id: uuid(),
      label: `${source.label} (copy)`,
      x: source.x + 20,
      y: source.y + 20,
      order: (page?.regions.length ?? 0) + 1,
    };
    mutatePage(pageId, (regions) => [...regions, newRegion]);
    set({ selectedRegionId: newRegion.id });
    useProjectStore.getState().touch();
  },

  reorderRegions: (pageId, fromIndex, toIndex) => {
    useHistoryStore.getState().capture();
    mutatePage(pageId, (regions) => {
      const list = [...regions];
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return list.map((r, i) => ({ ...r, order: i + 1 }));
    });
    useProjectStore.getState().touch();
  },
}));
