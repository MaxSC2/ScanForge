import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ProjectSettingsRecord } from '../types';
import {
  cloneDomainValue,
  readBrowserDomainState,
  writeBrowserDomainState,
} from './browserDomainState';

export class ProjectSettingsRepository {
  async getByProjectId(projectId: string): Promise<ProjectSettingsRecord | null> {
    if (isTauri()) {
      return invoke<ProjectSettingsRecord | null>('get_project_settings_record', { projectId });
    }

    const state = readBrowserDomainState();
    const settings = state.projectSettings[projectId];
    return settings ? cloneDomainValue(settings) : null;
  }

  async create(settings: ProjectSettingsRecord): Promise<ProjectSettingsRecord> {
    return this.upsert(settings);
  }

  async update(settings: ProjectSettingsRecord): Promise<ProjectSettingsRecord> {
    return this.upsert(settings);
  }

  async delete(projectId: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_project_settings_record', { projectId });
      return;
    }

    const state = readBrowserDomainState();
    delete state.projectSettings[projectId];
    writeBrowserDomainState(state);
  }

  private async upsert(settings: ProjectSettingsRecord): Promise<ProjectSettingsRecord> {
    if (isTauri()) {
      return invoke<ProjectSettingsRecord>('upsert_project_settings_record', { settings });
    }

    const state = readBrowserDomainState();
    state.projectSettings[settings.projectId] = cloneDomainValue(settings);
    writeBrowserDomainState(state);
    return cloneDomainValue(settings);
  }
}

export const projectSettingsRepository = new ProjectSettingsRepository();
