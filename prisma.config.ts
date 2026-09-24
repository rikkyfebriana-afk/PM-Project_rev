import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { prismaMigrationUrl } from './lib/postgres-config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: prismaMigrationUrl(
      process.env.DIRECT_URL ??
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:5432/project_control',
    ),
  },
});
