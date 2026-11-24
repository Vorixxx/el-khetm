// ========================
// EL-KHETM — Server Entry Point
// ========================

import express from 'express';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager';
import { setupSocketHandler } from './socketHandler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistDir = path.resolve(__dirname, '../../client/dist');

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

const roomManager = new RoomManager(io);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: roomManager.roomCount });
});

// Serve pre-built production client with lightweight gzip cache for fast tunnel loading
const gzipCache = new Map<string, { data: Buffer; contentType: string; mtimeMs: number }>();
const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/socket.io')) return next();
  const acceptGzip = (req.headers['accept-encoding'] || '').includes('gzip');
  if (!acceptGzip) return next();

  const relPath = req.path === '/' ? 'index.html' : req.path.replace(/^\/+/, '');
  const fullPath = path.resolve(clientDistDir, relPath);
  if (!fullPath.startsWith(clientDistDir + path.sep)) return next();

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_BY_EXT[ext];
  if (!contentType || !fs.existsSync(fullPath)) return next();

  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) return next();

  let cached = gzipCache.get(fullPath);
  if (!cached || cached.mtimeMs !== stat.mtimeMs) {
    cached = {
      data: zlib.gzipSync(fs.readFileSync(fullPath)),
      contentType,
      mtimeMs: stat.mtimeMs,
    };
    gzipCache.set(fullPath, cached);
  }

  res.setHeader('Content-Type', cached.contentType);
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=3600');
  return res.send(cached.data);
});

app.use(express.static(clientDistDir, { maxAge: '1h', index: 'index.html' }));

// Setup socket handlers
setupSocketHandler(io, roomManager);

httpServer.listen(PORT, () => {
  console.log(`🏛️  El-Khetm Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  roomManager.destroy();
  httpServer.close();
  process.exit(0);
});
