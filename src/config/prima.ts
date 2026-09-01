// src/config/prisma.ts
//
// WHY A SINGLETON:
// Every time you call `new PrismaClient()` it opens a new connection
// pool to your database. In dev, nodemon restarts the server on every
// file save — without this pattern you'd exhaust Postgres's connection
// limit within minutes because old pools never close.
// One instance, imported everywhere, solves this.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

export default prisma;