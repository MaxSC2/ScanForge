import { invoke } from '@tauri-apps/api/core';
import type {
  LocalProjectLoadResult,
  LocalProjectSaveResult,
  LocalProjectSummary,
  ProjectFile,
} from '../types';
import type { ProjectRepository } from './projectRepository';

export const tauriProjectRepository: ProjectRepository = {
  saveProject(project) {
    return invoke<LocalProjectSaveResult>('save_project_snapshot', { project });
  },

  loadProject(id) {
    return invoke<LocalProjectLoadResult>('load_project_snapshot', { id });
  },

  loadLatestProject() {
    return invoke<LocalProjectLoadResult | null>('load_latest_project_snapshot');
  },

  listProjects() {
    return invoke<LocalProjectSummary[]>('list_project_summaries');
  },
};
