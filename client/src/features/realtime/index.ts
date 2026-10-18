export {
  REALTIME_EVENTS,
  getRealtimeSocket,
  resetRealtimeSocket,
  type CommentCreatedEvent,
  type CommentReactionEvent,
  type NotificationNewEvent,
  type PresenceUpdateEvent,
  type TaskChangedEvent,
  type TaskFieldChange,
  type TaskPresenceEvent,
} from './socket';
export { useProjectPresence, useProjectSocket, useTaskPresence } from './hooks/use-realtime';
export { PresenceAvatars } from './components/presence-avatars';
