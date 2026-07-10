import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

let _client: PrismaClient | null = null;

/**
 * Retourne le client Prisma singleton. Crée l'instance au premier appel.
 * Prisma 7 ne lit plus `DATABASE_URL` implicitement — un adapter explicite est requis.
 * @returns {PrismaClient} Instance Prisma connectée.
 */
export function getPrismaClient(): PrismaClient {
  if (_client) return _client;
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  _client = new PrismaClient({ adapter });
  return _client;
}
