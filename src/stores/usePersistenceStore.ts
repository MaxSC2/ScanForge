import { create } from 'zustand';

export type PersistenceSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface PersistenceState {
  saveState: PersistenceSaveState;
  lastSavedAt: number | null;
  lastError: string | null;
  recoveryNotice: string | null;
  markPending: () => void;
  markSaving: () => void;
  markSaved: (timestamp?: number) => void;
  markError: (message: string) => void;
  setRecoveryNotice: (message: string | null) => void;
  reset: () => void;
}

export const usePersistenceStore = create<PersistenceState>((set) => ({
  saveState: 'idle',
  lastSavedAt: null,
  lastError: null,
  recoveryNotice: null,

  markPending: () =>
    set((state) => ({
      saveState: state.saveState === 'saving' ? 'saving' : 'pending',
      lastError: null,
    })),

  markSaving: () =>
    set({
      saveState: 'saving',
      lastError: null,
    }),

  markSaved: (timestamp = Date.now()) =>
    set({
      saveState: 'saved',
      lastSavedAt: timestamp,
      lastError: null,
      recoveryNotice: null,
    }),

  markError: (message) =>
    set({
      saveState: 'error',
      lastError: message,
    }),

  setRecoveryNotice: (message) =>
    set({
      recoveryNotice: message,
    }),

  reset: () =>
    set({
      saveState: 'idle',
      lastSavedAt: null,
      lastError: null,
      recoveryNotice: null,
    }),
}));
