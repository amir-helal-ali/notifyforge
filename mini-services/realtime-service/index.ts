/**
 * NotifyForge Real-time Service
 *
 * WebSocket server that pushes in-app notifications to connected clients
 * in real time. Clients authenticate via their API key + externalUserId.
 *
 * Flow:
 *   1. Client connects: io("/?XTransformPort=3003", { auth: { apiKey, externalUserId, projectId } })
 *   2. Server validates the API key against the bootstrap dashboard context
 *   3. Server subscribes the socket to room `project:{projectId}:user:{externalUserId}`
 *   4. When a notification is created with channel='inapp' and target.externalUserId=X,
 *      the API server POSTs to /broadcast on this service, which emits to the room.
 *
 * In production this service runs as a separate Deployment behind a sticky-session
 * load balancer (or uses Redis adapter for multi-node fanout).
 */

import { createServer, IncomingMessage } from 'http';
import { Server, Socket } from 'socket.io';

interface BroadcastPayload {
  projectId: string;
  externalUserId: string;
  notification: {
    id: string;
    title: string;
    body: string;
    category?: string;
    priority?: string;
    actionUrl?: string;
    imageUrl?: string;
    data?: Record<string, unknown>;
    createdAt: string;
  };
}

interface ClientAuth {
  apiKey?: string;
  externalUserId?: string;
  projectId?: string;
}

// Master API key (read from file written by the bootstrap script).
// In production, validate against the database instead.
let masterKey: string | null = null;
async function loadMasterKey(): Promise<string | null> {
  if (masterKey) return masterKey;
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.join(process.cwd(), '.state', 'master-key.json');
    const raw = await fs.readFile(file, 'utf8');
    masterKey = JSON.parse(raw).fullKey;
    return masterKey;
  } catch {
    return null;
  }
}

const httpServer = createServer();

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Separate control HTTP server for /health and /broadcast endpoints.
// These cannot live on the same port as socket.io because socket.io's
// path '/' intercepts all requests.
const controlServer = createServer(async (req: IncomingMessage, res: any) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), connections: io.engine.clientsCount }));
    return;
  }
  if (req.url === '/broadcast' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const payload: BroadcastPayload = JSON.parse(body);
      const room = `project:${payload.projectId}:user:${payload.externalUserId}`;
      io.to(room).emit('notification', payload.notification);
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, delivered: true }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

io.use(async (socket: Socket, next) => {
  const auth = (socket.handshake.auth as ClientAuth) ?? {};
  if (!auth.apiKey || !auth.externalUserId || !auth.projectId) {
    return next(new Error('missing auth: apiKey, externalUserId, projectId required'));
  }
  // Validate the API key against the master key (simple mode).
  // In production: query the database.
  const master = await loadMasterKey();
  if (master && auth.apiKey === master) {
    (socket as any).projectId = auth.projectId;
    (socket as any).externalUserId = auth.externalUserId;
    return next();
  }
  // For demo purposes, accept any non-empty key that starts with 'nf_live_'
  if (auth.apiKey.startsWith('nf_live_')) {
    (socket as any).projectId = auth.projectId;
    (socket as any).externalUserId = auth.externalUserId;
    return next();
  }
  return next(new Error('invalid apiKey'));
});

io.on('connection', (socket: Socket) => {
  const projectId = (socket as any).projectId as string;
  const externalUserId = (socket as any).externalUserId as string;
  const room = `project:${projectId}:user:${externalUserId}`;
  socket.join(room);
  console.log(`[realtime] client connected: project=${projectId} user=${externalUserId} socket=${socket.id}`);

  // Acknowledge with current connection info
  socket.emit('connected', {
    socketId: socket.id,
    room,
    serverTime: new Date().toISOString(),
  });

  socket.on('ping', (cb: () => void) => {
    if (typeof cb === 'function') cb();
  });

  socket.on('disconnect', (reason) => {
    console.log(`[realtime] client disconnected: ${socket.id} (${reason})`);
  });

  socket.on('error', (err: Error) => {
    console.error(`[realtime] socket error ${socket.id}:`, err);
  });
});

const PORT = 3003;
const CONTROL_PORT = 3004;
httpServer.listen(PORT, () => {
  console.log(`[realtime] NotifyForge real-time service running on port ${PORT}`);
});
controlServer.listen(CONTROL_PORT, () => {
  console.log(`[realtime] Control server running on port ${CONTROL_PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[realtime] SIGTERM received, shutting down');
  io.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('[realtime] SIGINT received, shutting down');
  io.close(() => process.exit(0));
});
