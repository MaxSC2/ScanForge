import { create } from 'zustand';
import type { ProjectMeta } from '../types';

interface ProjectState {
  meta: ProjectMeta;
  setName: (name: string) => void;
  touch: () => void;
  setMeta: (meta: ProjectMeta) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  meta: {
    name: 'Новый проект',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  setName: (name) =>
    set((s) => ({ meta: { ...s.meta, name, updatedAt: Date.now() } })),
  touch: () =>
    set((s) => ({ meta: { ...s.meta, updatedAt: Date.now() } })),
  setMeta: (meta) => set({ meta }),
}));
