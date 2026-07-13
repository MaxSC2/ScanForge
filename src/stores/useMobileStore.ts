import { create } from 'zustand';

interface MobileStore {
  sidebarSheet: boolean;
  inspectorSheet: boolean;
  setSidebarSheet: (v: boolean) => void;
  setInspectorSheet: (v: boolean) => void;
}

export const useMobileStore = create<MobileStore>((set) => ({
  sidebarSheet: false,
  inspectorSheet: false,
  setSidebarSheet: (sidebarSheet) => set({ sidebarSheet }),
  setInspectorSheet: (inspectorSheet) => set({ inspectorSheet }),
}));
