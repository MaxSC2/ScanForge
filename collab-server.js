/**
 * Simple WebSocket relay server for ScanForge collaboration.
 * Usage: node collab-server.js [port]
 * Default port: 8080
 */
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.argv[2], 10) || 8080;

const clients = new Map();
let nextId = 1;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ScanForge Collab Relay');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const id = `client-${nextId++}`;
  let user = null;

  clients.set(id, { ws, user });

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (data.type) {
      case 'join':
        user = data.user;
        clients.set(id, { ws, user });
        broadcast({ type: 'users', users: getUsers() }, id);
        ws.send(JSON.stringify({
          type: 'users',
          users: getUsers(),
        }));
        break;

      case 'op':
        broadcast({ type: 'op', op: data.op }, id);
        break;

      case 'ack':
        // Could track delivery, not needed for basic relay
        break;
    }
  });

  ws.on('close', () => {
    clients.delete(id);
    if (user) {
      broadcast({ type: 'users', users: getUsers() });
    }
  });

  ws.on('error', () => clients.delete(id));
});

function getUsers() {
  return Array.from(clients.values())
    .map((c) => c.user)
    .filter(Boolean);
}

function broadcast(msg, excludeId) {
  const raw = JSON.stringify(msg);
  for (const [cid, client] of clients) {
    if (cid !== excludeId && client.ws.readyState === 1) {
      client.ws.send(raw);
    }
  }
}

server.listen(PORT, () => {
  console.log(`Collab server running on ws://localhost:${PORT}`);
});
