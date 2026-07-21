import { create } from 'zustand';
import type { Page, ProjectMeta, ProjectSettingsRecord, TextStyleRecord } from '../types';
import { useProjectStore } from './useProjectStore';
import { useToastStore } from './useToastStore';

let _pageStore: any;
let _regionStore: any;
let _domainStore: any;
void Promise.all([
  import('./usePageStore').then(m => { _pageStore = m.usePageStore; }),
  import('./useRegionStore').then(m => { _regionStore = m.useRegionStore; }),
  import('./useProjectDomainStore').then(m => { _domainStore = m.useProjectDomainStore; }),
]);

interface HistorySnapshot {
  pages: Page[];
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
const activeCaptureWindows = new Map<string, number>();

function cloneSnapshot(): HistorySnapshot {
  const pageState = _pageStore.getState();
  const regionState = _regionStore.getState();
  const projectState = useProjectStore.getState();
  const domainState = _domainStore.getState();
  return {
    pages: structuredClone(pageState.pages),
    activePageId: pageState.activePageId,
    selectedPageIds: [...pageState.selectedPageIds],
    selectedRegionId: regionState.selectedRegionId,
    meta: structuredClone(projectState.meta),
    settings: domainState.settings ? structuredClone(domainState.settings) : null,
    textStyles: structuredClone(domainState.textStyles),
  };
}

function applySnapshot(snapshot: HistorySnapshot) {
  _pageStore.setState({
    pages: structuredClone(snapshot.pages),
    activePageId: snapshot.activePageId,
    selectedPageIds: [...snapshot.selectedPageIds],
  });
  _regionStore.setState({ selectedRegionId: snapshot.selectedRegionId });
  useProjectStore.setState({ meta: structuredClone(snapshot.meta) });
  _domainStore.setState({
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
    set({
      isRestoring: false,
      past: state.past.slice(0, -1),
      future: [current, ...state.future],
      canUndo: state.past.length - 1 > 0,
      canRedo: true,
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
    set({ past: [], future: [], canUndo: false, canRedo: false });
  },
}));
