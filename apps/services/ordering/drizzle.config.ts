import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './src/drizzle/out',
  schema: [
    './src/ordering/order/*.schema.ts',
    './src/ordering/order-lifecycle/**/*.schema.ts',
    './src/ordering/common/*.schema.ts',
    './src/ordering/acl/schemas/*.schema.ts',
    './src/messaging/schema/*.schema.ts',
  ],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
