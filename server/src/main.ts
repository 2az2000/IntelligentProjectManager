import http from 'node:http';
import { env } from './config/env';
import { logger } from './shared/logger';
import { prisma } from './shared/db/prisma';
import { createApp } from './app';
import { createRealtimeServer } from './shared/realtime/server';
import type { Jobs } from './modules/jobs';

const app = createApp();
const server = http.createServer(app);
// Phase 5: realtime layer shares the HTTP server (cookie handshake, project rooms).
const io = createRealtimeServer(server, { db: prisma });
const jobs = app.get('jobs') as Jobs;

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.fatal(`Port ${env.PORT} is already in use. Stop the other process or change PORT.`);
  } else {
    logger.fatal({ err }, 'Server failed to start');
  }
  process.exit(1);
});

server.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  io.close();
  await jobs.close();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
