import { create } from 'zustand';
import {
  createDiagnosticEntry,
  shouldMergeDiagnostic,
} from '../services/diagnostics';
import { diagnosticRepository } from '../repositories';
import { useProjectStore } from './useProjectStore';
import type { DiagnosticEntry, DiagnosticEntity, DiagnosticInput } from '../types';

const MAX_DIAGNOSTICS = 30;

let nextDiagnosticId = 1;

function toDiagnosticEntity(entry: DiagnosticEntry): DiagnosticEntity | null {
  if (!entry.projectId) {
    return null;
  }

  return {
    id: entry.id,
    projectId: entry.projectId,
    scope: entry.scope,
    level: entry.level,
    message: entry.message,
    timestamp: entry.timestamp,
    count: entry.count,
    ...(entry.detail ? { detail: entry.detail } : {}),
    ...(entry.pageId ? { pageId: entry.pageId } : {}),
    ...(entry.regionId ? { regionId: entry.regionId } : {}),
    ...(entry.jobId ? { jobId: entry.jobId } : {}),
  };
}

function toDiagnosticEntry(entity: DiagnosticEntity): DiagnosticEntry {
  return {
    id: entity.id,
    scope: entity.scope as DiagnosticEntry['scope'],
    level: entity.level as DiagnosticEntry['level'],
    message: entity.message,
    timestamp: entity.timestamp,
    count: entity.count,
    ...(entity.detail ? { detail: entity.detail } : {}),
    projectId: entity.projectId,
    ...(entity.pageId ? { pageId: entity.pageId } : {}),
    ...(entity.regionId ? { regionId: entity.regionId } : {}),
    ...(entity.jobId ? { jobId: entity.jobId } : {}),
  };
}

interface DiagnosticsState {
  entries: DiagnosticEntry[];
  currentProjectId: string | null;
  record: (input: DiagnosticInput) => void;
  clear: () => void;
  hydrateProject: (projectId?: string | null) => Promise<void>;
}

export const useDiagnosticsStore = create<DiagnosticsState>((set, get) => ({
  entries: [],
  currentProjectId: null,

  record: (input) => {
    let persistedEntry: DiagnosticEntry | null = null;

    set((state) => {
      const timestamp = input.timestamp ?? Date.now();
      const projectId =
        input.projectId ?? state.currentProjectId ?? useProjectStore.getState().meta.localProjectId;
      const normalizedInput = {
        ...input,
        ...(projectId ? { projectId } : {}),
      };
      const latest = state.entries[0];

      if (shouldMergeDiagnostic(latest, normalizedInput, timestamp)) {
        persistedEntry = {
          ...latest,
          timestamp,
          count: latest.count + 1,
        };
        return {
          entries: [
            persistedEntry,
            ...state.entries.slice(1),
          ],
        };
      }

      const entry = createDiagnosticEntry(
        `diag-${nextDiagnosticId++}`,
        normalizedInput,
        timestamp,
      );
      persistedEntry = entry;

      return {
        entries: [entry, ...state.entries].slice(0, MAX_DIAGNOSTICS),
      };
    });

    const entity = persistedEntry ? toDiagnosticEntity(persistedEntry) : null;
    if (entity) {
      void diagnosticRepository.upsert(entity);
    }
  },

  clear: () => {
    const projectId = get().currentProjectId;
    set({ entries: [] });
    if (projectId) {
      void diagnosticRepository.deleteByProject(projectId);
    }
  },

  hydrateProject: async (projectId) => {
    if (!projectId) {
      set({ entries: [], currentProjectId: null });
      return;
    }

    const entries = (await diagnosticRepository.listByProject(projectId))
      .map(toDiagnosticEntry)
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, MAX_DIAGNOSTICS);
    set({ entries, currentProjectId: projectId });
  },
}));
