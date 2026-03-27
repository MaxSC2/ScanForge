import { create } from 'zustand';
import type { LocalProjectSummary, ProjectFile } from '../types';
import { formatDiagnosticError } from '../services/diagnostics';
import { getProjectRepository } from '../storage';
import { useDiagnosticsStore } from './useDiagnosticsStore';
import { useEditorStore } from './useEditorStore';
import { useHistoryStore } from './useHistoryStore';
import { useProjectDomainStore } from './useProjectDomainStore';
import { useJobStore } from './useJobStore';
import { usePageStore } from './usePageStore';
import { usePersistenceStore } from './usePersistenceStore';
import { createProjectMeta, useProjectStore } from './useProjectStore';
import { useRegionStore } from './useRegionStore';
import { useToastStore } from './useToastStore';
import { mergePagesWithRepository, mergeRegionsWithRepository } from '../repositories';
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
  const pagesWithDomainAssets = await mergePagesWithRepository(hydrated.meta, hydrated.pages);
  const pages = await mergeRegionsWithRepository(pagesWithDomainAssets);
  const activePageId = pages.some((page) => page.id === hydrated.activePageId)
    ? hydrated.activePageId
    : pages[0]?.id ?? null;
  useProjectStore.getState().setMeta(hydrated.meta);
  usePageStore.getState().setProjectState({
    pages,
    activePageId,
  });
  await useProjectDomainStore.getState().hydrateProjectDomain(hydrated.meta.localProjectId);
  await useJobStore.getState().loadJobsForCurrentProject();
  useRegionStore.getState().selectRegion(null);
  useHistoryStore.getState().clear();

  if (pages.length > 0) {
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
      useDiagnosticsStore.getState().record({
        scope: 'project',
        level: 'warning',
        message: 'Project library refresh failed',
        detail: formatDiagnosticError(error, 'Project library refresh failed'),
      });
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
      usePersistenceStore.getState().markSaved(result.project.meta.updatedAt);
      usePersistenceStore.getState().setRecoveryNotice(null);
      useToastStore.getState().push('Создан новый локальный проект', 'success');
    } catch (error) {
      set({ switchingProjectId: null });
      console.warn('New local project creation failed:', error);
      useDiagnosticsStore.getState().record({
        scope: 'project',
        level: 'error',
        message: 'New local project creation failed',
        detail: formatDiagnosticError(error, 'New local project creation failed'),
      });
      useToastStore.getState().push('Не удалось создать локальный проект', 'error');
    }
  },

  loadProject: async (id) => {
    if (get().switchingProjectId) return;
    set({ switchingProjectId: id });
    try {
      const loadResult = await repository.loadProject(id);
      await applyProject(loadResult.project);
      const summaries = await repository.listProjects();
      set({ summaries, switchingProjectId: null });
      usePersistenceStore.getState().markSaved(loadResult.project.meta.updatedAt);
      usePersistenceStore.getState().setRecoveryNotice(loadResult.warning ?? null);
      if (loadResult.warning) {
        useDiagnosticsStore.getState().record({
          scope: 'recovery',
          level: 'warning',
          message: 'Project loaded with recovery warning',
          detail: loadResult.warning,
          ...(loadResult.project.meta.localProjectId
            ? { projectId: loadResult.project.meta.localProjectId }
            : {}),
        });
        useToastStore.getState().push(loadResult.warning, 'warning');
      }
      useToastStore.getState().push('Локальный проект загружен', 'success');
    } catch (error) {
      set({ switchingProjectId: null });
      console.warn('Local project load failed:', error);
      useDiagnosticsStore.getState().record({
        scope: 'project',
        level: 'error',
        message: 'Local project load failed',
        detail: formatDiagnosticError(error, 'Local project load failed'),
        ...(id ? { projectId: id } : {}),
      });
      useToastStore.getState().push('Не удалось открыть локальный проект', 'error');
    }
  },
}));
