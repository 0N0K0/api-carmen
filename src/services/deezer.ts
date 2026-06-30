import {
  DeezerAlbum,
  DeezerArtist,
  DeezerError,
  DeezerList,
  DeezerPlaylist,
  DeezerPodcast,
  DeezerRadio,
  DeezerSearchResults,
  DeezerSearchType,
  DeezerTrack,
} from '../types/deezer';
import {
  PipeAlbum,
  PipeFavoriteArtist,
  PipePlaylist,
  PipeTrack,
  PipeUser,
  PipeUserLibrary,
} from '../types/deezer-pipe';
import { getDeezerJwt } from '../plugins/deezer-jwt';

const DEEZER_API = 'https://api.deezer.com';
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 5000;
const REQUEST_TIMEOUT_MS = 10000;

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
        const wait = Math.max(0, RATE_LIMIT_WINDOW_MS - (now - oldest));
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    this.processing = false;
  }
}

const rateLimiter = new RateLimiter();

/**
 * Type guard — retourne `true` si la réponse Deezer contient un champ `error` bien formé.
 * @param {unknown} data Corps JSON brut de la réponse.
 * @returns {boolean} `true` si la réponse est une `DeezerError`.
 */
function isDeezerError(data: unknown): data is DeezerError {
  if (typeof data !== 'object' || data === null || !('error' in data)) return false;
  const err = (data as Record<string, unknown>).error;
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'type' in err &&
    'message' in err
  );
}

/**
 * Wrapper fetch pour l'API REST publique Deezer.
 * Applique le rate limiting et normalise les erreurs.
 * @param {string} path Chemin API (ex. `/track/123`).
 * @returns {Promise<T>} Corps de la réponse parsé.
 * @throws {Error} En cas d'erreur HTTP ou d'erreur API Deezer.
 */
async function deezerFetch<T>(path: string): Promise<T> {
  await rateLimiter.acquire();

  const url = `${DEEZER_API}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Deezer request timeout — ${url}`);
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Deezer network error — ${url}: ${msg}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Deezer HTTP error: ${response.status} ${response.statusText} — ${url}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Deezer invalid JSON response — ${url}`);
  }

  if (isDeezerError(data)) {
    const { code, type, message } = data.error;
    console.error(`[deezer] API error — ${type} (${code}): ${message}`);
    throw new Error(`Deezer error (${code}): ${message}`);
  }

  return data as T;
}

const DEEZER_PIPE_URL = 'https://pipe.deezer.com/api';

/**
 * Exécute une requête GraphQL sur la Pipe API Deezer (endpoints authentifiés).
 * Acquiert ou rafraîchit le JWT automatiquement via l'ARL.
 * @param {string} query Requête GraphQL.
 * @param {string} operationName Nom de l'opération.
 * @param {Record<string, unknown>} variables Variables GraphQL.
 * @returns {Promise<T>} Champ `data` de la réponse GraphQL.
 * @throws {Error} En cas d'erreur réseau, HTTP ou GraphQL.
 */
async function pipeFetch<T>(
  query: string,
  operationName: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const jwt = await getDeezerJwt();
  const response = await fetch(DEEZER_PIPE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ operationName, query, variables }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Deezer Pipe HTTP error: ${response.status} ${response.statusText}`);
  }

  let json: { data?: T | null; errors?: unknown[] };
  try {
    json = await response.json() as typeof json;
  } catch {
    throw new Error('Deezer Pipe invalid JSON response');
  }

  if (!json.data) {
    const msgs = Array.isArray(json.errors)
      ? json.errors
          .map((e) => (typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string' ? (e as { message: string }).message : ''))
          .filter(Boolean)
          .join(', ')
      : '';
    throw new Error(`Deezer Pipe GraphQL error${msgs ? ': ' + msgs : ''}`);
  }

  return json.data;
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
  const KEY_MAP: Record<DeezerSearchType, keyof DeezerSearchResults> = {
    track: 'tracks',
    album: 'albums',
    artist: 'artists',
    playlist: 'playlists',
    user: 'users',
    radio: 'radios',
    podcast: 'podcasts',
  };
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const data = await deezerFetch<
    DeezerList<DeezerTrack | DeezerAlbum | DeezerArtist | DeezerPlaylist | DeezerRadio | DeezerPodcast>
  >(`/search/${type}?${params}`);
  return { [KEY_MAP[type]]: data } as DeezerSearchResults;
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

// ---------------------------------------------------------------------------
// Queries GraphQL — Pipe API (endpoints authentifiés)
// ---------------------------------------------------------------------------

const Q_GET_ME = `query GetMe { me { id email user { id name } } }`;

const Q_GET_FAVORITE_TRACKS = `
query GetFavoriteTracks($first: Int) {
  me { userFavorites { tracks(first: $first) {
    edges { node {
      id title duration ISRC isExplicit isFavorite
      album { id displayTitle }
      contributors(first: 10, roles: [MAIN, FEATURED]) { edges { node { ... on Artist { id name } } } }
    } }
  } } }
}`;

const Q_GET_FAVORITE_ALBUMS = `
query GetFavoriteAlbums($first: Int) {
  me { userFavorites { albums(first: $first) {
    edges { node {
      id displayTitle releaseDate isExplicit isFavorite
      contributors(first: 5, roles: [MAIN]) { edges { node { ... on Artist { id name } } } }
    } }
  } } }
}`;

const Q_GET_FAVORITE_ARTISTS = `
query GetFavoriteArtists($first: Int) {
  me { userFavorites { artists(first: $first) {
    edges { node { id name fansCount isFavorite } }
  } } }
}`;

const Q_GET_FAVORITE_PLAYLISTS = `
query GetFavoritePlaylists($first: Int) {
  me { userFavorites { playlists(first: $first) {
    edges { node { id title estimatedTracksCount isFavorite description owner { id name } } }
  } } }
}`;

// ---------------------------------------------------------------------------
// Helpers de mapping Pipe API → types internes
// ---------------------------------------------------------------------------

type PipeEdge<T> = { node: T };
type PipeConnection<T> = { edges: PipeEdge<T>[] };
type PipeContributorNode = { id: string; name: string };

type RawTrackNode = {
  id: string;
  title: string;
  duration: number;
  ISRC?: string | null;
  isExplicit?: boolean | null;
  isFavorite?: boolean | null;
  album?: { id: string; displayTitle: string } | null;
  contributors?: PipeConnection<PipeContributorNode>;
};

type RawAlbumNode = {
  id: string;
  displayTitle: string;
  releaseDate?: string | null;
  isExplicit?: boolean | null;
  isFavorite?: boolean | null;
  contributors?: PipeConnection<PipeContributorNode>;
};

function mapTrackNode(node: RawTrackNode): PipeTrack {
  return {
    id: node.id,
    title: node.title,
    duration: node.duration,
    isrc: node.ISRC ?? null,
    isExplicit: node.isExplicit ?? null,
    isFavorite: node.isFavorite ?? null,
    album: node.album ?? null,
    artists: (node.contributors?.edges ?? []).map((e) => e.node),
  };
}

function mapAlbumNode(node: RawAlbumNode): PipeAlbum {
  return {
    id: node.id,
    displayTitle: node.displayTitle,
    releaseDate: node.releaseDate ?? null,
    isExplicit: node.isExplicit ?? null,
    isFavorite: node.isFavorite ?? null,
    contributors: (node.contributors?.edges ?? []).map((e) => e.node),
  };
}

// ---------------------------------------------------------------------------
// Endpoints authentifiés — Pipe API
// ---------------------------------------------------------------------------

/**
 * Récupère le profil de l'utilisateur authentifié via la Pipe API. Nécessite `DEEZER_ARL`.
 * @returns {Promise<PipeUser>} Profil de l'utilisateur courant.
 */
export async function getCurrentUser(): Promise<PipeUser> {
  const data = await pipeFetch<{
    me: { id: string; email: string | null; user: { id: string; name: string } };
  }>(Q_GET_ME, 'GetMe');
  return { id: data.me.id, name: data.me.user.name, email: data.me.email };
}

/**
 * Récupère les tracks favoris de l'utilisateur. Nécessite `DEEZER_ARL`.
 * @param {number} [limit=25] Nombre maximum de tracks.
 * @returns {Promise<PipeTrack[]>} Liste des tracks favoris.
 */
export async function getUserTracks(limit: number = 25): Promise<PipeTrack[]> {
  const data = await pipeFetch<{
    me: { userFavorites: { tracks: PipeConnection<RawTrackNode> } };
  }>(Q_GET_FAVORITE_TRACKS, 'GetFavoriteTracks', { first: limit });
  return data.me.userFavorites.tracks.edges.map((e) => mapTrackNode(e.node));
}

/**
 * Récupère les albums favoris de l'utilisateur. Nécessite `DEEZER_ARL`.
 * @param {number} [limit=25] Nombre maximum d'albums.
 * @returns {Promise<PipeAlbum[]>} Liste des albums favoris.
 */
export async function getUserAlbums(limit: number = 25): Promise<PipeAlbum[]> {
  const data = await pipeFetch<{
    me: { userFavorites: { albums: PipeConnection<RawAlbumNode> } };
  }>(Q_GET_FAVORITE_ALBUMS, 'GetFavoriteAlbums', { first: limit });
  return data.me.userFavorites.albums.edges.map((e) => mapAlbumNode(e.node));
}

/**
 * Récupère les artistes favoris de l'utilisateur. Nécessite `DEEZER_ARL`.
 * @param {number} [limit=25] Nombre maximum d'artistes.
 * @returns {Promise<PipeFavoriteArtist[]>} Liste des artistes favoris.
 */
export async function getUserArtists(limit: number = 25): Promise<PipeFavoriteArtist[]> {
  const data = await pipeFetch<{
    me: { userFavorites: { artists: PipeConnection<PipeFavoriteArtist> } };
  }>(Q_GET_FAVORITE_ARTISTS, 'GetFavoriteArtists', { first: limit });
  return data.me.userFavorites.artists.edges.map((e) => ({
    id: e.node.id,
    name: e.node.name,
    fansCount: e.node.fansCount ?? null,
    isFavorite: e.node.isFavorite ?? null,
  }));
}

/**
 * Récupère les playlists favorites de l'utilisateur. Nécessite `DEEZER_ARL`.
 * @param {number} [limit=25] Nombre maximum de playlists.
 * @returns {Promise<PipePlaylist[]>} Liste des playlists favorites.
 */
export async function getUserPlaylists(limit: number = 25): Promise<PipePlaylist[]> {
  const data = await pipeFetch<{
    me: { userFavorites: { playlists: PipeConnection<PipePlaylist> } };
  }>(Q_GET_FAVORITE_PLAYLISTS, 'GetFavoritePlaylists', { first: limit });
  return data.me.userFavorites.playlists.edges.map((e) => ({
    id: e.node.id,
    title: e.node.title,
    estimatedTracksCount: e.node.estimatedTracksCount ?? null,
    isFavorite: e.node.isFavorite ?? null,
    description: e.node.description ?? null,
    owner: e.node.owner ?? null,
  }));
}

/**
 * Récupère la bibliothèque complète de l'utilisateur en parallèle. Nécessite `DEEZER_ARL`.
 * @returns {Promise<PipeUserLibrary>} Tracks, albums, artistes et playlists favoris.
 */
export async function getUserLibrary(): Promise<PipeUserLibrary> {
  const [tracks, albums, artists, playlists] = await Promise.all([
    getUserTracks(50),
    getUserAlbums(50),
    getUserArtists(50),
    getUserPlaylists(50),
  ]);
  return { tracks, albums, artists, playlists };
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
