/**
 * Drizzle schema barrel for the Reporting database — the read-optimized
 * projection tables this service owns and maintains from domain events, plus the
 * inbox for idempotent event consumption. drizzle-kit reads the domain schema
 * files directly (see drizzle.config.ts).
 */
export * from '@/reporting/projections/schema/order-fact.schema';
export * from '@/reporting/projections/schema/order-item-fact.schema';
export * from '@/reporting/projections/schema/restaurant-fact.schema';
export * from '@/messaging/schema/inbox.schema';
