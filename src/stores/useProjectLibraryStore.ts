import { create } from 'zustand';
import type { LocalProjectSummary, ProjectFile } from '../types';
import { getProjectRepository } from '../storage';
import { useEditorStore } from './useEditorStore';
import { useHistoryStore } from './useHistoryStore';
import { usePageStore } from './usePageStore';
import { createProjectMeta, useProjectStore } from './useProjectStore';
import { useRegionStore } from './useRegionStore';
import { useToastStore } from './useToastStore';
import { hydrateProjectFile } from '../utils/persistence';

interface ProjectLibraryState {
  summaries: LocalProjectSummary[];
  loading: boolean;
  switchingProjectId: string | null;
  refresh: () => Promise<void>;
  createProject: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
}

const repository = getProjectRepository();
const NEW_PROJECT_TOKEN = '__new__';

async function applyProject(project: ProjectFile) {
  const hydrated = await hydrateProjectFile(project);
  useProjectStore.getState().setMeta(hydrated.meta);
  usePageStore.getState().setProjectState({
    pages: hydrated.pages,
    activePageId: hydrated.activePageId,
  });
  useRegionStore.getState().selectRegion(null);
  useHistoryStore.getState().clear();

  if (hydrated.pages.length > 0) {
    useEditorStore.getState().requestFitToPage();
  } else {
    useEditorStore.getState().resetZoom();
  }
}

export const useProjectLibraryStore = create<ProjectLibraryState>((set, get) => ({
  summaries: [],
  loading: false,
  switchingProjectId: null,

  refresh: async () => {
    set({ loading: true });
    try {
      const summaries = await repository.listProjects();
      set({ summaries, loading: false });
    } catch (error) {
      set({ loading: false });
      console.warn('Project library refresh failed:', error);
    }
  },

  createProject: async () => {
    if (get().switchingProjectId) return;
    set({ switchingProjectId: NEW_PROJECT_TOKEN });
    try {
      const project: ProjectFile = {
        version: 1,
        meta: createProjectMeta(),
        pages: [],
        activePageId: null,
      };
      const result = await repository.saveProject(project);
      await applyProject(result.project);
      const summaries = await repository.listProjects();
      set({ summaries, switchingProjectId: null });
      useToastStore.getState().push('Создан новый локальный проект', 'success');
    } catch (error) {
      set({ switchingProjectId: null });
      console.warn('New local project creation failed:', error);
      useToastStore.getState().push('Не удалось создать локальный проект', 'error');
    }
  },

  loadProject: async (id) => {
    if (get().switchingProjectId) return;
    set({ switchingProjectId: id });
    try {
      const project = await repository.loadProject(id);
      await applyProject(project);
      const summaries = await repository.listProjects();
      set({ summaries, switchingProjectId: null });
      useToastStore.getState().push('Локальный проект загружен', 'success');
    } catch (error) {
      set({ switchingProjectId: null });
      console.warn('Local project load failed:', error);
      useToastStore.getState().push('Не удалось открыть локальный проект', 'error');
    }
  },
}));
