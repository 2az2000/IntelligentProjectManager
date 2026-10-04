import { EventEmitter } from 'node:events';

/**
 * Process-wide realtime bus: services publish after their DB work commits and
 * the Socket.IO layer (shared/realtime/server.ts) broadcasts to rooms.
 * In tests nothing subscribes — publishing stays a harmless no-op.
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
  /** Ids that should get an in-app notification (e.g. the new assignee). */
  notifyUserIds?: number[];
  changes?: TaskFieldChange[];
}

export interface CommentCreatedEvent {
  projectId: number;
  taskId: number;
  commentId: number;
  authorId: number;
  /** Project members @-mentioned in the comment body. */
  mentionedUserIds: number[];
}

export interface NotificationNewEvent {
  /** Delivered privately to the recipient's user room. */
  userId: number;
  type: string;
}

export interface RealtimeEvents {
  'task:changed': TaskChangedEvent;
  'comment:created': CommentCreatedEvent;
  'notification:new': NotificationNewEvent;
}

type Bus = EventEmitter & { on<K extends keyof RealtimeEvents>(event: K, h: (p: RealtimeEvents[K]) => void): Bus };

const emitter = new EventEmitter().setMaxListeners(30) as Bus;

export function publish<K extends keyof RealtimeEvents>(event: K, payload: RealtimeEvents[K]): void {
  emitter.emit(event, payload);
}

export function subscribe<K extends keyof RealtimeEvents>(
  event: K,
  handler: (payload: RealtimeEvents[K]) => void,
): () => void {
  emitter.on(event, handler);
  return () => emitter.off(event, handler);
}
