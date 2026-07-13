import type { Region } from '../types';

export interface CollabUser {
  id: string;
  name: string;
  color: string;
}

export type CollabOpType =
  | 'region:create'
  | 'region:update'
  | 'region:delete'
  | 'region:reorder'
  | 'page:select';

export interface CollabOp {
  id: string;
  type: CollabOpType;
  userId: string;
  timestamp: number;
  pageId: string;
  payload: Record<string, unknown>;
}

export type CollabMessage =
  | { type: 'join'; user: CollabUser }
  | { type: 'leave'; userId: string }
  | { type: 'op'; op: CollabOp }
  | { type: 'state'; regions: Region[]; users: CollabUser[] }
  | { type: 'users'; users: CollabUser[] }
  | { type: 'ack'; opId: string };

export interface CollabState {
  connected: boolean;
  users: CollabUser[];
  pendingOps: CollabOp[];
  reconnecting: boolean;
}
