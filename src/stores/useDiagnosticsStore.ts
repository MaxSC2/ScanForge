import { create } from 'zustand';
import {
  createDiagnosticEntry,
  shouldMergeDiagnostic,
} from '../services/diagnostics';
import type { DiagnosticEntry, DiagnosticInput } from '../types';

const MAX_DIAGNOSTICS = 30;

let nextDiagnosticId = 1;

interface DiagnosticsState {
  entries: DiagnosticEntry[];
  record: (input: DiagnosticInput) => void;
  clear: () => void;
}

export const useDiagnosticsStore = create<DiagnosticsState>((set) => ({
  entries: [],

  record: (input) =>
    set((state) => {
      const timestamp = input.timestamp ?? Date.now();
      const latest = state.entries[0];

      if (shouldMergeDiagnostic(latest, input, timestamp)) {
        return {
          entries: [
            {
              ...latest,
              timestamp,
              count: latest.count + 1,
            },
            ...state.entries.slice(1),
          ],
        };
      }

      const entry = createDiagnosticEntry(
        `diag-${nextDiagnosticId++}`,
        input,
        timestamp,
      );

      return {
        entries: [entry, ...state.entries].slice(0, MAX_DIAGNOSTICS),
      };
    }),

  clear: () => set({ entries: [] }),
}));
