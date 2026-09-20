import type { Region } from '../types';
import { usePageStore } from '../stores/usePageStore';
import { useProjectStore } from '../stores/useProjectStore';
import { normalizeRegion } from '../types/region';
import { useToastStore } from '../stores/useToastStore';
import { useCollabStore } from './store';
import { t } from '../i18n';
import type { CollabOp, CollabMessage, CollabUser } from './types';
import {
  initCrdtMeta,
  writeLocal,
  resolveRemote,
  markDeleted,
  clearAllCrdtMeta,
  buildVersionMap,
} from './crdt';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let userInfo: CollabUser | null = null;
let connectedRoomId: string | null = null;
let connectedServerUrl: string | null = null;

function getUserId(): string {
  let id = localStorage.getItem('scanforge-collab-userid');
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    localStorage.setItem('scanforge-collab-userid', id);
  }
  return id;
}

function getCollaborationRoomId(userId = getUserId()): string {
  const projectId = useProjectStore.getState().meta.localProjectId;
  return projectId ? `project:${projectId}` : `draft:${userId}`;
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
  const roomId = getCollaborationRoomId();

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
      if (op.roomId !== roomId) break;
      if (op.userId === getUserId()) {
        store.removePendingOp(op.id);
        send({ type: 'ack', opId: op.id });
        break;
      }

      const pageStore = usePageStore.getState();
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
            usePageStore.setState((state) => ({
              pages: state.pages.map((entry) =>
                entry.id === op.pageId && !entry.regions.some((region) => region.id === r.id)
                  ? { ...entry, regions: [...entry.regions, r].map((region, index) => ({ ...region, order: index + 1 })) }
                  : entry,
              ),
            }));
            useProjectStore.getState().touch();
          }
          break;
        }
        case 'region:update': {
          const { id, versions: remoteVersions, ...patch } = op.payload as {
            id: string;
            versions?: Record<string, { t: number; u: string }>;
          } & Record<string, unknown>;

          const resolvedPatch: Record<string, unknown> = {};

          for (const [field, value] of Object.entries(patch)) {
            if (field === 'id') continue;
            const rTag = remoteVersions?.[field] ?? { t: op.timestamp, u: op.userId };
            if (resolveRemote(id, field, rTag)) {
              resolvedPatch[field] = value;
            }
          }

          if (Object.keys(resolvedPatch).length > 0) {
            usePageStore.setState((state) => ({
              pages: state.pages.map((entry) =>
                entry.id !== op.pageId
                  ? entry
                  : {
                      ...entry,
                      regions: entry.regions.map((region) =>
                        region.id === id ? normalizeRegion({ ...region, ...resolvedPatch }) : region,
                      ),
                    },
              ),
            }));
            useProjectStore.getState().touch();
          }
          break;
        }
        case 'region:delete': {
          const { id } = op.payload as { id: string };
          if (markDeleted(id, op.userId, op.pageId, { t: op.timestamp, u: op.userId })) {
            usePageStore.setState((state) => ({
              pages: state.pages.map((entry) =>
                entry.id !== op.pageId
                  ? entry
                  : {
                      ...entry,
                      regions: entry.regions
                        .filter((region) => region.id !== id)
                        .map((region, index) => ({ ...region, order: index + 1 })),
                    },
              ),
            }));
            useProjectStore.getState().touch();
          }
          break;
        }
        case 'region:batch': {
          const changes = Array.isArray(op.payload.changes) ? op.payload.changes : [];
          usePageStore.setState((state) => ({
            pages: state.pages.map((entry) => {
              if (entry.id !== op.pageId) return entry;
              let regions = [...entry.regions];
              for (const change of changes) {
                if (!change || typeof change !== 'object' || typeof change.kind !== 'string') continue;
                if (change.kind === 'create' && change.region && typeof change.region.id === 'string') {
                  const r = change.region as Region;
                  if (!regions.some((region) => region.id === r.id)) {
                    initCrdtMeta(r.id, op.pageId, op.userId);
                    const createVersions = change.versions && typeof change.versions === 'object'
                      ? change.versions as Record<string, { t: number; u: string }>
                      : {};
                    for (const field of Object.keys(r)) {
                      resolveRemote(r.id, field, createVersions[field] ?? { t: op.timestamp, u: op.userId });
                    }
                    regions.push(r);
                  }
                } else if (change.kind === 'delete' && typeof change.id === 'string') {
                  if (markDeleted(change.id, op.userId, op.pageId, { t: op.timestamp, u: op.userId })) {
                    regions = regions.filter((region) => region.id !== change.id);
                  }
                } else if (change.kind === 'update' && typeof change.id === 'string' && change.patch && typeof change.patch === 'object') {
                  const patch = change.patch as Record<string, unknown>;
                  const versions = change.versions && typeof change.versions === 'object'
                    ? change.versions as Record<string, { t: number; u: string }>
                    : {};
                  const resolved: Record<string, unknown> = {};
                  for (const [field, value] of Object.entries(patch)) {
                    const tag = versions[field] ?? { t: op.timestamp, u: op.userId };
                    if (resolveRemote(change.id, field, tag)) resolved[field] = value;
                  }
                  if (Object.keys(resolved).length) {
                    regions = regions.map((region) => region.id === change.id ? normalizeRegion({ ...region, ...resolved }) : region);
                  }
                }
              }
              return { ...entry, regions: regions.map((region, index) => ({ ...region, order: index + 1 })) };
            }),
          }));
          useProjectStore.getState().touch();
          break;
        }
        case 'region:reorder': {
          const ids = Array.isArray(op.payload.ids)
            ? op.payload.ids.filter((value): value is string => typeof value === 'string')
            : [];
          if (ids.length > 0) {
            usePageStore.setState((state) => ({
              pages: state.pages.map((entry) => {
                if (entry.id !== op.pageId) return entry;
                const byId = new Map(entry.regions.map((region) => [region.id, region] as const));
                const ordered = ids
                  .map((id) => byId.get(id))
                  .filter((region): region is Region => Boolean(region));
                const missing = entry.regions.filter((region) => !ids.includes(region.id));
                return {
                  ...entry,
                  regions: [...ordered, ...missing].map((region, index) => ({
                    ...region,
                    order: index + 1,
                  })),
                };
              }),
            }));
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
  const roomId = getCollaborationRoomId();
  connectedRoomId = roomId;
  connectedServerUrl = url;
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
    send({ type: 'join', user: userInfo!, roomId });
    useToastStore.getState().push(t('collab.toast.connected'), 'success');

    const pending = useCollabStore.getState().pendingOps.filter((op) => op.roomId === roomId);
    for (const op of pending) send({ type: 'op', op });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as CollabMessage;
      handleMessage(data);
    } catch { /* ignore malformed */ }
  };

  ws.onclose = () => {
    connectedRoomId = null;
    connectedServerUrl = null;
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

export function ensureCollabRoomIsCurrent(): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const currentRoomId = getCollaborationRoomId();
  if (connectedRoomId === currentRoomId) return;

  const serverUrl = connectedServerUrl ?? useCollabStore.getState().serverUrl;
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

function broadcastOp(
  type: CollabOp['type'],
  pageId: string,
  payload: Record<string, unknown>,
  timestamp = Date.now(),
) {
  if (ws?.readyState !== WebSocket.OPEN) return;

  const userId = getUserId();
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

  const op: CollabOp = {
    id,
    type: type as CollabOp['type'],
    userId,
    roomId: getCollaborationRoomId(userId),
    timestamp,
    pageId,
    payload,
  };

  useCollabStore.getState().addPendingOp(op);
  send({ type: 'op', op });
}

export function broadcastRegionCreate(pageId: string, region: Region) {
  const userId = getUserId();
  const timestamp = Date.now();
  initCrdtMeta(region.id, pageId, userId);
  for (const field of Object.keys(region)) {
    writeLocal(region.id, field, userId, undefined, timestamp);
  }
  const versions = buildVersionMap(region.id, region as unknown as Record<string, unknown>, userId, timestamp);
  broadcastOp('region:create', pageId, { ...region, versions }, timestamp);
}

export function broadcastRegionUpdate(pageId: string, id: string, patch: Partial<Region>) {
  const userId = getUserId();
  const timestamp = Date.now();
  const versions = buildVersionMap(id, patch as Record<string, unknown>, userId, timestamp);
  for (const field of Object.keys(patch)) {
    writeLocal(id, field, userId, undefined, timestamp);
  }
  broadcastOp('region:update', pageId, { id, ...patch, versions }, timestamp);
}

export function broadcastRegionDelete(pageId: string, id: string) {
  const userId = getUserId();
  const timestamp = Date.now();
  markDeleted(id, userId, pageId, { t: timestamp, u: userId });
  broadcastOp('region:delete', pageId, { id }, timestamp);
}

export function broadcastRegionReorder(pageId: string, regionIds: string[]) {
  broadcastOp('region:reorder', pageId, { ids: [...regionIds] });
}

export type RegionBatchChange =
  | { kind: 'create'; region: Region; versions?: Record<string, { t: number; u: string }> }
  | { kind: 'update'; id: string; patch: Partial<Region>; versions?: Record<string, { t: number; u: string }> }
  | { kind: 'delete'; id: string };

export function broadcastRegionBatch(pageId: string, changes: RegionBatchChange[]) {
  if (changes.length === 0) return;
  const userId = getUserId();
  const timestamp = Date.now();
  const normalizedChanges = changes.map((change) => {
    if (change.kind === 'create') {
      initCrdtMeta(change.region.id, pageId, userId);
      for (const field of Object.keys(change.region)) {
        writeLocal(change.region.id, field, userId, undefined, timestamp);
      }
      return {
        ...change,
        versions: buildVersionMap(change.region.id, change.region as unknown as Record<string, unknown>, userId, timestamp),
      };
    }
    if (change.kind === 'update') {
      for (const field of Object.keys(change.patch)) {
        writeLocal(change.id, field, userId, undefined, timestamp);
      }
      return {
        ...change,
        versions: buildVersionMap(change.id, change.patch as Record<string, unknown>, userId, timestamp),
      };
    }
    markDeleted(change.id, userId, pageId, { t: timestamp, u: userId });
    return change;
  });
  broadcastOp('region:batch', pageId, { changes: normalizedChanges }, timestamp);
}

export function isCollabConnected(): boolean {
  return useCollabStore.getState().connected;
}
