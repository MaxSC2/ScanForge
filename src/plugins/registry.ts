import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PluginManifest } from './types';

export interface PluginEntry {
  manifest: PluginManifest;
  enabled: boolean;
}

interface PluginRegistryState {
  plugins: PluginEntry[];
  registerPlugin: (manifest: PluginManifest) => void;
  unregisterPlugin: (id: string) => void;
  setEnabled: (id: string, enabled: boolean) => void;
}

export const usePluginRegistry = create<PluginRegistryState>()(
  persist(
    (set) => ({
      plugins: [],

      registerPlugin: (manifest) => {
        set((s) => {
          if (s.plugins.find((p) => p.manifest.id === manifest.id)) {
            return s;
          }
          return { plugins: [...s.plugins, { manifest, enabled: true }] };
        });
      },

      unregisterPlugin: (id) => {
        set((s) => ({ plugins: s.plugins.filter((p) => p.manifest.id !== id) }));
      },

      setEnabled: (id, enabled) => {
        set((s) => ({
          plugins: s.plugins.map((p) =>
            p.manifest.id === id ? { ...p, enabled } : p,
          ),
        }));
      },
    }),
    { name: 'scanforge-plugins' },
  ),
);
