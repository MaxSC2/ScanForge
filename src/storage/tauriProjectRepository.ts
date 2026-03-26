import { invoke } from '@tauri-apps/api/core';
import type { LocalProjectSaveResult, LocalProjectSummary, ProjectFile } from '../types';
import type { ProjectRepository } from './projectRepository';

export const tauriProjectRepository: ProjectRepository = {
  saveProject(project) {
    return invoke<LocalProjectSaveResult>('save_project_snapshot', { project });
  },

  loadProject(id) {
    return invoke<ProjectFile>('load_project_snapshot', { id });
  },

  loadLatestProject() {
    return invoke<ProjectFile | null>('load_latest_project_snapshot');
  },

  listProjects() {
    return invoke<LocalProjectSummary[]>('list_project_summaries');
  },
};
