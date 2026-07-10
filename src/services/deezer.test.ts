import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  deezerFetchAll,
  deezerFetchAllFrom,
  getAlbum,
  getArtist,
  getArtistTopTracks,
  getCurrentUser,
  getPlaylist,
  getStreamUrl,
  getTrack,
  getTrackPreviewUrl,
  getUserAlbums,
  getUserArtists,
  getUserLibrary,
  getUserPlaylists,
  getUserTracks,
  searchDeezer,
} from './deezer';
import type { DeezerAlbum, DeezerArtist, DeezerPlaylist, DeezerTrack } from '../types/deezer';
import { getDeezerJwt } from '../plugins/deezer-jwt';

vi.mock('../plugins/deezer-jwt', () => ({
  getDeezerJwt: vi.fn(),
  resetDeezerJwt: vi.fn(),
}));

const mockRedis = { get: vi.fn(), set: vi.fn() };
vi.mock('../plugins/redis', () => ({
  getRedisClient: () => mockRedis,
}));

const PIPE_URL = 'https://pipe.deezer.com/api';

function mockRestOk(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

function mockPipeOk(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ data }),
  } as unknown as Response;
}

function mockHttpError(status: number): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

const MOCK_TRACK: DeezerTrack = {
  id: 1,
  title: 'Test Track',
  duration: 180,
  link: 'https://www.deezer.com/track/1',
  preview: 'https://cdns-preview.deezer.com/stream/test.mp3',
  artist: { id: 10, name: 'Artist', link: '', picture: '', picture_small: '', picture_medium: '', picture_big: '', picture_xl: '', tracklist: '', type: 'artist' },
  album: { id: 20, title: 'Album', link: '', cover: '', cover_small: '', cover_medium: '', cover_big: '', cover_xl: '', tracklist: '', type: 'album' },
  type: 'track',
};

const MOCK_ARTIST: DeezerArtist = {
  id: 10,
  name: 'Artist',
  link: '',
  picture: '',
  picture_small: '',
  picture_medium: '',
  picture_big: '',
  picture_xl: '',
  tracklist: '',
  type: 'artist',
};

const MOCK_ALBUM: DeezerAlbum = {
  id: 20,
  title: 'Album',
  link: '',
  cover: '',
  cover_small: '',
  cover_medium: '',
  cover_big: '',
  cover_xl: '',
  tracklist: '',
  type: 'album',
};

const MOCK_PLAYLIST: DeezerPlaylist = {
  id: 30,
  title: 'Playlist',
  link: '',
  tracklist: '',
  type: 'playlist',
};

// Réponses Pipe API mockées
const PIPE_TRACK_NODE = {
  id: '1',
  title: 'Test Track',
  duration: 180,
  ISRC: 'USTEST000001',
  isExplicit: false,
  isFavorite: true,
  album: { id: '20', displayTitle: 'Album' },
  contributors: { edges: [{ node: { id: '10', name: 'Artist' } }] },
};

const PIPE_ALBUM_NODE = {
  id: '20',
  displayTitle: 'Album',
  releaseDate: '2024-01-01',
  isExplicit: false,
  isFavorite: true,
  contributors: { edges: [{ node: { id: '10', name: 'Artist' } }] },
};

const PIPE_ARTIST_NODE = { id: '10', name: 'Artist', fansCount: 1000, isFavorite: true };

const PIPE_PLAYLIST_NODE = {
  id: '30',
  title: 'Playlist',
  estimatedTracksCount: 10,
  isFavorite: true,
  description: null,
  owner: { id: '99', name: 'Test User' },
};

describe('deezer service', () => {
  beforeEach(() => {
    vi.stubEnv('DEEZER_ARL', 'test-arl-token');
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(getDeezerJwt).mockResolvedValue('mock-jwt-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Endpoints publics (REST api.deezer.com)
  // ---------------------------------------------------------------------------

  describe('getTrack', () => {
    it('fetches correct URL and returns track', async () => {
      vi.mocked(fetch).mockResolvedValue(mockRestOk(MOCK_TRACK));
      const track = await getTrack(1);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.deezer.com/track/1',
        expect.objectContaining({ headers: expect.not.objectContaining({ Cookie: expect.anything() }) }),
      );
      expect(track).toEqual(MOCK_TRACK);
    });

    it('does not send ARL cookie on public endpoint', async () => {
      vi.mocked(fetch).mockResolvedValue(mockRestOk(MOCK_TRACK));
      await getTrack(1);
      const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers['Cookie']).toBeUndefined();
    });
  });

  describe('getArtist', () => {
    it('fetches /artist/{id}', async () => {
      vi.mocked(fetch).mockResolvedValue(mockRestOk(MOCK_ARTIST));
      const artist = await getArtist(10);
      expect(fetch).toHaveBeenCalledWith('https://api.deezer.com/artist/10', expect.anything());
      expect(artist.name).toBe('Artist');
    });
  });

  describe('getArtistTopTracks', () => {
    it('fetches /artist/{id}/top with limit', async () => {
      vi.mocked(fetch).mockResolvedValue(mockRestOk({ data: [MOCK_TRACK], total: 1 }));
      await getArtistTopTracks(10, 10);
      expect(fetch).toHaveBeenCalledWith('https://api.deezer.com/artist/10/top?limit=10', expect.anything());
    });
  });

  describe('getAlbum', () => {
    it('fetches /album/{id}', async () => {
      vi.mocked(fetch).mockResolvedValue(mockRestOk(MOCK_ALBUM));
      const album = await getAlbum(20);
      expect(fetch).toHaveBeenCalledWith('https://api.deezer.com/album/20', expect.anything());
      expect(album.title).toBe('Album');
    });
  });

  describe('getPlaylist', () => {
    it('fetches /playlist/{id}', async () => {
      vi.mocked(fetch).mockResolvedValue(mockRestOk(MOCK_PLAYLIST));
      const playlist = await getPlaylist(30);
      expect(fetch).toHaveBeenCalledWith('https://api.deezer.com/playlist/30', expect.anything());
      expect(playlist.title).toBe('Playlist');
    });
  });

  describe('deezerFetchAll', () => {
    it('returns all items from a single page when there is no next', async () => {
      vi.mocked(fetch).mockResolvedValue(mockRestOk({ data: [MOCK_TRACK], total: 1 }));
      const items = await deezerFetchAll<DeezerTrack>('/playlist/30/tracks');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(items).toEqual([MOCK_TRACK]);
    });

    it('follows next across multiple pages and concatenates items in order', async () => {
      const TRACK_2 = { ...MOCK_TRACK, id: 2 };
      const TRACK_3 = { ...MOCK_TRACK, id: 3 };
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          mockRestOk({ data: [MOCK_TRACK], total: 3, next: 'https://api.deezer.com/playlist/30/tracks?index=1' }),
        )
        .mockResolvedValueOnce(
          mockRestOk({ data: [TRACK_2], total: 3, next: 'https://api.deezer.com/playlist/30/tracks?index=2' }),
        )
        .mockResolvedValueOnce(mockRestOk({ data: [TRACK_3], total: 3 }));

      const items = await deezerFetchAll<DeezerTrack>('/playlist/30/tracks');

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(fetch).toHaveBeenNthCalledWith(1, 'https://api.deezer.com/playlist/30/tracks', expect.anything());
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://api.deezer.com/playlist/30/tracks?index=1',
        expect.anything(),
      );
      expect(fetch).toHaveBeenNthCalledWith(
        3,
        'https://api.deezer.com/playlist/30/tracks?index=2',
        expect.anything(),
      );
      expect(items.map((t) => t.id)).toEqual([1, 2, 3]);
    });

    it('returns an empty array when the first page has no data', async () => {
      vi.mocked(fetch).mockResolvedValue(mockRestOk({ data: [], total: 0 }));
      const items = await deezerFetchAll<DeezerTrack>('/album/20/tracks');
      expect(items).toEqual([]);
    });

    it('propagates errors from any page', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          mockRestOk({ data: [MOCK_TRACK], total: 2, next: 'https://api.deezer.com/playlist/30/tracks?index=1' }),
        )
        .mockResolvedValueOnce(mockHttpError(500));

      await expect(deezerFetchAll<DeezerTrack>('/playlist/30/tracks')).rejects.toThrow('Deezer HTTP error');
    });

    it('throws instead of looping forever when next points back to an already-seen URL', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          mockRestOk({ data: [MOCK_TRACK], total: 2, next: 'https://api.deezer.com/playlist/30/tracks?index=1' }),
        )
        .mockResolvedValueOnce(
          mockRestOk({
            data: [{ ...MOCK_TRACK, id: 2 }],
            total: 2,
            next: 'https://api.deezer.com/playlist/30/tracks?index=1',
          }),
        );

      await expect(deezerFetchAll<DeezerTrack>('/playlist/30/tracks')).rejects.toThrow(
        'Deezer pagination loop detected',
      );
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('throws instead of looping forever when next never stops (exceeds maxPages)', async () => {
      let page = 0;
      vi.mocked(fetch).mockImplementation(() => {
        page += 1;
        return Promise.resolve(
          mockRestOk({
            data: [{ ...MOCK_TRACK, id: page }],
            total: 999999,
            next: `https://api.deezer.com/playlist/30/tracks?index=${page}`,
          }),
        );
      });

      await expect(deezerFetchAll<DeezerTrack>('/playlist/30/tracks', 3)).rejects.toThrow(
        'Deezer pagination exceeded 3 pages',
      );
    });
  });

  describe('deezerFetchAllFrom', () => {
    it('does not refetch the first page — starts from the given page and follows next', async () => {
      const TRACK_2 = { ...MOCK_TRACK, id: 2 };
      vi.mocked(fetch).mockResolvedValueOnce(mockRestOk({ data: [TRACK_2], total: 2 }));

      const items = await deezerFetchAllFrom<DeezerTrack>({
        data: [MOCK_TRACK],
        total: 2,
        next: 'https://api.deezer.com/playlist/30/tracks?index=1',
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('https://api.deezer.com/playlist/30/tracks?index=1', expect.anything());
      expect(items.map((t) => t.id)).toEqual([1, 2]);
    });

    it('returns the first page as-is when it has no next', async () => {
      const items = await deezerFetchAllFrom<DeezerTrack>({ data: [MOCK_TRACK], total: 1 });
      expect(fetch).not.toHaveBeenCalled();
      expect(items).toEqual([MOCK_TRACK]);
    });
  });

  describe('searchDeezer', () => {
    it('builds correct URL for track search', async () => {
      vi.mocked(fetch).mockResolvedValue(mockRestOk({ data: [MOCK_TRACK], total: 1 }));
      const results = await searchDeezer('daft punk', 'track', 10);
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/search/track');
      expect(calledUrl).toContain('q=daft+punk');
      expect(calledUrl).toContain('limit=10');
      expect(results.tracks?.data).toHaveLength(1);
    });

    it('defaults to type track and limit 25', async () => {
      vi.mocked(fetch).mockResolvedValue(mockRestOk({ data: [], total: 0 }));
      await searchDeezer('test');
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/search/track');
      expect(calledUrl).toContain('limit=25');
    });
  });

  describe('getTrackPreviewUrl', () => {
    it('returns preview URL', async () => {
      vi.mocked(fetch).mockResolvedValue(mockRestOk(MOCK_TRACK));
      const url = await getTrackPreviewUrl(1);
      expect(url).toBe('https://cdns-preview.deezer.com/stream/test.mp3');
    });

    it('throws when no preview available', async () => {
      const { preview: _preview, ...trackNoPreview } = MOCK_TRACK;
      vi.mocked(fetch).mockResolvedValue(mockRestOk(trackNoPreview));
      await expect(getTrackPreviewUrl(1)).rejects.toThrow('No preview available for track 1');
    });
  });

  // ---------------------------------------------------------------------------
  // Endpoints authentifiés (Pipe API pipe.deezer.com)
  // ---------------------------------------------------------------------------

  describe('authenticated endpoints', () => {
    it('getCurrentUser acquires JWT and calls Pipe API', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockPipeOk({ me: { id: '99', email: 'test@test.com', user: { id: '99', name: 'Test User' } } }),
      );
      const user = await getCurrentUser();
      expect(getDeezerJwt).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith(
        PIPE_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer mock-jwt-token' }),
        }),
      );
      expect(user).toEqual({ id: '99', name: 'Test User', email: 'test@test.com' });
    });

    it('getCurrentUser throws when DEEZER_ARL not set', async () => {
      vi.mocked(getDeezerJwt).mockRejectedValue(new Error('DEEZER_ARL not set'));
      await expect(getCurrentUser()).rejects.toThrow('DEEZER_ARL not set');
    });

    it('getUserTracks returns mapped PipeTrack[]', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockPipeOk({ me: { userFavorites: { tracks: { edges: [{ node: PIPE_TRACK_NODE }] } } } }),
      );
      const tracks = await getUserTracks(5);
      expect(fetch).toHaveBeenCalledWith(PIPE_URL, expect.objectContaining({ method: 'POST' }));
      expect(tracks).toHaveLength(1);
      expect(tracks[0].id).toBe('1');
      expect(tracks[0].title).toBe('Test Track');
      expect(tracks[0].isrc).toBe('USTEST000001');
      expect(tracks[0].artists).toEqual([{ id: '10', name: 'Artist' }]);
      const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
      expect(body.variables.first).toBe(5);
    });

    it('getUserAlbums returns mapped PipeAlbum[]', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockPipeOk({ me: { userFavorites: { albums: { edges: [{ node: PIPE_ALBUM_NODE }] } } } }),
      );
      const albums = await getUserAlbums(5);
      expect(albums).toHaveLength(1);
      expect(albums[0].id).toBe('20');
      expect(albums[0].displayTitle).toBe('Album');
      expect(albums[0].contributors).toEqual([{ id: '10', name: 'Artist' }]);
    });

    it('getUserArtists returns mapped PipeFavoriteArtist[]', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockPipeOk({ me: { userFavorites: { artists: { edges: [{ node: PIPE_ARTIST_NODE }] } } } }),
      );
      const artists = await getUserArtists(5);
      expect(artists).toHaveLength(1);
      expect(artists[0].id).toBe('10');
      expect(artists[0].fansCount).toBe(1000);
    });

    it('getUserPlaylists returns mapped PipePlaylist[]', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockPipeOk({ me: { playlists: { edges: [{ node: PIPE_PLAYLIST_NODE }] } } }),
      );
      const playlists = await getUserPlaylists(5);
      expect(playlists).toHaveLength(1);
      expect(playlists[0].id).toBe('30');
      expect(playlists[0].owner).toEqual({ id: '99', name: 'Test User' });
    });

    it('getUserLibrary fires 4 parallel Pipe requests', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockPipeOk({ me: { userFavorites: { tracks: { edges: [{ node: PIPE_TRACK_NODE }] } } } }))
        .mockResolvedValueOnce(mockPipeOk({ me: { userFavorites: { albums: { edges: [{ node: PIPE_ALBUM_NODE }] } } } }))
        .mockResolvedValueOnce(mockPipeOk({ me: { userFavorites: { artists: { edges: [{ node: PIPE_ARTIST_NODE }] } } } }))
        .mockResolvedValueOnce(mockPipeOk({ me: { playlists: { edges: [{ node: PIPE_PLAYLIST_NODE }] } } }));

      const library = await getUserLibrary();

      expect(fetch).toHaveBeenCalledTimes(4);
      for (const call of vi.mocked(fetch).mock.calls) {
        expect(call[0]).toBe(PIPE_URL);
        const headers = (call[1] as RequestInit).headers as Record<string, string>;
        expect(headers['Authorization']).toBe('Bearer mock-jwt-token');
      }
      expect(library.tracks).toHaveLength(1);
      expect(library.albums).toHaveLength(1);
      expect(library.artists).toHaveLength(1);
      expect(library.playlists).toHaveLength(1);
    });

    it('getUserLibrary forwards a custom limit to all 4 underlying requests', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockPipeOk({
          me: {
            userFavorites: {
              tracks: { edges: [] },
              albums: { edges: [] },
              artists: { edges: [] },
            },
            playlists: { edges: [] },
          },
        }),
      );

      await getUserLibrary(200);

      for (const call of vi.mocked(fetch).mock.calls) {
        const body = JSON.parse((call[1] as RequestInit).body as string);
        expect(body.variables).toEqual({ first: 200 });
      }
    });

    it('getUserLibrary defaults to limit 50', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockPipeOk({
          me: {
            userFavorites: {
              tracks: { edges: [] },
              albums: { edges: [] },
              artists: { edges: [] },
            },
            playlists: { edges: [] },
          },
        }),
      );

      await getUserLibrary();

      const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
      expect(body.variables).toEqual({ first: 50 });
    });
  });

  // ---------------------------------------------------------------------------
  // Gestion d'erreurs
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('throws on HTTP error (REST)', async () => {
      vi.mocked(fetch).mockResolvedValue(mockHttpError(500));
      await expect(getTrack(1)).rejects.toThrow('Deezer HTTP error: 500');
    });

    it('throws on HTTP error (Pipe)', async () => {
      vi.mocked(fetch).mockResolvedValue(mockHttpError(500));
      await expect(getCurrentUser()).rejects.toThrow('Deezer Pipe HTTP error: 500');
    });

    it('throws on GraphQL errors (Pipe)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ errors: [{ message: 'Unauthorized' }] }),
      } as unknown as Response);
      await expect(getCurrentUser()).rejects.toThrow('Deezer Pipe GraphQL error: Unauthorized');
    });

    it('throws on GraphQL errors with null message (Pipe)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ errors: [{ message: null }] }),
      } as unknown as Response);
      await expect(getCurrentUser()).rejects.toThrow('Deezer Pipe GraphQL error');
    });

    it('throws on malformed JSON from Pipe API', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      } as unknown as Response);
      await expect(getCurrentUser()).rejects.toThrow('Deezer Pipe invalid JSON response');
    });

    it('throws on generic Deezer REST API error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(fetch).mockResolvedValue(
        mockRestOk({ error: { type: 'DataException', message: 'Not found', code: 800 } }),
      );
      await expect(getTrack(999)).rejects.toThrow('Deezer error (800)');
      consoleSpy.mockRestore();
    });
  });
});

// ---------------------------------------------------------------------------
// getStreamUrl
// ---------------------------------------------------------------------------

describe('getStreamUrl', () => {
  beforeEach(() => {
    vi.stubEnv('DEEZER_ARL', 'test-arl-token');
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(getDeezerJwt).mockResolvedValue('mock-jwt-token');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns cached URL from Redis without calling Pipe API', async () => {
    mockRedis.get.mockResolvedValue('https://cdn.deezer.com/cached.mp3');
    const url = await getStreamUrl(123);
    expect(url).toBe('https://cdn.deezer.com/cached.mp3');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('queries Pipe API on cache miss and caches result', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockPipeOk({
        track: {
          id: '123',
          mediaList: [{ backUrl: 'https://cdn.deezer.com/stream.mp3', format: 'MP3_128', cipher: { type: 'NONE' } }],
        },
      }),
    );
    const url = await getStreamUrl(123);
    expect(url).toBe('https://cdn.deezer.com/stream.mp3');
    expect(mockRedis.set).toHaveBeenCalledWith('stream:123', 'https://cdn.deezer.com/stream.mp3', 'EX', 3600);
  });

  it('prefers non-encrypted stream over encrypted', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockPipeOk({
        track: {
          id: '123',
          mediaList: [
            { backUrl: 'https://cdn.deezer.com/encrypted.mp3', format: 'MP3_320', cipher: { type: 'BF_CBC_STRIPE' } },
            { backUrl: 'https://cdn.deezer.com/direct.mp3', format: 'MP3_128', cipher: { type: 'NONE' } },
          ],
        },
      }),
    );
    const url = await getStreamUrl(123);
    expect(url).toBe('https://cdn.deezer.com/direct.mp3');
  });

  it('falls back to first backUrl when all streams are encrypted', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockPipeOk({
        track: {
          id: '123',
          mediaList: [
            { backUrl: 'https://cdn.deezer.com/enc1.mp3', format: 'MP3_320', cipher: { type: 'BF_CBC_STRIPE' } },
          ],
        },
      }),
    );
    const url = await getStreamUrl(123);
    expect(url).toBe('https://cdn.deezer.com/enc1.mp3');
  });

  it('throws when track not found', async () => {
    vi.mocked(fetch).mockResolvedValue(mockPipeOk({ track: null }));
    await expect(getStreamUrl(999)).rejects.toThrow('Track 999 not found');
  });

  it('throws when no backUrl in mediaList', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockPipeOk({ track: { id: '123', mediaList: [{ format: 'MP3_128', cipher: { type: 'NONE' } }] } }),
    );
    await expect(getStreamUrl(123)).rejects.toThrow('No stream URL available for track 123');
  });

  it('throws ARL expired error with explicit message', async () => {
    vi.mocked(getDeezerJwt).mockRejectedValue(new Error('Deezer JWT auth returned invalid token'));
    await expect(getStreamUrl(123)).rejects.toThrow('Deezer ARL expired — renew your ARL token');
  });

  it('throws quota exceeded error with explicit message', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ errors: [{ message: 'quota exceeded' }] }),
    } as unknown as Response);
    await expect(getStreamUrl(123)).rejects.toThrow('Deezer quota exceeded — try again later');
  });
});
