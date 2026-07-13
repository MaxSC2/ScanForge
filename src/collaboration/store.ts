import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CollabUser, CollabOp, CollabState } from './types';

interface CollabStore extends CollabState {
  userName: string;
  serverUrl: string;
  setConnected: (v: boolean) => void;
  setReconnecting: (v: boolean) => void;
  setUsers: (users: CollabUser[]) => void;
  addPendingOp: (op: CollabOp) => void;
  removePendingOp: (opId: string) => void;
  setServerUrl: (url: string) => void;
  setUserName: (name: string) => void;
  reset: () => void;
}

const initial: CollabState = {
  connected: false,
  users: [],
  pendingOps: [],
  reconnecting: false,
};

export const useCollabStore = create<CollabStore>()(
  persist(
    (set) => ({
      ...initial,
      userName: '',
      serverUrl: 'ws://localhost:8080',

      setConnected: (connected) => set({ connected, reconnecting: false }),
      setReconnecting: (reconnecting) => set({ reconnecting }),
      setUsers: (users) => set({ users }),
      addPendingOp: (op) => set((s) => ({ pendingOps: [...s.pendingOps, op] })),
      removePendingOp: (opId) =>
        set((s) => ({ pendingOps: s.pendingOps.filter((o) => o.id !== opId) })),
      setServerUrl: (serverUrl) => set({ serverUrl }),
      setUserName: (userName) => set({ userName }),
      reset: () => set(initial),
    }),
    { name: 'scanforge-collab' },
  ),
);
