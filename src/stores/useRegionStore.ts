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
import { emitEvent } from '../plugins/api';
import { broadcastRegionCreate, broadcastRegionUpdate, broadcastRegionDelete, isCollabConnected } from '../collaboration/sync';
import { register } from './storeRegistry';

/**
 * Zustand state and actions for managing page regions.
 * Every mutation that modifies region data performs these side effects:
 * 1. Captures history snapshot via `useHistoryStore.capture()` (with optional region-specific capture options).
 * 2. Applies lifecycle patches via `applyRegionLifecyclePatch` (e.g., resetting OCR status on text changes).
 * 3. Re-sorts and re-numbers regions by `order` after mutation.
 * 4. Touches the project store to mark the project as dirty.
 */
interface RegionState {
  selectedRegionId: string | null;
  multiSelectedRegionIds: string[];

  selectRegion: (id: string | null, shift?: boolean) => void;
  selectAllRegions: () => void;
  getSelectedRegion: () => Region | undefined;
  getMultiSelectedRegions: () => Region[];
  clearMultiSelect: () => void;

  addRegion: (pageId: string, rect: { x: number; y: number; width: number; height: number }) => Region;
  updateRegion: (pageId: string, regionId: string, patch: Partial<Region>) => void;
  batchUpdateRegions: (pageId: string, regionIds: string[], patch: Partial<Region>) => void;
  deleteRegion: (pageId: string, regionId: string) => void;
  duplicateRegion: (pageId: string, regionId: string) => void;
  reorderRegions: (pageId: string, fromIndex: number, toIndex: number) => void;
  mergeRegions: (pageId: string, regionIds: string[]) => void;
  splitRegion: (pageId: string, regionId: string) => void;
}

/**
 * Co-located helper that applies a region-mutation function to the specified page
 * via `usePageStore.setState`, returning a new pages array with the updated region list.
 */
function mutatePage(pageId: string, fn: (regions: Region[]) => Region[]) {
  usePageStore.setState((s) => ({
    pages: s.pages.map((p) =>
      p.id === pageId ? { ...p, regions: fn(p.regions) } : p,
    ),
  }));
}

export const useRegionStore = create<RegionState>((set, get) => ({
  selectedRegionId: null,
  multiSelectedRegionIds: [],

  /** Selects a single region, or toggles multi-selection when shift is held. Clears multi-select on non-shift clicks. */
  selectRegion: (id, shift = false) => {
    if (shift && id) {
      set((s) => {
        const exists = s.multiSelectedRegionIds.includes(id);
        const multi = exists
          ? s.multiSelectedRegionIds.filter((rid) => rid !== id)
          : [...s.multiSelectedRegionIds, id];
        return { selectedRegionId: id, multiSelectedRegionIds: multi.length > 0 ? multi : [] };
      });
    } else {
      set({ selectedRegionId: id, multiSelectedRegionIds: [] });
    }
  },

  /** Selects all regions on the active page, ordered by their `order` property. */
  selectAllRegions: () => {
    const page = usePageStore.getState().getActivePage();
    if (!page || page.regions.length === 0) return;
    const ids = [...page.regions].sort((a, b) => a.order - b.order).map((r) => r.id);
    set({ selectedRegionId: ids[0] ?? null, multiSelectedRegionIds: ids });
  },

  /** Returns the full Region object for the currently selected region, or undefined. */
  getSelectedRegion: () => {
    const { selectedRegionId } = get();
    if (!selectedRegionId) return undefined;
    const page = usePageStore.getState().getActivePage();
    return page?.regions.find((r) => r.id === selectedRegionId);
  },

  /** Returns the Region objects for all multi-selected regions on the active page. */
  getMultiSelectedRegions: () => {
    const { multiSelectedRegionIds } = get();
    if (multiSelectedRegionIds.length === 0) return [];
    const page = usePageStore.getState().getActivePage();
    if (!page) return [];
    return page.regions.filter((r) => multiSelectedRegionIds.includes(r.id));
  },

  /** Clears the multi-selection list without changing the primary selection. */
  clearMultiSelect: () => set({ multiSelectedRegionIds: [] }),

  /**
   * Adds a new region to the specified page. Side effects:
   * - Captures history for undo.
   * - Opens the inspector panel.
   * - Touches the project store.
   * The new region gets an auto-generated UUID, incremental label, and default properties.
   */
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
    emitEvent('region:create', region);
    if (isCollabConnected()) broadcastRegionCreate(pageId, region);
    return region;
  },

  /**
   * Updates properties of an existing region. Side effects:
   * - Captures history with region-specific capture options from `resolveRegionHistoryCaptureOptions`.
   * - Applies lifecycle patches (e.g., resets OCR status when sourceText changes).
   * - Re-sorts regions by `order` and re-numbers them sequentially.
   * - Touches the project store.
   */
  updateRegion: (pageId, regionId, patch) => {
    useHistoryStore.getState().capture(resolveRegionHistoryCaptureOptions(pageId, regionId, patch));
    let updatedRegion: Region | undefined;
    mutatePage(pageId, (regions) =>
      regions
        .map((r) => {
          if (r.id === regionId) {
            updatedRegion = normalizeRegion({
              ...r,
              ...patch,
              ...applyRegionLifecyclePatch(r, patch),
            });
            return updatedRegion;
          }
          return r;
        })
        .sort((a, b) => a.order - b.order)
        .map((r, i) => ({ ...r, order: i + 1 })),
    );
    useProjectStore.getState().touch();
    if (updatedRegion) {
      emitEvent('region:update', updatedRegion, patch);
      if (isCollabConnected()) broadcastRegionUpdate(pageId, regionId, patch);
    }
  },

  /** Applies the same partial patch to multiple regions on a page. Captures history and touches project store. */
  batchUpdateRegions: (pageId, regionIds, patch) => {
    useHistoryStore.getState().capture();
    mutatePage(pageId, (regions) =>
      regions.map((r) =>
        regionIds.includes(r.id)
          ? normalizeRegion({ ...r, ...patch })
          : r,
      ),
    );
    useProjectStore.getState().touch();
  },

  /** Deletes a region and re-numbers the remaining regions. Clears selection if the deleted region was selected. */
  deleteRegion: (pageId, regionId) => {
    useHistoryStore.getState().capture();
    mutatePage(pageId, (regions) =>
      regions
        .filter((r) => r.id !== regionId)
        .map((r, i) => ({ ...r, order: i + 1 })),
    );
    useProjectStore.getState().touch();
    if (isCollabConnected()) broadcastRegionDelete(pageId, regionId);
    set((s) => ({
      selectedRegionId: s.selectedRegionId === regionId ? null : s.selectedRegionId,
    }));
  },

  /** Creates a copy of the given region, offset by 20px in both axes, and selects the copy. Captures history. */
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

  /** Moves a region from one position to another in the region list and re-numbers all regions by order. Captures history. */
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

  mergeRegions: (pageId, regionIds) => {
    if (regionIds.length < 2) return;
    useHistoryStore.getState().capture();

    const page = usePageStore.getState().pages.find((p) => p.id === pageId);
    if (!page) return;

    const targets = page.regions.filter((r) => regionIds.includes(r.id));
    if (targets.length < 2) return;

    const minX = Math.min(...targets.map((r) => r.x));
    const minY = Math.min(...targets.map((r) => r.y));
    const maxX = Math.max(...targets.map((r) => r.x + r.width));
    const maxY = Math.max(...targets.map((r) => r.y + r.height));

    const merged: Region = {
      id: uuid(),
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
      orientation: 'horizontal',
      label: `Merge-${targets.length}`,
      kind: targets.every((r) => r.kind === targets[0].kind) ? targets[0].kind : 'speech',
      order: targets[0].order,
      sourceText: targets.map((r) => r.sourceText).filter(Boolean).join(' '),
      translatedText: '',
      status: 'idle',
      ocrStatus: 'idle',
      translationStatus: 'idle',
      notes: '',
      locked: false,
      visible: true,
    };

    mutatePage(pageId, (regions) =>
      regions
        .filter((r) => !regionIds.includes(r.id))
        .concat(merged)
        .sort((a, b) => a.order - b.order)
        .map((r, i) => ({ ...r, order: i + 1 })),
    );
    set({ selectedRegionId: merged.id, multiSelectedRegionIds: [] });
    useProjectStore.getState().touch();
  },

  splitRegion: (pageId, regionId) => {
    useHistoryStore.getState().capture();

    const page = usePageStore.getState().pages.find((p) => p.id === pageId);
    if (!page) return;

    const source = page.regions.find((r) => r.id === regionId);
    if (!source) return;

    const leftHalf: Region = {
      ...source,
      id: uuid(),
      label: `${source.label}-L`,
      width: source.width / 2,
    };

    const rightHalf: Region = {
      ...source,
      id: uuid(),
      label: `${source.label}-R`,
      x: source.x + source.width / 2,
      width: source.width / 2,
    };

    mutatePage(pageId, (regions) =>
      regions
        .filter((r) => r.id !== regionId)
        .concat(leftHalf, rightHalf)
        .sort((a, b) => a.order - b.order)
        .map((r, i) => ({ ...r, order: i + 1 })),
    );
    set({ selectedRegionId: leftHalf.id, multiSelectedRegionIds: [rightHalf.id] });
    useProjectStore.getState().touch();
  },
}));

register('region', useRegionStore);
