-- Phase 8: transactional outbox.
-- Domain events are inserted by the request that changes state and published by a poller, so a
-- crash between the commit and the socket/notification fan-out cannot lose the event.

CREATE TABLE "DomainEvent" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DomainEvent_publishedAt_id_idx" ON "DomainEvent"("publishedAt", "id");
CREATE INDEX "DomainEvent_createdAt_idx" ON "DomainEvent"("createdAt");
