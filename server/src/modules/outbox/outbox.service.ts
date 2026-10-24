import type { Prisma } from '@prisma/client';
import { logger } from '../../shared/logger';
import type { Db } from '../../shared/db/prisma';
import type { TaskFieldChange } from '../../shared/realtime/bus';

/**
 * §Phase 8 transactional outbox.
 *
 * Before this, the request itself did the fan-out after the commit (socket publish, notification
 * rows). A crash between the commit and the fan-out silently dropped the effect. Now the request
 * writes a `DomainEvent` row and a drain delivers it; anything undelivered survives the process.
 *
 * Delivery is at-least-once: an event is marked published only after every subscriber returned,
 * so a crash mid-drain replays it. Subscribers must therefore be idempotent.
 */

/** Give up after this many failed deliveries; the row is kept for inspection and pruned later. */
export const MAX_ATTEMPTS = 5;
/** Delivered events are pruned after a week — long enough to debug an incident. */
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const DRAIN_BATCH_SIZE = 50;

export interface TaskChangedEvent {
  projectId: number;
  taskId: number;
  kind: 'created' | 'updated' | 'moved' | 'deleted';
  actorId: number;
  changes?: TaskFieldChange[];
}

export interface TaskAssignedEvent {
  userId: number;
  projectId: number;
  taskId: number;
  actorId: number;
}

/** Every event the app emits. Adding one here is what makes `emit`/`on` type-check. */
export interface DomainEventMap {
  'task.changed': TaskChangedEvent;
  'task.assigned': TaskAssignedEvent;
}

export type DomainEventType = keyof DomainEventMap;
export type EventHandler<T> = (payload: T) => void | Promise<void>;

/** A Prisma client or a transaction client — the same delegate either way. */
export type EventWriter = { domainEvent: Db['domainEvent'] };

export interface DrainResult {
  published: number;
  failed: number;
}

export class OutboxService {
  private readonly handlers = new Map<string, EventHandler<unknown>[]>();
  private timer: NodeJS.Timeout | null = null;
  private draining = false;
  private lastPrune = 0;

  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Subscribes to an event type. Subscribers run in registration order. */
  on<T extends DomainEventType>(type: T, handler: EventHandler<DomainEventMap[T]>): this {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as EventHandler<unknown>);
    this.handlers.set(type, list);
    return this;
  }

  /**
   * Stores an event. Pass a transaction client to commit it atomically with the state change:
   * `prisma.$transaction(async (tx) => { …; await outbox.emit(tx, 'task.changed', payload); })`.
   * Without a transaction the event lands right after the domain write — the window the poller
   * closes is the (much longer) fan-out, not the single insert.
   */
  async emit<T extends DomainEventType>(
    client: EventWriter,
    type: T,
    payload: DomainEventMap[T],
  ): Promise<void> {
    await client.domainEvent.create({
      data: { type, payload: payload as unknown as Prisma.InputJsonValue },
    });
  }

  /** Delivers one batch, oldest first. Safe to call concurrently — extra calls no-op. */
  async drain(batch = DRAIN_BATCH_SIZE): Promise<DrainResult> {
    if (this.draining) return { published: 0, failed: 0 };
    this.draining = true;
    try {
      return await this.deliverBatch(batch);
    } finally {
      this.draining = false;
    }
  }

  private async deliverBatch(batch: number): Promise<DrainResult> {
    const events = await this.db.domainEvent.findMany({
      where: { publishedAt: null, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { id: 'asc' },
      take: batch,
    });

    let published = 0;
    let failed = 0;
    for (const event of events) {
      try {
        // No subscriber (yet) still counts as delivered: the event is for *this* deployment.
        for (const handler of this.handlers.get(event.type) ?? []) {
          await handler(event.payload);
        }
        await this.db.domainEvent.update({
          where: { id: event.id },
          data: { publishedAt: this.now() },
        });
        published += 1;
      } catch (err) {
        failed += 1;
        await this.db.domainEvent
          .update({
            where: { id: event.id },
            data: {
              attempts: { increment: 1 },
              lastError: (err instanceof Error ? err.message : String(err)).slice(0, 500),
            },
          })
          // The update itself failing must not abort the rest of the batch.
          .catch(() => undefined);
        logger.warn({ err, eventId: event.id, type: event.type }, 'Outbox delivery failed');
      }
    }
    return { published, failed };
  }

  /** Removes delivered (or exhausted) events older than the retention window. */
  async prune(olderThan = new Date(this.now().getTime() - RETENTION_MS)): Promise<number> {
    const { count } = await this.db.domainEvent.deleteMany({
      where: {
        createdAt: { lt: olderThan },
        OR: [{ publishedAt: { not: null } }, { attempts: { gte: MAX_ATTEMPTS } }],
      },
    });
    return count;
  }

  /**
   * Starts the safety-net poller. The request paths call `drain()` themselves so a healthy
   * process delivers immediately; this loop only matters after a crash or a failed delivery.
   */
  start(intervalMs = 2_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), intervalMs);
    // Never keep the process alive just for the poller.
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Let an in-flight batch finish so a shutdown does not leave half-delivered events.
    while (this.draining) await new Promise((resolve) => setTimeout(resolve, 20));
  }

  private async tick(): Promise<void> {
    try {
      const { failed } = await this.drain();
      if (failed > 0) return;
      const now = this.now().getTime();
      if (now - this.lastPrune < 60 * 60 * 1000) return;
      this.lastPrune = now;
      await this.prune();
    } catch (err) {
      logger.warn({ err }, 'Outbox drain failed');
    }
  }
}

export function createOutboxModule(deps: { db: Db; now?: () => Date }) {
  return { service: new OutboxService(deps.db, deps.now) };
}
