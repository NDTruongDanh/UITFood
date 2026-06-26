import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';

export const inboxMessages = pgTable(
  'inbox_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    consumer: text('consumer').notNull(),
    eventId: uuid('event_id').notNull(),
    eventType: text('event_type').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('payment_inbox_consumer_event_unique').on(t.consumer, t.eventId),
    index('idx_payment_inbox_consumer').on(t.consumer),
  ],
);
