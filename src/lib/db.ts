import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

// Always reuse pool across requests to prevent "calling client.query() on a pool" warning
export const pool = globalForPrisma.pool ?? new Pool({ connectionString, max: 3 });
globalForPrisma.pool = pool;

const adapter = new PrismaPg(pool);
export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });
globalForPrisma.prisma = db;
