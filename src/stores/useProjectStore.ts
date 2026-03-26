import { create } from 'zustand';
import type { ProjectMeta } from '../types';

interface ProjectState {
  meta: ProjectMeta;
  setName: (name: string) => void;
  touch: () => void;
  setMeta: (meta: ProjectMeta) => void;
}

export function createProjectMeta(name = 'Новый проект'): ProjectMeta {
  const now = Date.now();
  return {
    name,
    createdAt: now,
    updatedAt: now,
  };
}

export const useProjectStore = create<ProjectState>((set) => ({
  meta: createProjectMeta(),
  setName: (name) =>
    set((state) => ({ meta: { ...state.meta, name, updatedAt: Date.now() } })),
  touch: () =>
    set((state) => ({ meta: { ...state.meta, updatedAt: Date.now() } })),
  setMeta: (meta) => set({ meta }),
}));
