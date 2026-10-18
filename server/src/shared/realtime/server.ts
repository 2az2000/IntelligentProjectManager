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

/**
 * §Imp §5 task-level presence: `${projectId}:${taskId}` → (socketId → userId).
 *
 * Keyed by socket rather than by user on purpose: the same person may have the task open in
 * two tabs, and closing one must not make them vanish from the other. The users a screen
 * renders are derived from the socket set, so they can never go negative.
 */
const taskViewers = new Map<string, Map<string, number>>();
const taskKey = (projectId: number, taskId: number) => `${projectId}:${taskId}`;

function updatePresence(io: Server, projectId: number) {
  io.to(projectRoom(projectId)).emit('presence:update', {
    projectId,
    userIds: [...(presence.get(projectId) ?? [])],
  });
}

function viewersOf(projectId: number, taskId: number): number[] {
  const sockets = taskViewers.get(taskKey(projectId, taskId));
  return sockets ? [...new Set(sockets.values())].sort((a, b) => a - b) : [];
}

function updateTaskPresence(io: Server, projectId: number, taskId: number) {
  io.to(projectRoom(projectId)).emit('task:presence', {
    projectId,
    taskId,
    userIds: viewersOf(projectId, taskId),
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

    /**
     * Membership gate + room switch in one place, so `project:join` and `task:join` can never
     * disagree about who may listen. Returns false for a non-member.
     */
    const joinProject = async (projectId: number): Promise<boolean> => {
      if (!Number.isInteger(projectId) || projectId <= 0) return false;
      if (joinedProject === projectId) return true;

      const member = await deps.db.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { projectId: true },
      });
      if (!member) return false;

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
      return true;
    };

    socket.on('project:join', (rawProjectId: unknown) => {
      void joinProject(Number(rawProjectId));
    });

    /** Announce which task this tab has open; the project must already be joined. */
    const leaveTask = (projectId: number, taskId: number) => {
      const key = taskKey(projectId, taskId);
      const sockets = taskViewers.get(key);
      if (!sockets?.delete(socket.id)) return;
      if (sockets.size === 0) taskViewers.delete(key);
      updateTaskPresence(io, projectId, taskId);
    };

    socket.on('task:join', async (raw: unknown) => {
      const projectId = Number((raw as { projectId?: unknown })?.projectId);
      const taskId = Number((raw as { taskId?: unknown })?.taskId);
      if (!Number.isInteger(projectId) || !Number.isInteger(taskId) || taskId <= 0) return;
      // A task may open before its project room has finished joining — join on demand rather
      // than silently dropping the first presence announcement.
      if (!(await joinProject(projectId))) return;
      const key = taskKey(projectId, taskId);
      const sockets = taskViewers.get(key) ?? new Map<string, number>();
      sockets.set(socket.id, userId);
      taskViewers.set(key, sockets);
      updateTaskPresence(io, projectId, taskId);
    });

    socket.on('task:leave', (raw: unknown) => {
      const projectId = Number((raw as { projectId?: unknown })?.projectId);
      const taskId = Number((raw as { taskId?: unknown })?.taskId);
      if (!Number.isInteger(projectId) || !Number.isInteger(taskId)) return;
      leaveTask(projectId, taskId);
    });

    socket.on('disconnect', () => {
      // A closed tab must not stay "viewing" any task.
      for (const [key, sockets] of taskViewers) {
        if (!sockets.delete(socket.id)) continue;
        const [projectPart, taskPart] = key.split(':');
        if (sockets.size === 0) taskViewers.delete(key);
        if (projectPart === undefined || taskPart === undefined) continue;
        const projectId = Number(projectPart);
        if (joinedProject === projectId) updateTaskPresence(io, projectId, Number(taskPart));
      }
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
  subscribe('comment:reaction', (event) => {
    io.to(projectRoom(event.projectId)).emit('comment:reaction', event);
  });
  subscribe('notification:new', (event) => {
    io.to(userRoom(event.userId)).emit('notification:new', { type: event.type });
  });

  return io;
}
