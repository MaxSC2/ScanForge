import { create } from 'zustand';
import type { AiConfig } from '../services/ai/types';

const STORAGE_KEY = 'scanforge.ai.presets';

/** A saved AI provider preset containing provider config, optional custom system prompt, and creation timestamp. */
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

/** Zustand state and CRUD actions for managing AI presets. Data is persisted to localStorage under `scanforge.ai.presets`. */
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
  /** Reloads presets from localStorage into state. Useful for syncing after external changes. */
  load: () => set({ presets: loadPresets() }),
  /**
   * Creates a new preset with a unique ID and timestamp, persists to localStorage, and updates state.
   * @returns The ID of the newly created preset.
   */
  add: (name, config, systemPrompt) => {
    const id = makeId();
    const preset: AiPreset = { id, name, config, systemPrompt, createdAt: Date.now() };
    const next = [...get().presets, preset];
    savePresets(next);
    set({ presets: next });
    return id;
  },
  /** Partially updates an existing preset by ID. Persists changes to localStorage immediately. */
  update: (id, patch) => {
    const next = get().presets.map((p) => (p.id === id ? { ...p, ...patch } : p));
    savePresets(next);
    set({ presets: next });
  },
  /** Removes a preset by ID. Persists the updated list to localStorage. */
  remove: (id) => {
    const next = get().presets.filter((p) => p.id !== id);
    savePresets(next);
    set({ presets: next });
  },
  /** Returns a preset by ID from the current state, or undefined if not found. */
  getById: (id) => get().presets.find((p) => p.id === id),
}));
