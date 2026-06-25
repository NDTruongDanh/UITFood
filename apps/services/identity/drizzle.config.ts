import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './src/drizzle/out',
  schema: './src/auth/auth.schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
