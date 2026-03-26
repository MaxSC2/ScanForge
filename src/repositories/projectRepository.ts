import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ProjectRecord } from '../types';
import {
  cloneDomainValue,
  readBrowserDomainState,
  writeBrowserDomainState,
} from './browserDomainState';

export class ProjectRepository {
  async list(): Promise<ProjectRecord[]> {
    if (isTauri()) {
      return invoke<ProjectRecord[]>('list_project_records');
    }

    const state = readBrowserDomainState();
    return Object.values(state.projects)
      .map((project) => cloneDomainValue(project))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async getById(id: string): Promise<ProjectRecord | null> {
    if (isTauri()) {
      return invoke<ProjectRecord | null>('get_project_record', { id });
    }

    const state = readBrowserDomainState();
    const project = state.projects[id];
    return project ? cloneDomainValue(project) : null;
  }

  async create(project: ProjectRecord): Promise<ProjectRecord> {
    return this.upsert(project);
  }

  async update(project: ProjectRecord): Promise<ProjectRecord> {
    return this.upsert(project);
  }

  async delete(id: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_project_record', { id });
      return;
    }

    const state = readBrowserDomainState();
    const pageIds = Object.values(state.pages)
      .filter((page) => page.projectId === id)
      .map((page) => page.id);

    delete state.projects[id];

    for (const pageId of pageIds) {
      delete state.pages[pageId];
      for (const region of Object.values(state.regions)) {
        if (region.pageId === pageId) {
          delete state.regions[region.id];
        }
      }
    }

    for (const job of Object.values(state.jobs)) {
      if (job.projectId === id) {
        delete state.jobs[job.id];
      }
    }

    delete state.projectSettings[id];

    for (const style of Object.values(state.textStyles)) {
      if (style.projectId === id) {
        delete state.textStyles[style.id];
      }
    }

    writeBrowserDomainState(state);
  }

  private async upsert(project: ProjectRecord): Promise<ProjectRecord> {
    if (isTauri()) {
      return invoke<ProjectRecord>('upsert_project_record', { project });
    }

    const state = readBrowserDomainState();
    state.projects[project.id] = cloneDomainValue(project);
    writeBrowserDomainState(state);
    return cloneDomainValue(project);
  }
}

export const projectRepository = new ProjectRepository();
