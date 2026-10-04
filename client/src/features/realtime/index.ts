export {
  REALTIME_EVENTS,
  getRealtimeSocket,
  resetRealtimeSocket,
  type CommentCreatedEvent,
  type NotificationNewEvent,
  type PresenceUpdateEvent,
  type TaskChangedEvent,
  type TaskFieldChange,
} from './socket';
export { useProjectPresence, useProjectSocket } from './hooks/use-realtime';
export { PresenceAvatars } from './components/presence-avatars';
