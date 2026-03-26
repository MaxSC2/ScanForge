import { create } from 'zustand';
import type { Page, ProjectMeta } from '../types';
import { usePageStore } from './usePageStore';
import { useRegionStore } from './useRegionStore';
import { useProjectStore } from './useProjectStore';

interface HistorySnapshot {
  pages: Page[];
  activePageId: string | null;
  selectedPageIds: string[];
  selectedRegionId: string | null;
  meta: ProjectMeta;
}

interface HistoryState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  isRestoring: boolean;
  canUndo: boolean;
  canRedo: boolean;
  capture: () => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

function cloneSnapshot(): HistorySnapshot {
  const pageState = usePageStore.getState();
  const regionState = useRegionStore.getState();
  const projectState = useProjectStore.getState();
  return {
    pages: structuredClone(pageState.pages),
    activePageId: pageState.activePageId,
    selectedPageIds: [...pageState.selectedPageIds],
    selectedRegionId: regionState.selectedRegionId,
    meta: structuredClone(projectState.meta),
  };
}

function applySnapshot(snapshot: HistorySnapshot) {
  usePageStore.setState({
    pages: structuredClone(snapshot.pages),
    activePageId: snapshot.activePageId,
    selectedPageIds: [...snapshot.selectedPageIds],
  });
  useRegionStore.setState({ selectedRegionId: snapshot.selectedRegionId });
  useProjectStore.setState({ meta: structuredClone(snapshot.meta) });
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  isRestoring: false,
  canUndo: false,
  canRedo: false,

  capture: () => {
    if (get().isRestoring) return;
    const snapshot = cloneSnapshot();
    set((s) => {
      const past = [...s.past, snapshot].slice(-100);
      return { past, future: [], canUndo: past.length > 0, canRedo: false };
    });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
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
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
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
  },

  clear: () => set({ past: [], future: [], canUndo: false, canRedo: false }),
}));
