/**
 * Simple WebSocket relay server for ScanForge collaboration.
 * Usage: node collab-server.js [port]
 * Default port: 8080
 */
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.argv[2], 10) || 8080;

const clients = new Map();
const ALLOWED_OP_TYPES = new Set([
  'region:create',
  'region:update',
  'region:delete',
  'region:reorder',
  'region:batch',
]);
const MAX_MESSAGE_BYTES = 1024 * 1024;
const MAX_ID_LENGTH = 128;
const MAX_ROOM_ID_LENGTH = 256;
const MAX_PAGE_ID_LENGTH = 128;
const MAX_OP_ID_LENGTH = 128;
const MAX_BATCH_CHANGES = 500;
let nextId = 1;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ScanForge Collab Relay');
});

const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });

wss.on('connection', (ws) => {
  const id = `client-${nextId++}`;
  let user = null;
  let roomId = null;

  clients.set(id, { ws, user, roomId });

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (data.type) {
      case 'join': {
        if (
          !data.user ||
          typeof data.user.id !== 'string' ||
          !data.user.id.trim() ||
          data.user.id.length > MAX_ID_LENGTH ||
          typeof data.user.name !== 'string' ||
          !data.user.name.trim() ||
          data.user.name.length > MAX_ID_LENGTH ||
          typeof data.user.color !== 'string' ||
          !data.user.color.trim() ||
          data.user.color.length > 32 ||
          typeof data.roomId !== 'string' ||
          !data.roomId.trim() ||
          data.roomId.length > MAX_ROOM_ID_LENGTH
        ) {
          ws.close(1008, 'Invalid collaboration join');
          return;
        }

        user = {
          id: data.user.id.trim(),
          name: data.user.name.trim(),
          color: data.user.color.trim(),
        };
        roomId = data.roomId.trim();
        clients.set(id, { ws, user, roomId });

        broadcastToRoom(roomId, { type: 'users', users: getUsers(roomId) }, id);
        ws.send(JSON.stringify({
          type: 'users',
          users: getUsers(roomId),
        }));
        break;
      }

      case 'op': {
        if (
          !roomId ||
          !data.op ||
          typeof data.op.roomId !== 'string' ||
          data.op.roomId !== roomId ||
          typeof data.op.id !== 'string' ||
          !data.op.id.trim() ||
          data.op.id.length > MAX_OP_ID_LENGTH ||
          typeof data.op.userId !== 'string' ||
          data.op.userId !== user?.id ||
          typeof data.op.pageId !== 'string' ||
          !data.op.pageId.trim() ||
          data.op.pageId.length > MAX_PAGE_ID_LENGTH ||
          typeof data.op.type !== 'string' ||
          !ALLOWED_OP_TYPES.has(data.op.type) ||
          typeof data.op.timestamp !== 'number' ||
          !Number.isFinite(data.op.timestamp) ||
          !data.op.payload ||
          typeof data.op.payload !== 'object' ||
          Array.isArray(data.op.payload)
        ) {
          return;
        }

        if (
          data.op.type === 'region:batch' &&
          (!Array.isArray(data.op.payload.changes) ||
            data.op.payload.changes.length === 0 ||
            data.op.payload.changes.length > MAX_BATCH_CHANGES)
        ) {
          return;
        }

        broadcastToRoom(roomId, { type: 'op', op: data.op }, id);
        break;
      }

      case 'ack':
        // Delivery acknowledgement is intentionally client-side for now.
        break;
    }
  });

  ws.on('close', () => {
    clients.delete(id);
    if (user && roomId) {
      broadcastToRoom(roomId, { type: 'users', users: getUsers(roomId) });
    }
  });

  ws.on('error', () => clients.delete(id));
});

function getUsers(roomId) {
  return Array.from(clients.values())
    .filter((client) => client.roomId === roomId && client.user)
    .map((client) => client.user);
}

function broadcastToRoom(roomId, msg, excludeId) {
  const raw = JSON.stringify(msg);
  for (const [cid, client] of clients) {
    if (
      client.roomId === roomId &&
      cid !== excludeId &&
      client.ws.readyState === 1
    ) {
      client.ws.send(raw);
    }
  }
}

server.listen(PORT, () => {
  console.log(`Collab server running on ws://localhost:${PORT}`);
});
