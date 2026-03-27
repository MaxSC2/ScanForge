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
}

const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 8;

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

export const useEditorStore = create<EditorState>((set) => ({
  tool: 'select',
  zoom: 1,
  stagePosition: { x: 0, y: 0 },
  viewMode: 'fit-page',
  sidebarOpen: true,
  inspectorOpen: true,
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

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom), viewMode: 'manual' }),
  zoomIn: () => set((s) => ({ zoom: clampZoom(s.zoom + ZOOM_STEP), viewMode: 'manual' })),
  zoomOut: () => set((s) => ({ zoom: clampZoom(s.zoom - ZOOM_STEP), viewMode: 'manual' })),
  resetZoom: () => set({ zoom: 1, stagePosition: { x: 0, y: 0 }, viewMode: 'manual' }),
  setStagePosition: (stagePosition) => set({ stagePosition, viewMode: 'manual' }),
  applyViewportTransform: ({ zoom, stagePosition }) => set({ zoom: clampZoom(zoom), stagePosition }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  setInspectorOpen: (value) => set({ inspectorOpen: value }),
  toggleFocusMode: () =>
    set((state) => ({
      focusMode: !state.focusMode,
      sidebarOpen: !state.focusMode ? false : state.sidebarOpen,
      inspectorOpen: !state.focusMode ? false : state.inspectorOpen,
    })),
  setFocusMode: (value) =>
    set((state) => ({
      focusMode: value,
      sidebarOpen: value ? state.sidebarOpen : false,
      inspectorOpen: value ? state.inspectorOpen : false,
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
}));
