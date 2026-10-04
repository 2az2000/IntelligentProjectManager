import { parse as parseCookie } from 'cookie';
import { Server, type Socket } from 'socket.io';
import type http from 'node:http';
import { env } from '../../config/env';
import type { Db } from '../db/prisma';
import { ACCESS_COOKIE, verifyAccessToken } from '../auth/tokens';
import { subscribe } from './bus';

const projectRoom = (projectId: number) => `project:${projectId}`;
const userRoom = (userId: number) => `user:${userId}`;

/** socketId → userId, per project room, for the "who is online" indicator. */
const presence = new Map<number, Set<number>>();

function updatePresence(io: Server, projectId: number) {
  io.to(projectRoom(projectId)).emit('presence:update', {
    projectId,
    userIds: [...(presence.get(projectId) ?? [])],
  });
}

/**
 * Attaches Socket.IO to the HTTP server: handshake authenticates the access
 * cookie, clients join one project room at a time after a membership check,
 * and the realtime bus is bridged to the rooms.
 */
export function createRealtimeServer(httpServer: http.Server, deps: { db: Db }): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  // Handshake auth: same access cookie the REST API uses.
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.request.headers.cookie ?? '');
      const token = cookies[ACCESS_COOKIE];
      if (!token) return next(new Error('unauthorized'));
      const result = verifyAccessToken(token);
      if (!result.ok) return next(new Error('unauthorized'));
      socket.data.userId = result.userId;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as number;
    socket.join(userRoom(userId));
    let joinedProject: number | null = null;

    socket.on('project:join', async (rawProjectId: unknown) => {
      const projectId = Number(rawProjectId);
      if (!Number.isInteger(projectId) || projectId <= 0) return;
      if (joinedProject === projectId) return;

      // Membership gate: no room for non-members.
      const member = await deps.db.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { projectId: true },
      });
      if (!member) return;

      if (joinedProject !== null) {
        socket.leave(projectRoom(joinedProject));
        presence.get(joinedProject)?.delete(userId);
        updatePresence(io, joinedProject);
      }
      joinedProject = projectId;
      socket.join(projectRoom(projectId));
      const set = presence.get(projectId) ?? new Set<number>();
      set.add(userId);
      presence.set(projectId, set);
      updatePresence(io, projectId);
    });

    socket.on('disconnect', () => {
      if (joinedProject !== null) {
        presence.get(joinedProject)?.delete(userId);
        updatePresence(io, joinedProject);
      }
    });
  });

  // Bridge committed service events to rooms.
  subscribe('task:changed', (event) => {
    io.to(projectRoom(event.projectId)).emit('task:changed', event);
  });
  subscribe('comment:created', (event) => {
    io.to(projectRoom(event.projectId)).emit('comment:created', event);
  });
  subscribe('notification:new', (event) => {
    io.to(userRoom(event.userId)).emit('notification:new', { type: event.type });
  });

  return io;
}
