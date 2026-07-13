import { afterEach, describe, expect, it } from 'vitest';
import { useRegionStore } from '../../stores/useRegionStore';
import { usePageStore } from '../../stores/usePageStore';
import { useProjectStore } from '../../stores/useProjectStore';
import type { Page, Region } from '../../types';

function createRegion(id: string, overrides: Partial<Region> = {}): Region {
  return {
    id,
    label: `Region ${id}`,
    x: 10,
    y: 20,
    width: 100,
    height: 40,
    rotation: 0,
    orientation: 'horizontal',
    sourceText: '',
    translatedText: '',
    status: 'idle',
    ocrStatus: 'idle',
    translationStatus: 'idle',
    kind: 'speech',
    order: 1,
    notes: '',
    locked: false,
    visible: true,
    ...overrides,
  };
}

function createPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    label: 'Page 1',
    regions: [],
    naturalWidth: 800,
    naturalHeight: 600,
    image: null,
    imageDataUrl: '',
    ...overrides,
  };
}

function setupPage(regions: Region[]) {
  const page = createPage({ regions });
  usePageStore.setState({
    pages: [page],
    activePageId: page.id,
  });
  useRegionStore.setState({
    selectedRegionId: null,
    multiSelectedRegionIds: [],
  });
  useProjectStore.setState({ meta: { name: 'test', createdAt: 0, updatedAt: 0 } });
}

describe('useRegionStore', () => {
  afterEach(() => {
    usePageStore.setState({ pages: [], activePageId: null });
    useRegionStore.setState({ selectedRegionId: null, multiSelectedRegionIds: [] });
  });

  describe('selectRegion', () => {
    it('selects a single region', () => {
      setupPage([createRegion('r1'), createRegion('r2')]);
      useRegionStore.getState().selectRegion('r1');
      expect(useRegionStore.getState().selectedRegionId).toBe('r1');
      expect(useRegionStore.getState().multiSelectedRegionIds).toEqual([]);
    });

    it('deselects when passing null', () => {
      setupPage([createRegion('r1')]);
      useRegionStore.getState().selectRegion('r1');
      useRegionStore.getState().selectRegion(null);
      expect(useRegionStore.getState().selectedRegionId).toBeNull();
    });

    it('adds to multi-selection with shift', () => {
      setupPage([createRegion('r1'), createRegion('r2'), createRegion('r3')]);
      useRegionStore.getState().selectRegion('r1');
      useRegionStore.getState().selectRegion('r2', true);
      expect(useRegionStore.getState().selectedRegionId).toBe('r2');
      expect(useRegionStore.getState().multiSelectedRegionIds).toEqual(['r1']);
    });

    it('removes from multi-selection on shift+click when already selected', () => {
      setupPage([createRegion('r1'), createRegion('r2')]);
      useRegionStore.getState().selectRegion('r1');
      useRegionStore.getState().selectRegion('r2', true);
      useRegionStore.getState().selectRegion('r1', true);
      expect(useRegionStore.getState().multiSelectedRegionIds).toEqual(['r2']);
    });

    it('clears multi-selection on non-shift click', () => {
      setupPage([createRegion('r1'), createRegion('r2')]);
      useRegionStore.getState().selectRegion('r1');
      useRegionStore.getState().selectRegion('r2', true);
      useRegionStore.getState().selectRegion('r2');
      expect(useRegionStore.getState().multiSelectedRegionIds).toEqual([]);
      expect(useRegionStore.getState().selectedRegionId).toBe('r2');
    });
  });

  describe('selectAllRegions', () => {
    it('selects all regions', () => {
      setupPage([createRegion('r1'), createRegion('r2', { order: 2 })]);
      useRegionStore.getState().selectAllRegions();
      expect(useRegionStore.getState().selectedRegionId).toBe('r1');
      expect(useRegionStore.getState().multiSelectedRegionIds).toEqual(['r2']);
    });

    it('does nothing on empty page', () => {
      setupPage([]);
      useRegionStore.getState().selectAllRegions();
      expect(useRegionStore.getState().selectedRegionId).toBeNull();
      expect(useRegionStore.getState().multiSelectedRegionIds).toEqual([]);
    });
  });

  describe('clearMultiSelect', () => {
    it('clears multi-selection', () => {
      setupPage([createRegion('r1'), createRegion('r2')]);
      useRegionStore.getState().selectRegion('r1');
      useRegionStore.getState().selectRegion('r2', true);
      useRegionStore.getState().clearMultiSelect();
      expect(useRegionStore.getState().multiSelectedRegionIds).toEqual([]);
    });
  });

  describe('addRegion', () => {
    it('adds a region to the active page', () => {
      setupPage([]);
      const region = useRegionStore.getState().addRegion('page-1', { x: 0, y: 0, width: 50, height: 50 });
      expect(region.id).toBeTruthy();
      expect(region.x).toBe(0);
      expect(region.y).toBe(0);
      expect(region.width).toBe(50);
      expect(region.height).toBe(50);
      expect(region.order).toBe(1);
      expect(useRegionStore.getState().selectedRegionId).toBe(region.id);
      const page = usePageStore.getState().pages.find((p) => p.id === 'page-1');
      expect(page?.regions).toHaveLength(1);
    });
  });

  describe('updateRegion', () => {
    it('updates region fields', () => {
      setupPage([createRegion('r1')]);
      useRegionStore.getState().updateRegion('page-1', 'r1', { label: 'Updated', x: 999 });
      const page = usePageStore.getState().pages.find((p) => p.id === 'page-1');
      const r = page?.regions.find((r) => r.id === 'r1');
      expect(r?.label).toBe('Updated');
      expect(r?.x).toBe(999);
    });
  });

  describe('batchUpdateRegions', () => {
    it('updates multiple regions at once', () => {
      setupPage([createRegion('r1'), createRegion('r2', { order: 2 })]);
      useRegionStore.getState().batchUpdateRegions('page-1', ['r1', 'r2'], { locked: true });
      const page = usePageStore.getState().pages.find((p) => p.id === 'page-1');
      expect(page?.regions.every((r) => r.locked)).toBe(true);
    });
  });

  describe('deleteRegion', () => {
    it('removes a region and reorders', () => {
      setupPage([createRegion('r1'), createRegion('r2', { order: 2 }), createRegion('r3', { order: 3 })]);
      useRegionStore.getState().deleteRegion('page-1', 'r2');
      const page = usePageStore.getState().pages.find((p) => p.id === 'page-1');
      expect(page?.regions).toHaveLength(2);
      expect(page?.regions.find((r) => r.id === 'r2')).toBeUndefined();
      expect(page?.regions.every((r) => r.order > 0)).toBe(true);
    });

    it('clears selection if deleted region was selected', () => {
      setupPage([createRegion('r1')]);
      useRegionStore.getState().selectRegion('r1');
      useRegionStore.getState().deleteRegion('page-1', 'r1');
      expect(useRegionStore.getState().selectedRegionId).toBeNull();
    });
  });

  describe('duplicateRegion', () => {
    it('duplicates a region with offset', () => {
      setupPage([createRegion('r1', { x: 100, y: 200 })]);
      useRegionStore.getState().duplicateRegion('page-1', 'r1');
      const page = usePageStore.getState().pages.find((p) => p.id === 'page-1');
      expect(page?.regions).toHaveLength(2);
      const dup = page?.regions.find((r) => r.id !== 'r1');
      expect(dup?.x).toBe(120);
      expect(dup?.y).toBe(220);
      expect(dup?.label).toContain('copy');
      expect(useRegionStore.getState().selectedRegionId).toBe(dup?.id);
    });
  });

  describe('reorderRegions', () => {
    it('moves a region and updates all orders', () => {
      setupPage([createRegion('r1', { order: 1 }), createRegion('r2', { order: 2 }), createRegion('r3', { order: 3 })]);
      useRegionStore.getState().reorderRegions('page-1', 2, 0);
      const page = usePageStore.getState().pages.find((p) => p.id === 'page-1');
      expect(page?.regions[0]?.id).toBe('r3');
      expect(page?.regions[1]?.id).toBe('r1');
      expect(page?.regions[2]?.id).toBe('r2');
      expect(page?.regions.map((r) => r.order)).toEqual([1, 2, 3]);
    });
  });

  describe('getMultiSelectedRegions', () => {
    it('returns regions matching multi-selection ids', () => {
      setupPage([createRegion('r1'), createRegion('r2', { order: 2 }), createRegion('r3', { order: 3 })]);
      useRegionStore.getState().selectRegion('r1');
      useRegionStore.getState().selectRegion('r2', true);
      useRegionStore.getState().selectRegion('r3', true);
      const multi = useRegionStore.getState().getMultiSelectedRegions();
      expect(multi).toHaveLength(2);
      expect(multi.map((r) => r.id).sort()).toEqual(['r2', 'r3']);
    });
  });
});
