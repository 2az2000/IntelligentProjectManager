export {
  DRAIN_BATCH_SIZE,
  MAX_ATTEMPTS,
  OutboxService,
  RETENTION_MS,
  createOutboxModule,
  type DomainEventMap,
  type DomainEventType,
  type DrainResult,
  type EventHandler,
  type EventWriter,
  type TaskAssignedEvent,
  type TaskChangedEvent,
} from './outbox.service';
