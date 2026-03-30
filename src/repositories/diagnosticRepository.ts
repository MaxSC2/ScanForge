import { invoke, isTauri } from '@tauri-apps/api/core';
import type { DiagnosticEntity } from '../types';
import {
  cloneDomainValue,
  readBrowserDomainState,
  writeBrowserDomainState,
} from './browserDomainState';

export class DiagnosticRepository {
  async listByProject(projectId: string): Promise<DiagnosticEntity[]> {
    if (isTauri()) {
      return invoke<DiagnosticEntity[]>('list_diagnostic_entities_by_project', { projectId });
    }

    const state = readBrowserDomainState();
    return Object.values(state.diagnostics)
      .filter((entry) => entry.projectId === projectId)
      .map((entry) => cloneDomainValue(entry))
      .sort((left, right) => right.timestamp - left.timestamp);
  }

  async upsert(entry: DiagnosticEntity): Promise<DiagnosticEntity> {
    if (isTauri()) {
      return invoke<DiagnosticEntity>('upsert_diagnostic_entity', { entry });
    }

    const state = readBrowserDomainState();
    state.diagnostics[entry.id] = cloneDomainValue(entry);
    writeBrowserDomainState(state);
    return cloneDomainValue(entry);
  }

  async delete(id: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_diagnostic_entity', { id });
      return;
    }

    const state = readBrowserDomainState();
    delete state.diagnostics[id];
    writeBrowserDomainState(state);
  }

  async deleteByProject(projectId: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_diagnostic_entities_by_project', { projectId });
      return;
    }

    const state = readBrowserDomainState();
    for (const entry of Object.values(state.diagnostics)) {
      if (entry.projectId === projectId) {
        delete state.diagnostics[entry.id];
      }
    }
    writeBrowserDomainState(state);
  }
}

export const diagnosticRepository = new DiagnosticRepository();
