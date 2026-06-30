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

class RateLimiter {
  private timestamps: number[] = [];
  private queue: Array<() => void> = [];
  private processing = false;

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

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

function isDeezerError(data: unknown): data is DeezerError {
  return typeof data === 'object' && data !== null && 'error' in data;
}

function buildHeaders(useAuth: boolean): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useAuth) {
    const arl = process.env.DEEZER_ARL;
    if (!arl) {
      throw new Error('DEEZER_ARL not set');
    }
    headers['Cookie'] = `arl=${arl}`;
  }
  return headers;
}

async function deezerFetch<T>(path: string, useAuth = false): Promise<T> {
  await rateLimiter.acquire();

  const url = `${DEEZER_API}${path}`;
  const response = await fetch(url, { headers: buildHeaders(useAuth) });

  if (!response.ok) {
    throw new Error(`Deezer HTTP error: ${response.status} ${response.statusText} — ${url}`);
  }

  const data = (await response.json()) as unknown;

  if (isDeezerError(data)) {
    const { code, type, message } = data.error;
    // ARL expired: Deezer returns code 300 (OAuthException) or 700 (DataException)
    if (code === 300 || (code === 700 && type === 'DataException')) {
      console.error(`[deezer] ARL expired or invalid — code ${code}: ${message}`);
      throw new Error(`Deezer auth error (${code}): ${message}`);
    }
    console.error(`[deezer] API error — ${type} (${code}): ${message}`);
    throw new Error(`Deezer error (${code}): ${message}`);
  }

  return data as T;
}

export async function searchDeezer(
  query: string,
  type: DeezerSearchType = 'track',
  limit = 25,
): Promise<DeezerSearchResults> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const data = await deezerFetch<DeezerList<DeezerTrack | DeezerAlbum | DeezerArtist | DeezerPlaylist>>(
    `/search/${type}?${params}`,
  );
  return { [type === 'track' ? 'tracks' : `${type}s`]: data } as DeezerSearchResults;
}

export async function getTrack(id: number | string): Promise<DeezerTrack> {
  return deezerFetch<DeezerTrack>(`/track/${id}`);
}

export async function getArtist(id: number | string): Promise<DeezerArtist> {
  return deezerFetch<DeezerArtist>(`/artist/${id}`);
}

export async function getArtistTopTracks(id: number | string, limit = 25): Promise<DeezerList<DeezerTrack>> {
  return deezerFetch<DeezerList<DeezerTrack>>(`/artist/${id}/top?limit=${limit}`);
}

export async function getAlbum(id: number | string): Promise<DeezerAlbum> {
  return deezerFetch<DeezerAlbum>(`/album/${id}`);
}

export async function getPlaylist(id: number | string): Promise<DeezerPlaylist> {
  return deezerFetch<DeezerPlaylist>(`/playlist/${id}`);
}

export async function getCurrentUser(): Promise<DeezerUser> {
  return deezerFetch<DeezerUser>('/user/me', true);
}

export async function getUserLibrary(): Promise<DeezerUserLibrary> {
  const [tracks, albums, artists, playlists] = await Promise.all([
    deezerFetch<DeezerList<DeezerTrack>>('/user/me/tracks', true),
    deezerFetch<DeezerList<DeezerAlbum>>('/user/me/albums', true),
    deezerFetch<DeezerList<DeezerArtist>>('/user/me/artists', true),
    deezerFetch<DeezerList<DeezerPlaylist>>('/user/me/playlists', true),
  ]);
  return { tracks, albums, artists, playlists };
}

export async function getUserTracks(limit = 25): Promise<DeezerList<DeezerTrack>> {
  return deezerFetch<DeezerList<DeezerTrack>>(`/user/me/tracks?limit=${limit}`, true);
}

export async function getUserAlbums(limit = 25): Promise<DeezerList<DeezerAlbum>> {
  return deezerFetch<DeezerList<DeezerAlbum>>(`/user/me/albums?limit=${limit}`, true);
}

export async function getUserArtists(limit = 25): Promise<DeezerList<DeezerArtist>> {
  return deezerFetch<DeezerList<DeezerArtist>>(`/user/me/artists?limit=${limit}`, true);
}

export async function getUserPlaylists(limit = 25): Promise<DeezerList<DeezerPlaylist>> {
  return deezerFetch<DeezerList<DeezerPlaylist>>(`/user/me/playlists?limit=${limit}`, true);
}

/**
 * Returns the 30-second preview URL for a track (publicly available, no auth needed).
 * Full stream URL requires Deezer's private encryption API and a valid ARL.
 */
export async function getTrackPreviewUrl(id: number | string): Promise<string> {
  const track = await getTrack(id);
  if (!track.preview) {
    throw new Error(`No preview available for track ${id}`);
  }
  return track.preview;
}
