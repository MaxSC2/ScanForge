import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type { RegionTemplate } from './types';
import { BUILTIN_TEMPLATES } from './presets';

interface TemplateStore {
  customTemplates: RegionTemplate[];
  addTemplate: (t: Omit<RegionTemplate, 'id'>) => void;
  removeTemplate: (id: string) => void;
  updateTemplate: (id: string, patch: Partial<RegionTemplate>) => void;
  getAllTemplates: () => RegionTemplate[];
}

export const useTemplateStore = create<TemplateStore>()(
  persist(
    (set, get) => ({
      customTemplates: [],

      addTemplate: (t) =>
        set((s) => ({
          customTemplates: [...s.customTemplates, { ...t, id: uuid() }],
        })),

      removeTemplate: (id) =>
        set((s) => ({
          customTemplates: s.customTemplates.filter((t) => t.id !== id),
        })),

      updateTemplate: (id, patch) =>
        set((s) => ({
          customTemplates: s.customTemplates.map((t) =>
            t.id === id ? { ...t, ...patch } : t,
          ),
        })),

      getAllTemplates: () => {
        const builtin = BUILTIN_TEMPLATES.flatMap((c) => c.templates);
        return [...builtin, ...get().customTemplates];
      },
    }),
    { name: 'scanforge-templates' },
  ),
);
