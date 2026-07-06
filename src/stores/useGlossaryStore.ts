import { create } from 'zustand';
import type { GlossaryEntry } from '../types/glossary';

const STORAGE_KEY = 'scanforge.glossary';

interface GlossaryState {
  entries: GlossaryEntry[];
  addEntry: (source: string, translated: string, language: string) => void;
  updateEntry: (id: string, patch: Partial<Pick<GlossaryEntry, 'source' | 'translated'>>) => void;
  removeEntry: (id: string) => void;
  lookup: (source: string, language?: string) => string | undefined;
  search: (query: string) => GlossaryEntry[];
  importJSON: (json: string) => void;
  exportJSON: () => string;
}

function loadEntries(): GlossaryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GlossaryEntry[];
  } catch {
    return [];
  }
}

function persistEntries(entries: GlossaryEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export const useGlossaryStore = create<GlossaryState>((set, get) => ({
  entries: loadEntries(),

  addEntry: (source, translated, language) => {
    const newEntry: GlossaryEntry = {
      id: crypto.randomUUID(),
      source,
      translated,
      language,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => {
      const entries = [...s.entries, newEntry];
      persistEntries(entries);
      return { entries };
    });
  },

  updateEntry: (id, patch) => {
    set((s) => {
      const entries = s.entries.map((e) =>
        e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e,
      );
      persistEntries(entries);
      return { entries };
    });
  },

  removeEntry: (id) => {
    set((s) => {
      const entries = s.entries.filter((e) => e.id !== id);
      persistEntries(entries);
      return { entries };
    });
  },

  lookup: (source, language) => {
    const { entries } = get();
    if (language) {
      const match = entries.find(
        (e) => e.source.toLowerCase() === source.toLowerCase() && e.language === language,
      );
      if (match) return match.translated;
    }
    const match = entries.find(
      (e) => e.source.toLowerCase() === source.toLowerCase(),
    );
    return match?.translated;
  },

  search: (query) => {
    const { entries } = get();
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(
      (e) =>
        e.source.toLowerCase().includes(q) ||
        e.translated.toLowerCase().includes(q),
    );
  },

  importJSON: (json) => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) throw new Error('Expected array');
      const entries = parsed as GlossaryEntry[];
      persistEntries(entries);
      set({ entries });
    } catch (err) {
      throw new Error(`Ошибка импорта: ${err instanceof Error ? err.message : 'Invalid format'}`);
    }
  },

  exportJSON: () => {
    const { entries } = get();
    return JSON.stringify(entries, null, 2);
  },
}));
