import { create } from 'zustand';
import type { AiConfig } from '../services/ai/types';

const STORAGE_KEY = 'scanforge.ai.presets';

export interface AiPreset {
  id: string;
  name: string;
  config: AiConfig;
  systemPrompt?: string;
  createdAt: number;
}

function loadPresets(): AiPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: AiPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

function makeId() {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface AiPresetsState {
  presets: AiPreset[];
  load: () => void;
  add: (name: string, config: AiConfig, systemPrompt?: string) => string;
  update: (id: string, patch: Partial<AiPreset>) => void;
  remove: (id: string) => void;
  getById: (id: string) => AiPreset | undefined;
}

export const useAiPresetsStore = create<AiPresetsState>((set, get) => ({
  presets: loadPresets(),
  load: () => set({ presets: loadPresets() }),
  add: (name, config, systemPrompt) => {
    const id = makeId();
    const preset: AiPreset = { id, name, config, systemPrompt, createdAt: Date.now() };
    const next = [...get().presets, preset];
    savePresets(next);
    set({ presets: next });
    return id;
  },
  update: (id, patch) => {
    const next = get().presets.map((p) => (p.id === id ? { ...p, ...patch } : p));
    savePresets(next);
    set({ presets: next });
  },
  remove: (id) => {
    const next = get().presets.filter((p) => p.id !== id);
    savePresets(next);
    set({ presets: next });
  },
  getById: (id) => get().presets.find((p) => p.id === id),
}));
