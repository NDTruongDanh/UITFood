/**
 * Drizzle schema barrel for the Payment database. drizzle-kit reads this file
 * (see drizzle.config.ts) to generate migrations, so it uses relative imports.
 */
export * from '../payment/domain/payment-transaction.schema';
export * from '../messaging/schema/outbox.schema';
export * from '../messaging/schema/inbox.schema';
