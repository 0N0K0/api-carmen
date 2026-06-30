import { FreqblogAudioFeatures, FreqblogTrackRef } from '../types/freqblog';
import { getRedisClient } from '../plugins/redis';

const FREQBLOG_API = 'https://api.freqblog.com';
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const QUEUED_CACHE_TTL_SECONDS = 5 * 60; // 5 min — retry after ingestion
const CACHE_NULL_SENTINEL = '__not_found__';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Construit les headers HTTP pour l'API FreqBlog.
 * @returns {Record<string, string>} Headers avec la clé API.
 * @throws {Error} Si `FREQBLOG_API_KEY` n'est pas défini.
 */
function buildHeaders(): Record<string, string> {
  const key = process.env.FREQBLOG_API_KEY;
  if (!key) throw new Error('FREQBLOG_API_KEY not set');
  return { 'X-Api-Key': key };
}

/**
 * Clé Redis pour un ref de track.
 * Priorité : ISRC → `track:artist` normalisé.
 * @param {FreqblogTrackRef} ref Référence du track.
 * @returns {string} Clé Redis.
 */
function cacheKey(ref: FreqblogTrackRef): string {
  if (ref.isrc) return `freqblog:${ref.isrc.trim()}`;
  return `freqblog:lookup:${ref.track.trim().toLowerCase()}:${ref.artist.trim().toLowerCase()}`;
}

/**
 * Tente de lire les audio features depuis le cache Redis.
 * Retourne `{ hit: true, data: null }` pour un null caché (track absent/queued).
 * @param {FreqblogTrackRef} ref Référence du track.
 * @returns {Promise<{ hit: false } | { hit: true; data: FreqblogAudioFeatures | null }>}
 */
async function getFromCache(ref: FreqblogTrackRef): Promise<{ hit: false } | { hit: true; data: FreqblogAudioFeatures | null }> {
  try {
    const cached = await getRedisClient().get(cacheKey(ref));
    if (cached === null) return { hit: false };
    if (cached === CACHE_NULL_SENTINEL) return { hit: true, data: null };
    return { hit: true, data: JSON.parse(cached) as FreqblogAudioFeatures };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[freqblog] cache read error for ${cacheKey(ref)}: ${msg}`);
    return { hit: false };
  }
}

/**
 * Persiste les audio features dans Redis.
 * @param {FreqblogTrackRef} ref Référence utilisée pour la clé de cache.
 * @param {FreqblogAudioFeatures} features Features à cacher.
 * @returns {Promise<void>}
 */
async function setInCache(ref: FreqblogTrackRef, features: FreqblogAudioFeatures): Promise<void> {
  try {
    await getRedisClient().set(cacheKey(ref), JSON.stringify(features), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[freqblog] cache write error for ${cacheKey(ref)}: ${msg}`);
  }
}

/**
 * Persiste un résultat null dans Redis pour éviter les re-queries.
 * TTL court pour 202 (track en cours d'ingestion), long pour 404 (track absent).
 * @param {FreqblogTrackRef} ref Référence du track.
 * @param {boolean} queued `true` si la réponse était 202 (queued), `false` si 404.
 * @returns {Promise<void>}
 */
async function setNullInCache(ref: FreqblogTrackRef, queued: boolean): Promise<void> {
  try {
    const ttl = queued ? QUEUED_CACHE_TTL_SECONDS : CACHE_TTL_SECONDS;
    await getRedisClient().set(cacheKey(ref), CACHE_NULL_SENTINEL, 'EX', ttl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[freqblog] cache write error for ${cacheKey(ref)}: ${msg}`);
  }
}

/**
 * Récupère les audio features d'un track via FreqBlog.
 * Utilise le cache Redis (TTL 30j). Retourne `null` si le track est inconnu ou en cours d'ingestion.
 * @param {FreqblogTrackRef} ref Nom du track, artiste, et optionnellement ISRC pour le cache.
 * @returns {Promise<FreqblogAudioFeatures | null>} Features audio ou `null` si inconnu/queued.
 */
export async function getAudioFeatures(ref: FreqblogTrackRef): Promise<FreqblogAudioFeatures | null> {
  const entry = await getFromCache(ref);
  if (entry.hit) return entry.data;

  const params = new URLSearchParams({ track: ref.track, artist: ref.artist });
  const response = await fetch(`${FREQBLOG_API}/lookup?${params}`, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 202) {
    console.info(`[freqblog] track queued for ingestion: ${ref.artist} — ${ref.track}`);
    await setNullInCache(ref, true);
    return null;
  }

  if (response.status === 404) {
    console.info(`[freqblog] track not found: ${ref.artist} — ${ref.track}`);
    await setNullInCache(ref, false);
    return null;
  }

  if (!response.ok) {
    throw new Error(`FreqBlog HTTP error: ${response.status} ${response.statusText}`);
  }

  let features: FreqblogAudioFeatures;
  try {
    features = await response.json() as FreqblogAudioFeatures;
  } catch {
    throw new Error('FreqBlog invalid JSON response');
  }

  await setInCache(ref, features);
  return features;
}

/**
 * Récupère les audio features pour un lot de tracks en parallèle.
 * Consulte le cache Redis pour chaque track, n'appelle l'API que pour les manquants.
 * Les tracks inconnus sont ignorés silencieusement.
 * @param {FreqblogTrackRef[]} refs Liste de références de tracks.
 * @returns {Promise<FreqblogAudioFeatures[]>} Features audio disponibles (tracks inconnus exclus).
 */
export async function getAudioFeaturesBatch(refs: FreqblogTrackRef[]): Promise<FreqblogAudioFeatures[]> {
  if (refs.length === 0) return [];

  const results = await Promise.all(
    refs.map(async (ref) => {
      try {
        return await getAudioFeatures(ref);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[freqblog] error fetching ${ref.artist} — ${ref.track}: ${msg}`);
        return null;
      }
    }),
  );

  return results.filter((f): f is FreqblogAudioFeatures => f !== null);
}
