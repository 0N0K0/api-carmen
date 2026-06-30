import Redis from 'ioredis';

let _client: Redis | null = null;

/**
 * Retourne le client Redis singleton. Crée la connexion au premier appel.
 * @returns {Redis} Instance Redis connectée.
 * @throws {Error} Si `REDIS_URL` n'est pas défini.
 */
export function getRedisClient(): Redis {
  if (_client) return _client;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL not set');
  _client = new Redis(url, { lazyConnect: false, enableReadyCheck: true });
  _client.on('error', (err) => console.error('[redis] error:', err.message));
  return _client;
}
