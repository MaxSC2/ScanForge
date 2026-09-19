import { create } from 'zustand';
import type { Page, ProjectMeta, ProjectSettingsRecord, TextStyleRecord } from '../types';
import { useProjectStore } from './useProjectStore';
import { useToastStore } from './useToastStore';
import { use as useStore } from './storeRegistry';

type HistoryImageRef =
  | { kind: 'ref'; id: number }
  | { kind: 'inline'; value: string };

interface HistoryPage extends Omit<Page, 'imageUrl' | 'regions'> {
  imageUrl: HistoryImageRef;
  regions: Page['regions'];
}

interface HistorySnapshot {
  pages: HistoryPage[];
  activePageId: string | null;
  selectedPageIds: string[];
  selectedRegionId: string | null;
  meta: ProjectMeta;
  settings: ProjectSettingsRecord | null;
  textStyles: TextStyleRecord[];
}

export interface HistoryCaptureOptions {
  coalesceKey?: string;
  windowMs?: number;
  force?: boolean;
}

interface HistoryState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  isRestoring: boolean;
  canUndo: boolean;
  canRedo: boolean;
  capture: (options?: HistoryCaptureOptions) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

const DEFAULT_COALESCE_MS = 700;
type TimeoutId = ReturnType<typeof setTimeout>;
const activeCaptureWindows = new Map<string, TimeoutId>();

let nextHistoryImageRef = 1;
const historyImageByRef = new Map<number, string>();
const historyRefByImage = new Map<string, number>();

function snapshotImageUrl(imageUrl: string): HistoryImageRef {
  if (!imageUrl.startsWith('data:')) {
    return { kind: 'inline', value: imageUrl };
  }

  const existingRef = historyRefByImage.get(imageUrl);
  if (existingRef !== undefined) {
    return { kind: 'ref', id: existingRef };
  }

  const id = nextHistoryImageRef++;
  historyRefByImage.set(imageUrl, id);
  historyImageByRef.set(id, imageUrl);
  return { kind: 'ref', id };
}

function restoreImageUrl(image: HistoryImageRef): string {
  if (image.kind === 'inline') return image.value;
  const value = historyImageByRef.get(image.id);
  if (value === undefined) {
    throw new Error(`History image reference undefined is unavailable`);
  }
  return value;
}

function snapshotPages(pages: Page[]): HistoryPage[] {
  return pages.map((page) => ({
    ...page,
    imageUrl: snapshotImageUrl(page.imageUrl),
    regions: structuredClone(page.regions),
  }));
}

function restorePages(pages: HistoryPage[]): Page[] {
  return pages.map((page) => ({
    ...page,
    imageUrl: restoreImageUrl(page.imageUrl),
    regions: structuredClone(page.regions),
  }));
}

function collectHistoryImageRefs(snapshots: HistorySnapshot[]): Set<number> {
  const refs = new Set<number>();
  for (const snapshot of snapshots) {
    for (const page of snapshot.pages) {
      if (page.imageUrl.kind === 'ref') refs.add(page.imageUrl.id);
    }
  }
  return refs;
}

function pruneHistoryImages(past: HistorySnapshot[], future: HistorySnapshot[]) {
  const usedRefs = collectHistoryImageRefs([...past, ...future]);
  for (const [id, value] of historyImageByRef) {
    if (usedRefs.has(id)) continue;
    historyImageByRef.delete(id);
    if (historyRefByImage.get(value) === id) {
      historyRefByImage.delete(value);
    }
  }
}

function cloneSnapshot(): HistorySnapshot {
  const pageState = useStore('page').getState();
  const regionState = useStore('region').getState();
  const projectState = useProjectStore.getState();
  const domainState = useStore('domain').getState();
  return {
    pages: snapshotPages(pageState.pages),
    activePageId: pageState.activePageId,
    selectedPageIds: [...pageState.selectedPageIds],
    selectedRegionId: regionState.selectedRegionId,
    meta: structuredClone(projectState.meta),
    settings: domainState.settings ? structuredClone(domainState.settings) : null,
    textStyles: structuredClone(domainState.textStyles),
  };
}

function applySnapshot(snapshot: HistorySnapshot) {
  useStore('page').setState({
    pages: restorePages(snapshot.pages),
    activePageId: snapshot.activePageId,
    selectedPageIds: [...snapshot.selectedPageIds],
  });
  useStore('region').setState({ selectedRegionId: snapshot.selectedRegionId });
  useProjectStore.setState({ meta: structuredClone(snapshot.meta) });
  useStore('domain').setState({
    settings: snapshot.settings ? structuredClone(snapshot.settings) : null,
    textStyles: structuredClone(snapshot.textStyles),
  });
}

function buildSnapshotSignature(snapshot: HistorySnapshot) {
  return JSON.stringify(snapshot);
}

function clearCaptureWindows() {
  for (const timeoutId of activeCaptureWindows.values()) {
    globalThis.clearTimeout(timeoutId);
  }
  activeCaptureWindows.clear();
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  isRestoring: false,
  canUndo: false,
  canRedo: false,

  capture: (options) => {
    if (get().isRestoring) return;
    if (options?.coalesceKey && activeCaptureWindows.has(options.coalesceKey)) {
      return;
    }

    const snapshot = cloneSnapshot();
    const signature = buildSnapshotSignature(snapshot);

    if (options?.coalesceKey) {
      const timeoutId = globalThis.setTimeout(() => {
        activeCaptureWindows.delete(options.coalesceKey!);
      }, options.windowMs ?? DEFAULT_COALESCE_MS);
      activeCaptureWindows.set(options.coalesceKey, timeoutId);
    }

    set((s) => {
      const last = s.past[s.past.length - 1];
      if (!options?.force && last && buildSnapshotSignature(last) === signature) {
        return s;
      }

      const past = [...s.past, snapshot].slice(-100);
      pruneHistoryImages(past, []);
      return { past, future: [], canUndo: past.length > 0, canRedo: false };
    });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    clearCaptureWindows();
    const current = cloneSnapshot();
    const previous = state.past[state.past.length - 1];
    set({ isRestoring: true });
    applySnapshot(previous);
    const past = state.past.slice(0, -1);
    const future = [current, ...state.future];
    pruneHistoryImages(past, future);
    pruneHistoryImages(past, future);
    set({
      isRestoring: false,
      past,
      future,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    });
    useToastStore.getState().push('Отменено · Ctrl+Z для отмены, Ctrl+Shift+Z для повтора', 'info');
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    clearCaptureWindows();
    const current = cloneSnapshot();
    const next = state.future[0];
    set({ isRestoring: true });
    applySnapshot(next);
    const past = [...state.past, current].slice(-100);
    const future = state.future.slice(1);
    set({
      isRestoring: false,
      past,
      future,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    });
    useToastStore.getState().push('Повторено · Ctrl+Z для отмены, Ctrl+Shift+Z для повтора', 'info');
  },

  clear: () => {
    clearCaptureWindows();
    historyImageByRef.clear();
    historyRefByImage.clear();
    set({ past: [], future: [], canUndo: false, canRedo: false });
  },
}));
