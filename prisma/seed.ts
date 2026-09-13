import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { hash } from 'bcryptjs';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL or DIRECT_URL is required.');

const username = process.env.SEED_ADMIN_USERNAME?.trim();
const password = process.env.SEED_ADMIN_PASSWORD;
const displayName =
  process.env.SEED_ADMIN_DISPLAY_NAME?.trim() || 'System Administrator';
if (!username || !password || password.length < 12)
  throw new Error(
    'Set a seed admin username and password of at least 12 characters.',
  );

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const passwordHash = await hash(password, 12);

await prisma.user.upsert({
  where: { normalizedUsername: username.toLowerCase() },
  update: {
    username,
    displayName,
    passwordHash,
    role: 'ADMIN',
    isActive: true,
  },
  create: {
    username,
    normalizedUsername: username.toLowerCase(),
    displayName,
    passwordHash,
    role: 'ADMIN',
  },
});

await prisma.$disconnect();
console.log(`Admin user '${username}' is ready.`);
