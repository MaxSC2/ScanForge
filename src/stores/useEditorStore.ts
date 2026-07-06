import { create } from 'zustand';

export type EditorTool = 'select' | 'draw' | 'pan';
export type ViewMode = 'manual' | 'fit-page' | 'fit-width' | 'actual';

interface EditorState {
  tool: EditorTool;
  zoom: number;
  stagePosition: { x: number; y: number };
  viewMode: ViewMode;
  /** Panel visibility */
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  inspectorWidth: number;
  focusMode: boolean;
  cleanView: boolean;
  /** Canvas overlays */
  regionOverlaysVisible: boolean;
  gridVisible: boolean;
  labelsVisible: boolean;
  minimapVisible: boolean;
  ocrOverwrite: boolean;
  translationOverwrite: boolean;
  /** Cursor canvas coords (for status bar) */
  cursorPosition: { x: number; y: number };
  viewRequestNonce: number;
  /** Region currently being edited on canvas (null = none) */
  editingRegionId: string | null;

  setTool: (tool: EditorTool) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setStagePosition: (pos: { x: number; y: number }) => void;
  applyViewportTransform: (payload: {
    zoom: number;
    stagePosition: { x: number; y: number };
  }) => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  setSidebarOpen: (value: boolean) => void;
  setInspectorOpen: (value: boolean) => void;
  setInspectorWidth: (value: number) => void;
  toggleFocusMode: () => void;
  setFocusMode: (value: boolean) => void;
  toggleCleanView: () => void;
  setCleanView: (value: boolean) => void;
  requestFitToWidth: () => void;
  requestActualSize: () => void;
  toggleRegionOverlays: () => void;
  toggleGrid: () => void;
  toggleLabels: () => void;
  toggleMinimap: () => void;
  toggleOcrOverwrite: () => void;
  setOcrOverwrite: (value: boolean) => void;
  toggleTranslationOverwrite: () => void;
  setTranslationOverwrite: (value: boolean) => void;
  setCursorPosition: (pos: { x: number; y: number }) => void;
  requestFitToPage: () => void;
  setEditingRegionId: (id: string | null) => void;
}

const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 8;
const INSPECTOR_WIDTH_MIN = 280;
const INSPECTOR_WIDTH_MAX = 520;
const INSPECTOR_WIDTH_STORAGE_KEY = 'scanforge.editor.inspectorWidth';

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function clampInspectorWidth(width: number) {
  return Math.min(INSPECTOR_WIDTH_MAX, Math.max(INSPECTOR_WIDTH_MIN, Math.round(width)));
}

function getInitialInspectorWidth() {
  if (typeof window === 'undefined') {
    return 320;
  }

  const raw = window.localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY);
  if (!raw) {
    return 320;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clampInspectorWidth(parsed) : 320;
}

function persistInspectorWidth(width: number) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(clampInspectorWidth(width)));
}

export const useEditorStore = create<EditorState>((set) => ({
  tool: 'select',
  zoom: 1,
  stagePosition: { x: 0, y: 0 },
  viewMode: 'fit-page',
  sidebarOpen: true,
  inspectorOpen: true,
  inspectorWidth: getInitialInspectorWidth(),
  focusMode: false,
  cleanView: false,
  regionOverlaysVisible: true,
  gridVisible: false,
  labelsVisible: true,
  minimapVisible: true,
  ocrOverwrite: false,
  translationOverwrite: false,
  cursorPosition: { x: 0, y: 0 },
  viewRequestNonce: 0,
  editingRegionId: null,

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom), viewMode: 'manual' }),
  zoomIn: () => set((s) => ({ zoom: clampZoom(s.zoom + ZOOM_STEP), viewMode: 'manual' })),
  zoomOut: () => set((s) => ({ zoom: clampZoom(s.zoom - ZOOM_STEP), viewMode: 'manual' })),
  resetZoom: () => set({ zoom: 1, stagePosition: { x: 0, y: 0 }, viewMode: 'manual' }),
  setStagePosition: (stagePosition) => set({ stagePosition, viewMode: 'manual' }),
  applyViewportTransform: ({ zoom, stagePosition }) => set({ zoom: clampZoom(zoom), stagePosition, viewMode: 'manual' }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  setInspectorOpen: (value) => set({ inspectorOpen: value }),
  setInspectorWidth: (value) => {
    const nextWidth = clampInspectorWidth(value);
    persistInspectorWidth(nextWidth);
    set({ inspectorWidth: nextWidth });
  },
  toggleFocusMode: () =>
    set((state) => ({
      focusMode: !state.focusMode,
      sidebarOpen: !state.focusMode ? false : state.sidebarOpen,
      inspectorOpen: !state.focusMode ? false : state.inspectorOpen,
    })),
  setFocusMode: (value) =>
    set((state) => ({
      focusMode: value,
      sidebarOpen: value ? false : state.sidebarOpen,
      inspectorOpen: value ? false : state.inspectorOpen,
    })),
  toggleCleanView: () =>
    set((state) => ({
      cleanView: !state.cleanView,
    })),
  setCleanView: (value) =>
    set({
      cleanView: value,
    }),
  requestFitToWidth: () =>
    set((state) => ({
      viewMode: 'fit-width',
      viewRequestNonce: state.viewRequestNonce + 1,
    })),
  requestActualSize: () =>
    set((state) => ({
      viewMode: 'actual',
      viewRequestNonce: state.viewRequestNonce + 1,
    })),
  toggleRegionOverlays: () =>
    set((state) => ({
      regionOverlaysVisible: !state.regionOverlaysVisible,
    })),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleLabels: () => set((s) => ({ labelsVisible: !s.labelsVisible })),
  toggleMinimap: () => set((s) => ({ minimapVisible: !s.minimapVisible })),
  toggleOcrOverwrite: () =>
    set((state) => ({
      ocrOverwrite: !state.ocrOverwrite,
    })),
  setOcrOverwrite: (value) => set({ ocrOverwrite: value }),
  toggleTranslationOverwrite: () =>
    set((state) => ({
      translationOverwrite: !state.translationOverwrite,
    })),
  setTranslationOverwrite: (value) => set({ translationOverwrite: value }),
  setCursorPosition: (cursorPosition) => set({ cursorPosition }),
  requestFitToPage: () =>
    set((s) => ({
      viewMode: 'fit-page',
      viewRequestNonce: s.viewRequestNonce + 1,
    })),
  setEditingRegionId: (id) => set({ editingRegionId: id }),
}));
