import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';

/**
 * reporting_order_item_facts — one row per order line, from the items array on
 * `ordering.order.placed.v1`. `revenue` is unitPrice × quantity (the event does
 * not carry per-line modifier totals, so item revenue excludes modifiers — an
 * accepted projection approximation for the top-items report).
 *
 * Joined to reporting_order_facts (same database, same service) to scope by
 * restaurant / status / window — this is an intra-service join, which the
 * no-cross-service-JOIN rule permits.
 */
export const reportingOrderItemFacts = pgTable(
  'reporting_order_item_facts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').notNull(),
    menuItemId: text('menu_item_id').notNull(),
    itemName: text('item_name').notNull(),
    quantity: integer('quantity').notNull(),
    revenue: integer('revenue').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_reporting_order_item_facts_order').on(t.orderId),
    index('idx_reporting_order_item_facts_menu_item').on(t.menuItemId),
    // Idempotency: one row per (order, menu item) so replayed placed-events
    // do not double-count.
    unique('reporting_order_item_facts_order_item_unique').on(
      t.orderId,
      t.menuItemId,
    ),
  ],
);

export type ReportingOrderItemFact =
  typeof reportingOrderItemFacts.$inferSelect;
export type NewReportingOrderItemFact =
  typeof reportingOrderItemFacts.$inferInsert;
