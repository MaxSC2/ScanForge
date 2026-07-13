import type { Region } from '../types';
import { usePageStore } from '../stores/usePageStore';
import { useRegionStore } from '../stores/useRegionStore';
import { useToastStore } from '../stores/useToastStore';
import { useCollabStore } from './store';
import { t } from '../i18n';
import type { CollabOp, CollabMessage, CollabUser } from './types';
import {
  initCrdtMeta,
  writeLocal,
  resolveRemote,
  markDeleted,
  clearCrdtMeta,
  clearAllCrdtMeta,
  buildVersionMap,
} from './crdt';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let userInfo: CollabUser | null = null;

function getUserId(): string {
  let id = localStorage.getItem('scanforge-collab-userid');
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    localStorage.setItem('scanforge-collab-userid', id);
  }
  return id;
}

function getUserColor(id: string): string {
  const colors = [
    '#6366f1', '#22d3ee', '#f472b6', '#34d399',
    '#fb923c', '#a78bfa', '#facc15', '#f87171',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function send(msg: CollabMessage) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function handleMessage(data: CollabMessage) {
  const store = useCollabStore.getState();

  switch (data.type) {
    case 'users':
      store.setUsers(data.users);
      break;

    case 'state':
      store.setUsers(data.users);
      clearAllCrdtMeta();
      break;

    case 'op': {
      const op = data.op;
      if (op.userId === getUserId()) {
        store.removePendingOp(op.id);
        send({ type: 'ack', opId: op.id });
        break;
      }

      const pageStore = usePageStore.getState();
      const regionStore = useRegionStore.getState();
      const page = pageStore.pages.find((p) => p.id === op.pageId);
      if (!page) break;

      switch (op.type) {
        case 'region:create': {
          const r = op.payload as unknown as Region;
          if (!page.regions.find((reg) => reg.id === r.id)) {
            const remoteTag = { t: op.timestamp, u: op.userId };
            initCrdtMeta(r.id, op.pageId, op.userId);
            for (const field of Object.keys(r)) {
              resolveRemote(r.id, field, remoteTag);
            }
            regionStore.addRegion(op.pageId, r);
          }
          break;
        }
        case 'region:update': {
          const { id, versions: remoteVersions, ...patch } = op.payload as {
            id: string;
            versions?: Record<string, { t: number; u: string }>;
          } & Record<string, unknown>;

          const resolvedPatch: Record<string, unknown> = {};
          const userId = getUserId();

          for (const [field, value] of Object.entries(patch)) {
            if (field === 'id') continue;
            const rTag = remoteVersions?.[field] ?? { t: op.timestamp, u: op.userId };
            if (resolveRemote(id, field, rTag)) {
              resolvedPatch[field] = value;
            }
          }

          if (Object.keys(resolvedPatch).length > 0) {
            regionStore.updateRegion(op.pageId, id, resolvedPatch);
            // re-mark local fields as newer after applying remote
            for (const field of Object.keys(resolvedPatch)) {
              writeLocal(id, field, userId);
            }
          }
          break;
        }
        case 'region:delete': {
          const { id } = op.payload as { id: string };
          const remoteTag = { t: op.timestamp, u: op.userId };
          if (markDeleted(id, op.userId)) {
            regionStore.deleteRegion(op.pageId, id);
            clearCrdtMeta(id);
          }
          break;
        }
      }
      store.removePendingOp(op.id);
      send({ type: 'ack', opId: op.id });
      break;
    }
  }
}

function connectInternal(url: string) {
  if (ws) {
    ws.close();
    ws = null;
  }

  const userId = getUserId();
  const userName = useCollabStore.getState().userName || `User-${userId.slice(0, 6)}`;
  userInfo = { id: userId, name: userName, color: getUserColor(userId) };

  try {
    ws = new WebSocket(url);
  } catch {
    scheduleReconnect(url);
    return;
  }

  ws.onopen = () => {
    useCollabStore.getState().setConnected(true);
    send({ type: 'join', user: userInfo! });
    useToastStore.getState().push(t('collab.toast.connected'), 'success');

    const pending = useCollabStore.getState().pendingOps;
    for (const op of pending) send({ type: 'op', op });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as CollabMessage;
      handleMessage(data);
    } catch { /* ignore malformed */ }
  };

  ws.onclose = () => {
    useCollabStore.getState().setConnected(false);
    useToastStore.getState().push(t('collab.toast.disconnected'), 'info');
    ws = null;
    scheduleReconnect(url);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect(url: string) {
  if (reconnectTimer) return;
  useCollabStore.getState().setReconnecting(true);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectInternal(url);
  }, 3000);
}

export function connectCollab(url?: string) {
  const serverUrl = url ?? useCollabStore.getState().serverUrl;
  useCollabStore.getState().setServerUrl(serverUrl);
  clearAllCrdtMeta();
  connectInternal(serverUrl);
}

export function disconnectCollab() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  useCollabStore.getState().setReconnecting(false);
  ws?.close();
  ws = null;
  useCollabStore.getState().setConnected(false);
  clearAllCrdtMeta();
  useCollabStore.getState().reset();
}

function broadcastOp(type: CollabOp['type'], pageId: string, payload: Record<string, unknown>) {
  if (ws?.readyState !== WebSocket.OPEN) return;
    const userId = getUserId();
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

    const ts = Date.now();
    const op: CollabOp = {
      id,
      type: type as CollabOp['type'],
      userId,
      timestamp: ts,
    pageId,
    payload: { ...payload, _userId: userId, _timestamp: ts },
  };

  useCollabStore.getState().addPendingOp(op);
  send({ type: 'op', op });
}

export function broadcastRegionCreate(pageId: string, region: Region) {
  const userId = getUserId();
  initCrdtMeta(region.id, pageId, userId);
  for (const field of Object.keys(region)) {
    writeLocal(region.id, field, userId);
  }
  const versions = buildVersionMap(region.id, region as unknown as Record<string, unknown>, userId);
  broadcastOp('region:create', pageId, { ...region, versions });
}

export function broadcastRegionUpdate(pageId: string, id: string, patch: Partial<Region>) {
  const userId = getUserId();
  const versions = buildVersionMap(id, patch as Record<string, unknown>, userId);
  for (const field of Object.keys(patch)) {
    writeLocal(id, field, userId);
  }
  broadcastOp('region:update', pageId, { id, ...patch, versions });
}

export function broadcastRegionDelete(pageId: string, id: string) {
  markDeleted(id, getUserId());
  broadcastOp('region:delete', pageId, { id });
}

export function isCollabConnected(): boolean {
  return useCollabStore.getState().connected;
}
