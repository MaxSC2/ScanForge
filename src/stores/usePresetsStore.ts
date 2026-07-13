import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OcrEngineId, ProjectSourceLanguage, ProjectTargetLanguage, TranslationProviderId, InpaintingProviderId } from '../types/projectSettings';

export interface Preset {
  id: string;
  name: string;
  createdAt: number;
  sourceLanguage: ProjectSourceLanguage;
  targetLanguage: ProjectTargetLanguage;
  ocrEngine: OcrEngineId;
  translationProvider: TranslationProviderId;
  inpaintingProvider: InpaintingProviderId;
  autoRunOcr: boolean;
}

interface PresetsState {
  presets: Preset[];
  savePreset: (name: string, settings: Omit<Preset, 'id' | 'name' | 'createdAt'>) => void;
  deletePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
}

export const usePresetsStore = create<PresetsState>()(
  persist(
    (set) => ({
      presets: [],

      savePreset: (name, settings) => {
        set((s) => ({
          presets: [
            ...s.presets,
            { ...settings, id: crypto.randomUUID?.() ?? `${Date.now()}`, name, createdAt: Date.now() },
          ],
        }));
      },

      deletePreset: (id) => {
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
      },

      renamePreset: (id, name) => {
        set((s) => ({
          presets: s.presets.map((p) => (p.id === id ? { ...p, name } : p)),
        }));
      },
    }),
    { name: 'scanforge-presets' },
  ),
);
