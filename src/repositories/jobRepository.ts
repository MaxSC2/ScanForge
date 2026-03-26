import { invoke, isTauri } from '@tauri-apps/api/core';
import type { JobEntity } from '../types';
import {
  cloneDomainValue,
  readBrowserDomainState,
  writeBrowserDomainState,
} from './browserDomainState';

export class JobRepository {
  async listByProject(projectId: string): Promise<JobEntity[]> {
    if (isTauri()) {
      return invoke<JobEntity[]>('list_job_entities_by_project', { projectId });
    }

    const state = readBrowserDomainState();
    return Object.values(state.jobs)
      .filter((job) => job.projectId === projectId)
      .map((job) => cloneDomainValue(job))
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  async getById(id: string): Promise<JobEntity | null> {
    if (isTauri()) {
      return invoke<JobEntity | null>('get_job_entity', { id });
    }

    const state = readBrowserDomainState();
    const job = state.jobs[id];
    return job ? cloneDomainValue(job) : null;
  }

  async create(job: JobEntity): Promise<JobEntity> {
    return this.upsert(job);
  }

  async update(job: JobEntity): Promise<JobEntity> {
    return this.upsert(job);
  }

  async delete(id: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_job_entity', { id });
      return;
    }

    const state = readBrowserDomainState();
    delete state.jobs[id];
    writeBrowserDomainState(state);
  }

  async deleteByProject(projectId: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_job_entities_by_project', { projectId });
      return;
    }

    const state = readBrowserDomainState();
    for (const job of Object.values(state.jobs)) {
      if (job.projectId === projectId) {
        delete state.jobs[job.id];
      }
    }
    writeBrowserDomainState(state);
  }

  private async upsert(job: JobEntity): Promise<JobEntity> {
    if (isTauri()) {
      return invoke<JobEntity>('upsert_job_entity', { job });
    }

    const state = readBrowserDomainState();
    state.jobs[job.id] = cloneDomainValue(job);
    writeBrowserDomainState(state);
    return cloneDomainValue(job);
  }
}

export const jobRepository = new JobRepository();
