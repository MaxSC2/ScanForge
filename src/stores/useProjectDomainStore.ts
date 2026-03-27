import { create } from 'zustand';
import { formatDiagnosticError } from '../services/diagnostics';
import type {
  ProjectSettingsRecord,
  TextStyleRecord,
} from '../types';
import {
  loadProjectDomainContext,
} from '../repositories/projectDefaults';
import { projectSettingsRepository } from '../repositories/projectSettingsRepository';
import { textStyleRepository } from '../repositories/textStyleRepository';
import { useDiagnosticsStore } from './useDiagnosticsStore';

interface ProjectDomainState {
  projectId: string | null;
  loading: boolean;
  settings: ProjectSettingsRecord | null;
  textStyles: TextStyleRecord[];
  hydrateProjectDomain: (projectId: string | null | undefined) => Promise<void>;
  updateSettings: (patch: Partial<ProjectSettingsRecord>) => Promise<ProjectSettingsRecord | null>;
  upsertTextStyle: (style: TextStyleRecord) => Promise<TextStyleRecord | null>;
  deleteTextStyle: (id: string) => Promise<void>;
  reset: () => void;
}

export const useProjectDomainStore = create<ProjectDomainState>((set, get) => ({
  projectId: null,
  loading: false,
  settings: null,
  textStyles: [],

  hydrateProjectDomain: async (projectId) => {
    if (!projectId) {
      set({
        projectId: null,
        loading: false,
        settings: null,
        textStyles: [],
      });
      return;
    }

    set({ loading: true });

    try {
      const context = await loadProjectDomainContext(projectId);
      set({
        projectId,
        loading: false,
        settings: context.settings,
        textStyles: context.textStyles,
      });
    } catch (error) {
      console.warn('Project domain hydration failed:', error);
      useDiagnosticsStore.getState().record({
        scope: 'project',
        level: 'warning',
        message: 'Project domain hydration failed',
        detail: formatDiagnosticError(error, 'Project domain hydration failed'),
        ...(projectId ? { projectId } : {}),
      });
      set({
        projectId,
        loading: false,
        settings: null,
        textStyles: [],
      });
    }
  },

  updateSettings: async (patch) => {
    const { projectId, settings } = get();
    if (!projectId || !settings) {
      return null;
    }

    const nextSettings: ProjectSettingsRecord = {
      ...settings,
      ...patch,
      projectId,
    };
    const saved = await projectSettingsRepository.update(nextSettings);
    set({ settings: saved });
    return saved;
  },

  upsertTextStyle: async (style) => {
    const { projectId, textStyles } = get();
    if (!projectId) {
      return null;
    }

    const saved = await textStyleRepository.update({
      ...style,
      projectId,
    });
    set({
      textStyles: [...textStyles.filter((item) => item.id !== saved.id), saved].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    });
    return saved;
  },

  deleteTextStyle: async (id) => {
    const { settings, textStyles } = get();
    await textStyleRepository.delete(id);

    const remainingStyles = textStyles.filter((style) => style.id !== id);
    set({ textStyles: remainingStyles });

    if (settings?.defaultTextStyleId === id) {
      const fallbackId = remainingStyles[0]?.id;
      if (fallbackId) {
        await get().updateSettings({ defaultTextStyleId: fallbackId });
      }
    }
  },

  reset: () =>
    set({
      projectId: null,
      loading: false,
      settings: null,
      textStyles: [],
    }),
}));
