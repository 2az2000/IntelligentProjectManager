'use client';

import { io, type Socket } from 'socket.io-client';

/**
 * Shared event contracts with server/src/shared/realtime/{bus,server}.ts.
 * `notification:new` is delivered privately to the recipient's user room,
 * so the payload carries no userId.
 */
export interface TaskFieldChange {
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
}

export interface TaskChangedEvent {
  projectId: number;
  taskId: number;
  kind: 'created' | 'updated' | 'moved' | 'deleted';
  actorId: number;
  changes?: TaskFieldChange[];
}

export interface CommentCreatedEvent {
  projectId: number;
  taskId: number;
  commentId: number;
  authorId: number;
  mentionedUserIds: number[];
}

export interface PresenceUpdateEvent {
  projectId: number;
  userIds: number[];
}

export interface NotificationNewEvent {
  type: string;
}

/** Event names the server can emit to us. */
export const REALTIME_EVENTS = [
  'task:changed',
  'comment:created',
  'presence:update',
  'notification:new',
] as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[number];

let socket: Socket | null = null;

/**
 * One lazily-created socket per browser tab. The handshake authenticates with
 * the same httpOnly access cookie as the REST API. Server-side, connecting
 * joins our private `user:<id>` room; project rooms are joined via `project:join`.
 */
export function getRealtimeSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', {
      withCredentials: true,
      autoConnect: true,
      reconnectionAttempts: 5,
    });
  }
  return socket;
}

/** Test helper: drops the singleton so each test starts fresh. */
export function resetRealtimeSocket(): void {
  socket?.disconnect();
  socket = null;
}
