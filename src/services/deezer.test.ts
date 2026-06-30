import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAlbum,
  getArtist,
  getArtistTopTracks,
  getCurrentUser,
  getPlaylist,
  getTrack,
  getTrackPreviewUrl,
  getUserAlbums,
  getUserArtists,
  getUserLibrary,
  getUserPlaylists,
  getUserTracks,
  searchDeezer,
} from './deezer';
import type { DeezerAlbum, DeezerArtist, DeezerPlaylist, DeezerTrack, DeezerUser } from '../types/deezer';

function mockOk(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
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
  link: 'https://www.deezer.com/artist/10',
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
  link: 'https://www.deezer.com/album/20',
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
  link: 'https://www.deezer.com/playlist/30',
  tracklist: '',
  type: 'playlist',
};

const MOCK_USER: DeezerUser = {
  id: 99,
  name: 'Test User',
  link: 'https://www.deezer.com/profile/99',
  type: 'user',
};

describe('deezer service', () => {
  beforeEach(() => {
    vi.stubEnv('DEEZER_ARL', 'test-arl-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('getTrack', () => {
    it('fetches correct URL and returns track', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_TRACK));
      const track = await getTrack(1);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.deezer.com/track/1',
        expect.objectContaining({ headers: expect.not.objectContaining({ Cookie: expect.anything() }) }),
      );
      expect(track).toEqual(MOCK_TRACK);
    });

    it('does not send ARL cookie on public endpoint', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_TRACK));
      await getTrack(1);
      const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers['Cookie']).toBeUndefined();
    });
  });

  describe('getArtist', () => {
    it('fetches /artist/{id}', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_ARTIST));
      const artist = await getArtist(10);
      expect(fetch).toHaveBeenCalledWith('https://api.deezer.com/artist/10', expect.anything());
      expect(artist.name).toBe('Artist');
    });
  });

  describe('getArtistTopTracks', () => {
    it('fetches /artist/{id}/top with limit', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk({ data: [MOCK_TRACK], total: 1 }));
      await getArtistTopTracks(10, 10);
      expect(fetch).toHaveBeenCalledWith('https://api.deezer.com/artist/10/top?limit=10', expect.anything());
    });
  });

  describe('getAlbum', () => {
    it('fetches /album/{id}', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_ALBUM));
      const album = await getAlbum(20);
      expect(fetch).toHaveBeenCalledWith('https://api.deezer.com/album/20', expect.anything());
      expect(album.title).toBe('Album');
    });
  });

  describe('getPlaylist', () => {
    it('fetches /playlist/{id}', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_PLAYLIST));
      const playlist = await getPlaylist(30);
      expect(fetch).toHaveBeenCalledWith('https://api.deezer.com/playlist/30', expect.anything());
      expect(playlist.title).toBe('Playlist');
    });
  });

  describe('searchDeezer', () => {
    it('builds correct URL for track search', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk({ data: [MOCK_TRACK], total: 1 }));
      const results = await searchDeezer('daft punk', 'track', 10);
      const calledUrl = (vi.mocked(fetch).mock.calls[0][0] as string);
      expect(calledUrl).toContain('/search/track');
      expect(calledUrl).toContain('q=daft+punk');
      expect(calledUrl).toContain('limit=10');
      expect(results.tracks?.data).toHaveLength(1);
    });

    it('defaults to type track and limit 25', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk({ data: [], total: 0 }));
      await searchDeezer('test');
      const calledUrl = (vi.mocked(fetch).mock.calls[0][0] as string);
      expect(calledUrl).toContain('/search/track');
      expect(calledUrl).toContain('limit=25');
    });
  });

  describe('getTrackPreviewUrl', () => {
    it('returns preview URL', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_TRACK));
      const url = await getTrackPreviewUrl(1);
      expect(url).toBe('https://cdns-preview.deezer.com/stream/test.mp3');
    });

    it('throws when no preview available', async () => {
      const trackNoPreview = { ...MOCK_TRACK, preview: undefined };
      vi.mocked(fetch).mockResolvedValue(mockOk(trackNoPreview));
      await expect(getTrackPreviewUrl(1)).rejects.toThrow('No preview available for track 1');
    });
  });

  describe('authenticated endpoints', () => {
    it('getCurrentUser sends ARL cookie', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_USER));
      await getCurrentUser();
      const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers['Cookie']).toBe('arl=test-arl-token');
    });

    it('getCurrentUser throws when DEEZER_ARL not set', async () => {
      vi.stubEnv('DEEZER_ARL', '');
      await expect(getCurrentUser()).rejects.toThrow('DEEZER_ARL not set');
    });

    it('getUserTracks sends ARL cookie', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk({ data: [MOCK_TRACK], total: 1 }));
      await getUserTracks();
      const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers['Cookie']).toBe('arl=test-arl-token');
    });

    it('getUserAlbums fetches /user/me/albums', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk({ data: [MOCK_ALBUM], total: 1 }));
      await getUserAlbums();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/user/me/albums'), expect.anything());
    });

    it('getUserArtists fetches /user/me/artists', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk({ data: [MOCK_ARTIST], total: 1 }));
      await getUserArtists();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/user/me/artists'), expect.anything());
    });

    it('getUserPlaylists fetches /user/me/playlists', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk({ data: [MOCK_PLAYLIST], total: 1 }));
      await getUserPlaylists();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/user/me/playlists'), expect.anything());
    });

    it('getUserLibrary fires 4 parallel authenticated requests', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk({ data: [], total: 0 }));
      await getUserLibrary();
      expect(fetch).toHaveBeenCalledTimes(4);
      for (const call of vi.mocked(fetch).mock.calls) {
        const headers = (call[1] as RequestInit).headers as Record<string, string>;
        expect(headers['Cookie']).toBe('arl=test-arl-token');
      }
    });
  });

  describe('error handling', () => {
    it('throws on HTTP error', async () => {
      vi.mocked(fetch).mockResolvedValue(mockHttpError(500));
      await expect(getTrack(1)).rejects.toThrow('Deezer HTTP error: 500');
    });

    it('throws and logs on ARL expiry (code 300)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(fetch).mockResolvedValue(
        mockOk({ error: { type: 'OAuthException', message: 'Invalid token', code: 300 } }),
      );
      await expect(getCurrentUser()).rejects.toThrow('Deezer auth error (300)');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ARL expired'));
      consoleSpy.mockRestore();
    });

    it('throws and logs on ARL expiry (code 700 DataException)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(fetch).mockResolvedValue(
        mockOk({ error: { type: 'DataException', message: 'Token invalid', code: 700 } }),
      );
      await expect(getCurrentUser()).rejects.toThrow('Deezer auth error (700)');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ARL expired'));
      consoleSpy.mockRestore();
    });

    it('throws on generic Deezer API error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(fetch).mockResolvedValue(
        mockOk({ error: { type: 'DataException', message: 'Not found', code: 800 } }),
      );
      await expect(getTrack(999)).rejects.toThrow('Deezer error (800)');
      consoleSpy.mockRestore();
    });
  });
});
