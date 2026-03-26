import { create } from 'zustand';

export type EditorTool = 'select' | 'draw' | 'pan';

interface EditorState {
  tool: EditorTool;
  zoom: number;
  stagePosition: { x: number; y: number };
  /** Panel visibility */
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  /** Canvas overlays */
  gridVisible: boolean;
  labelsVisible: boolean;
  minimapVisible: boolean;
  /** Cursor canvas coords (for status bar) */
  cursorPosition: { x: number; y: number };
  fitRequestNonce: number;

  setTool: (tool: EditorTool) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setStagePosition: (pos: { x: number; y: number }) => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  setSidebarOpen: (value: boolean) => void;
  setInspectorOpen: (value: boolean) => void;
  toggleGrid: () => void;
  toggleLabels: () => void;
  toggleMinimap: () => void;
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
  sidebarOpen: true,
  inspectorOpen: true,
  gridVisible: false,
  labelsVisible: true,
  minimapVisible: true,
  cursorPosition: { x: 0, y: 0 },
  fitRequestNonce: 0,

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomIn: () => set((s) => ({ zoom: clampZoom(s.zoom + ZOOM_STEP) })),
  zoomOut: () => set((s) => ({ zoom: clampZoom(s.zoom - ZOOM_STEP) })),
  resetZoom: () => set({ zoom: 1, stagePosition: { x: 0, y: 0 } }),
  setStagePosition: (stagePosition) => set({ stagePosition }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  setInspectorOpen: (value) => set({ inspectorOpen: value }),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleLabels: () => set((s) => ({ labelsVisible: !s.labelsVisible })),
  toggleMinimap: () => set((s) => ({ minimapVisible: !s.minimapVisible })),
  setCursorPosition: (cursorPosition) => set({ cursorPosition }),
  requestFitToPage: () =>
    set((s) => ({
      fitRequestNonce: s.fitRequestNonce + 1,
    })),
}));
