import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TextAlign } from '../types/textStyle';

export interface TextStylePreset {
  id: string;
  name: string;
  createdAt: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  align: TextAlign;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

interface TextStylePresetsState {
  presets: TextStylePreset[];
  savePreset: (name: string, style: Omit<TextStylePreset, 'id' | 'name' | 'createdAt'>) => void;
  deletePreset: (id: string) => void;
}

export const useTextStylePresetsStore = create<TextStylePresetsState>()(
  persist(
    (set) => ({
      presets: [],

      savePreset: (name, style) => {
        set((s) => ({
          presets: [
            ...s.presets,
            { ...style, id: crypto.randomUUID?.() ?? `${Date.now()}`, name, createdAt: Date.now() },
          ],
        }));
      },

      deletePreset: (id) => {
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
      },
    }),
    { name: 'scanforge-text-style-presets' },
  ),
);
