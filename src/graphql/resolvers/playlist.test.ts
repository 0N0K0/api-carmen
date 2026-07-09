import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapPlaylist, playlistResolvers } from './playlist';
import type { DeezerAlbum, DeezerArtist, DeezerPlaylist, DeezerTrack } from '../../types/deezer';

vi.mock('../../services/deezer', () => ({
  getPlaylist: vi.fn(),
}));

const mockPrisma = {
  playlist: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  playlistTrack: { findMany: vi.fn() },
};
vi.mock('../../plugins/prisma', () => ({
  getPrismaClient: () => mockPrisma,
}));

import { getPlaylist } from '../../services/deezer';

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

const MOCK_TRACK: DeezerTrack = {
  id: 1,
  title: 'Track One',
  duration: 200,
  link: '',
  artist: MOCK_ARTIST,
  album: MOCK_ALBUM,
  type: 'track',
};

const MOCK_PLAYLIST: DeezerPlaylist = {
  id: 30,
  title: 'My Playlist',
  description: 'A great playlist',
  duration: 3600,
  public: true,
  is_loved_track: false,
  collaborative: false,
  fans: 42,
  link: 'https://www.deezer.com/playlist/30',
  picture: 'https://api.deezer.com/playlist/30/image',
  checksum: 'abc123',
  tracks: { data: [MOCK_TRACK] },
  tracklist: '',
  type: 'playlist',
};

describe('mapPlaylist', () => {
  it('maps all fields', () => {
    const result = mapPlaylist(MOCK_PLAYLIST);
    expect(result.id).toBe('30');
    expect(result.title).toBe('My Playlist');
    expect(result.description).toBe('A great playlist');
    expect(result.duration).toBe(3600);
    expect(result.public).toBe(true);
    expect(result.fans).toBe(42);
    expect(result.link).toBe('https://www.deezer.com/playlist/30');
    expect(result.checksum).toBe('abc123');
  });

  it('maps is_loved_track → isLovedTrack', () => {
    expect(mapPlaylist(MOCK_PLAYLIST).isLovedTrack).toBe(false);
  });

  it('maps nested tracks', () => {
    const result = mapPlaylist(MOCK_PLAYLIST);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks![0].title).toBe('Track One');
  });

  it('sets tracks to null when absent', () => {
    const { tracks: _t, ...minimal } = MOCK_PLAYLIST;
    const result = mapPlaylist(minimal as DeezerPlaylist);
    expect(result.tracks).toBeNull();
  });

  it('sets nullable fields to null when absent', () => {
    const { description: _d, fans: _f, checksum: _c, ...minimal } = MOCK_PLAYLIST;
    const result = mapPlaylist(minimal as DeezerPlaylist);
    expect(result.description).toBeNull();
    expect(result.fans).toBeNull();
    expect(result.checksum).toBeNull();
  });
});

const MOCK_DB_PLAYLIST = {
  id: 30,
  title: 'My Playlist',
  description: 'A great playlist',
  duration: 3600,
  public: true,
  isLovedTrack: false,
  collaborative: false,
  fans: 42,
  link: 'https://www.deezer.com/playlist/30',
  picture: 'https://api.deezer.com/playlist/30/image',
  checksum: 'abc123',
  folderId: null,
};

describe('Query.playlist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the raw DB row without calling Deezer when found', async () => {
    mockPrisma.playlist.findUnique.mockResolvedValue(MOCK_DB_PLAYLIST);
    const result = await playlistResolvers.Query.playlist(undefined, { id: '30' });
    expect(mockPrisma.playlist.findUnique).toHaveBeenCalledWith({ where: { id: 30 } });
    expect(getPlaylist).not.toHaveBeenCalled();
    expect(result).toEqual(MOCK_DB_PLAYLIST);
  });

  it('falls back to Deezer when not found in DB', async () => {
    mockPrisma.playlist.findUnique.mockResolvedValue(null);
    vi.mocked(getPlaylist).mockResolvedValue(MOCK_PLAYLIST);
    const result = await playlistResolvers.Query.playlist(undefined, { id: '30' });
    expect(getPlaylist).toHaveBeenCalledWith('30');
    expect(result?.title).toBe('My Playlist');
    expect(result?.fans).toBe(42);
  });

  it('returns null when both DB and Deezer fail', async () => {
    mockPrisma.playlist.findUnique.mockResolvedValue(null);
    vi.mocked(getPlaylist).mockRejectedValue(new Error('Not found'));
    const result = await playlistResolvers.Query.playlist(undefined, { id: '999' });
    expect(result).toBeNull();
  });
});

describe('Query.playlists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated playlists from DB', async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([MOCK_DB_PLAYLIST]);
    mockPrisma.playlist.count.mockResolvedValue(1);

    const result = await playlistResolvers.Query.playlists(undefined, { limit: 10, offset: 0 });

    expect(mockPrisma.playlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('My Playlist');
    expect(result.pagination).toEqual({ offset: 0, limit: 10, total: 1 });
  });

  it('defaults limit and offset when not provided', async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([]);
    mockPrisma.playlist.count.mockResolvedValue(0);

    await playlistResolvers.Query.playlists(undefined, {});

    expect(mockPrisma.playlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });
});

describe('Playlist.tracks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns parent.tracks directly when already resolved (Deezer fallback)', async () => {
    const mappedPlaylist = mapPlaylist(MOCK_PLAYLIST);
    const result = await playlistResolvers.Playlist.tracks(mappedPlaylist);
    expect(mockPrisma.playlistTrack.findMany).not.toHaveBeenCalled();
    expect(result).toBe(mappedPlaylist.tracks);
  });

  it('loads via PlaylistTrack ordered by position when not already resolved (DB row)', async () => {
    mockPrisma.playlistTrack.findMany.mockResolvedValue([
      { playlistId: 30, trackId: 1, position: 1, timeAdd: null, track: { id: 1, title: 'Track One' } },
    ]);
    const result = await playlistResolvers.Playlist.tracks(MOCK_DB_PLAYLIST);
    expect(mockPrisma.playlistTrack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { playlistId: 30 }, orderBy: { position: 'asc' } }),
    );
    expect(result).toEqual([{ id: 1, title: 'Track One' }]);
  });
});
