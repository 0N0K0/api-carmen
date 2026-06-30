import {
  DeezerAlbum,
  DeezerArtist,
  DeezerError,
  DeezerList,
  DeezerPlaylist,
  DeezerSearchResults,
  DeezerSearchType,
  DeezerTrack,
  DeezerUser,
  DeezerUserLibrary,
} from '../types/deezer';

const DEEZER_API = 'https://api.deezer.com';
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 5000;

/**
 * Limiteur de débit à fenêtre glissante pour l'API Deezer (50 req / 5 s).
 * Les requêtes qui dépassent le quota sont mises en file et libérées dès qu'un slot se libère.
 */
class RateLimiter {
  private timestamps: number[] = [];
  private queue: Array<() => void> = [];
  private processing = false;

  /**
   * Attend qu'un slot soit disponible, puis résout.
   */
  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Vide la file en libérant un waiter par slot disponible.
   * Dort jusqu'à l'expiration du timestamp le plus ancien quand la fenêtre est pleine.
   */
  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS,
      );

      if (this.timestamps.length < RATE_LIMIT_MAX) {
        this.timestamps.push(now);
        const resolve = this.queue.shift()!;
        resolve();
      } else {
        const oldest = this.timestamps[0];
        const wait = RATE_LIMIT_WINDOW_MS - (now - oldest);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    this.processing = false;
  }
}

const rateLimiter = new RateLimiter();

/**
 * Type guard — retourne `true` si la réponse Deezer contient un champ `error`.
 * @param {unknown} data Corps JSON brut de la réponse.
 * @returns {boolean} `true` si la réponse est une `DeezerError`.
 */
function isDeezerError(data: unknown): data is DeezerError {
  return typeof data === 'object' && data !== null && 'error' in data;
}

/**
 * Construit les headers HTTP pour une requête Deezer.
 * Si `useAuth` est `true`, injecte le cookie de session ARL depuis `DEEZER_ARL`.
 * @param {boolean} useAuth Indique si le cookie ARL doit être inclus.
 * @returns {Record<string, string>} Objet headers prêt pour `fetch`.
 * @throws {Error} Si `useAuth` est `true` mais que `DEEZER_ARL` n'est pas défini.
 */
function buildHeaders(useAuth: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (useAuth) {
    const arl = process.env.DEEZER_ARL;
    if (!arl) {
      throw new Error('DEEZER_ARL not set');
    }
    headers['Cookie'] = `arl=${arl}`;
  }
  return headers;
}

/**
 * Wrapper fetch central pour l'API Deezer.
 * Applique le rate limiting, injecte l'auth si nécessaire, et normalise les erreurs.
 * @param {string} path Chemin API (ex. `/track/123`).
 * @param {boolean} [useAuth=false] Indique si le cookie ARL doit être envoyé.
 * @returns {Promise<T>} Corps de la réponse parsé.
 * @throws {Error} En cas d'erreur HTTP, d'erreur API Deezer, ou d'ARL expiré / absent.
 */
async function deezerFetch<T>(
  path: string,
  useAuth: boolean = false,
): Promise<T> {
  await rateLimiter.acquire();

  const url = `${DEEZER_API}${path}`;
  const response = await fetch(url, { headers: buildHeaders(useAuth) });

  if (!response.ok) {
    throw new Error(
      `Deezer HTTP error: ${response.status} ${response.statusText} — ${url}`,
    );
  }

  const data = (await response.json()) as unknown;

  if (isDeezerError(data)) {
    const { code, type, message } = data.error;
    // ARL expired: Deezer returns code 300 (OAuthException) or 700 (DataException)
    if (code === 300 || (code === 700 && type === 'DataException')) {
      console.error(
        `[deezer] ARL expired or invalid — code ${code}: ${message}`,
      );
      throw new Error(`Deezer auth error (${code}): ${message}`);
    }
    console.error(`[deezer] API error — ${type} (${code}): ${message}`);
    throw new Error(`Deezer error (${code}): ${message}`);
  }

  return data as T;
}

/**
 * Recherche dans le catalogue Deezer.
 * @param {string} query Chaîne de recherche.
 * @param {DeezerSearchType} [type='track'] Type d'entité à rechercher.
 * @param {number} [limit=25] Nombre maximum de résultats.
 * @returns {Promise<DeezerSearchResults>} Résultats paginés indexés par type.
 */
export async function searchDeezer(
  query: string,
  type: DeezerSearchType = 'track',
  limit: number = 25,
): Promise<DeezerSearchResults> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const data = await deezerFetch<
    DeezerList<DeezerTrack | DeezerAlbum | DeezerArtist | DeezerPlaylist>
  >(`/search/${type}?${params}`);
  return {
    [type === 'track' ? 'tracks' : `${type}s`]: data,
  } as DeezerSearchResults;
}

/**
 * Récupère un track par son identifiant.
 * @param {number | string} id Identifiant Deezer du track.
 * @returns {Promise<DeezerTrack>} Données du track.
 */
export async function getTrack(id: number | string): Promise<DeezerTrack> {
  return deezerFetch<DeezerTrack>(`/track/${id}`);
}

/**
 * Récupère un artiste par son identifiant.
 * @param {number | string} id Identifiant Deezer de l'artiste.
 * @returns {Promise<DeezerArtist>} Données de l'artiste.
 */
export async function getArtist(id: number | string): Promise<DeezerArtist> {
  return deezerFetch<DeezerArtist>(`/artist/${id}`);
}

/**
 * Récupère les tracks les plus populaires d'un artiste.
 * @param {number | string} id Identifiant Deezer de l'artiste.
 * @param {number} [limit=25] Nombre maximum de tracks.
 * @returns {Promise<DeezerList<DeezerTrack>>} Liste paginée des tops tracks.
 */
export async function getArtistTopTracks(
  id: number | string,
  limit: number = 25,
): Promise<DeezerList<DeezerTrack>> {
  return deezerFetch<DeezerList<DeezerTrack>>(
    `/artist/${id}/top?limit=${limit}`,
  );
}

/**
 * Récupère un album par son identifiant.
 * @param {number | string} id Identifiant Deezer de l'album.
 * @returns {Promise<DeezerAlbum>} Données de l'album, incluant la tracklist.
 */
export async function getAlbum(id: number | string): Promise<DeezerAlbum> {
  return deezerFetch<DeezerAlbum>(`/album/${id}`);
}

/**
 * Récupère une playlist par son identifiant.
 * @param {number | string} id Identifiant Deezer de la playlist.
 * @returns {Promise<DeezerPlaylist>} Données de la playlist, incluant la tracklist.
 */
export async function getPlaylist(
  id: number | string,
): Promise<DeezerPlaylist> {
  return deezerFetch<DeezerPlaylist>(`/playlist/${id}`);
}

/**
 * Récupère le profil de l'utilisateur authentifié. Nécessite `DEEZER_ARL`.
 * @returns {Promise<DeezerUser>} Données de l'utilisateur courant.
 */
export async function getCurrentUser(): Promise<DeezerUser> {
  return deezerFetch<DeezerUser>('/user/me', true);
}

/**
 * Récupère la bibliothèque complète de l'utilisateur authentifié en parallèle. Nécessite `DEEZER_ARL`.
 * @returns {Promise<DeezerUserLibrary>} Tracks, albums, artistes et playlists sauvegardés.
 */
export async function getUserLibrary(): Promise<DeezerUserLibrary> {
  const [tracks, albums, artists, playlists] = await Promise.all([
    deezerFetch<DeezerList<DeezerTrack>>('/user/me/tracks', true),
    deezerFetch<DeezerList<DeezerAlbum>>('/user/me/albums', true),
    deezerFetch<DeezerList<DeezerArtist>>('/user/me/artists', true),
    deezerFetch<DeezerList<DeezerPlaylist>>('/user/me/playlists', true),
  ]);
  return { tracks, albums, artists, playlists };
}

/**
 * Récupère les tracks sauvegardés de l'utilisateur authentifié. Nécessite `DEEZER_ARL`.
 * @param {number} [limit=25] Nombre maximum de tracks.
 * @returns {Promise<DeezerList<DeezerTrack>>} Liste paginée des tracks sauvegardés.
 */
export async function getUserTracks(
  limit: number = 25,
): Promise<DeezerList<DeezerTrack>> {
  return deezerFetch<DeezerList<DeezerTrack>>(
    `/user/me/tracks?limit=${limit}`,
    true,
  );
}

/**
 * Récupère les albums sauvegardés de l'utilisateur authentifié. Nécessite `DEEZER_ARL`.
 * @param {number} [limit=25] Nombre maximum d'albums.
 * @returns {Promise<DeezerList<DeezerAlbum>>} Liste paginée des albums sauvegardés.
 */
export async function getUserAlbums(
  limit: number = 25,
): Promise<DeezerList<DeezerAlbum>> {
  return deezerFetch<DeezerList<DeezerAlbum>>(
    `/user/me/albums?limit=${limit}`,
    true,
  );
}

/**
 * Récupère les artistes suivis par l'utilisateur authentifié. Nécessite `DEEZER_ARL`.
 * @param {number} [limit=25] Nombre maximum d'artistes.
 * @returns {Promise<DeezerList<DeezerArtist>>} Liste paginée des artistes suivis.
 */
export async function getUserArtists(
  limit: number = 25,
): Promise<DeezerList<DeezerArtist>> {
  return deezerFetch<DeezerList<DeezerArtist>>(
    `/user/me/artists?limit=${limit}`,
    true,
  );
}

/**
 * Récupère les playlists de l'utilisateur authentifié. Nécessite `DEEZER_ARL`.
 * @param {number} [limit=25] Nombre maximum de playlists.
 * @returns {Promise<DeezerList<DeezerPlaylist>>} Liste paginée des playlists.
 */
export async function getUserPlaylists(
  limit: number = 25,
): Promise<DeezerList<DeezerPlaylist>> {
  return deezerFetch<DeezerList<DeezerPlaylist>>(
    `/user/me/playlists?limit=${limit}`,
    true,
  );
}

/**
 * Retourne l'URL de preview 30 secondes d'un track (disponible sans authentification).
 * L'URL de stream complet nécessite l'API privée Deezer (chiffrement) et un ARL valide.
 * @param {number | string} id Identifiant Deezer du track.
 * @returns {Promise<string>} URL CDN du preview MP3 30 secondes.
 * @throws {Error} Si le track n'a pas de preview disponible.
 */
export async function getTrackPreviewUrl(id: number | string): Promise<string> {
  const track = await getTrack(id);
  if (!track.preview) {
    throw new Error(`No preview available for track ${id}`);
  }
  return track.preview;
}
