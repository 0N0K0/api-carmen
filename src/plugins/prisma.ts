import { PrismaClient } from '@prisma/client';

let _client: PrismaClient | null = null;

/**
 * Retourne le client Prisma singleton. Crée l'instance au premier appel.
 * @returns {PrismaClient} Instance Prisma connectée.
 */
export function getPrismaClient(): PrismaClient {
  if (_client) return _client;
  _client = new PrismaClient();
  return _client;
}
