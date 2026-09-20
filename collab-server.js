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
]);
const MAX_MESSAGE_BYTES = 1024 * 1024;
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
          typeof data.user.name !== 'string' ||
          typeof data.user.color !== 'string' ||
          typeof data.roomId !== 'string' ||
          !data.roomId.trim()
        ) {
          ws.close(1008, 'Invalid collaboration join');
          return;
        }

        user = data.user;
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
          typeof data.op.userId !== 'string' ||
          typeof data.op.pageId !== 'string' ||
          !data.op.pageId.trim() ||
          typeof data.op.type !== 'string' ||
          !ALLOWED_OP_TYPES.has(data.op.type) ||
          typeof data.op.timestamp !== 'number'
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
