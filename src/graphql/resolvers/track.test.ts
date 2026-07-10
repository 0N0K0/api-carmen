import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapTrack, trackResolvers } from './track';
import type { DeezerAlbum, DeezerArtist, DeezerPlaylist, DeezerTrack } from '../../types/deezer';

vi.mock('../../services/deezer', () => ({
  getTrack: vi.fn(),
  getStreamUrl: vi.fn(),
  searchDeezer: vi.fn(),
}));

const mockPrisma = {
  track: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  artist: { findMany: vi.fn() },
  album: { findMany: vi.fn() },
};
vi.mock('../../plugins/prisma', () => ({
  getPrismaClient: () => mockPrisma,
}));

import { getTrack, getStreamUrl, searchDeezer } from '../../services/deezer';

const MOCK_ARTIST: DeezerArtist = {
  id: 10,
  name: 'Daft Punk',
  link: 'https://www.deezer.com/artist/10',
  picture: 'https://api.deezer.com/artist/10/image',
  picture_small: '',
  picture_medium: '',
  picture_big: '',
  picture_xl: '',
  nb_fan: 5000000,
  tracklist: '',
  type: 'artist',
};

const MOCK_ALBUM: DeezerAlbum = {
  id: 20,
  title: 'Discovery',
  link: 'https://www.deezer.com/album/20',
  cover: 'https://api.deezer.com/album/20/image',
  cover_small: '',
  cover_medium: '',
  cover_big: '',
  cover_xl: '',
  tracklist: '',
  type: 'album',
};

const MOCK_TRACK: DeezerTrack = {
  id: 1,
  title: 'Harder, Better, Faster, Stronger',
  title_short: 'Harder, Better',
  isrc: 'GBDUW0000059',
  link: 'https://www.deezer.com/track/1',
  duration: 226,
  rank: 900000,
  release_date: '2001-03-07',
  explicit_lyrics: false,
  preview: 'https://cdns-preview.deezer.com/stream/test.mp3',
  bpm: 123.4,
  gain: -8.5,
  artist: MOCK_ARTIST,
  album: MOCK_ALBUM,
  type: 'track',
};

describe('Mutation.getStreamUrl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns stream URL from service', async () => {
    vi.mocked(getStreamUrl).mockResolvedValue('https://cdn.deezer.com/stream.mp3');
    const result = await trackResolvers.Mutation.getStreamUrl(undefined, { trackId: '123' });
    expect(getStreamUrl).toHaveBeenCalledWith('123');
    expect(result).toBe('https://cdn.deezer.com/stream.mp3');
  });

  it('propagates service errors (ARL expired, quota, etc.)', async () => {
    vi.mocked(getStreamUrl).mockRejectedValue(new Error('Deezer ARL expired — renew your ARL token'));
    await expect(trackResolvers.Mutation.getStreamUrl(undefined, { trackId: '123' })).rejects.toThrow(
      'Deezer ARL expired — renew your ARL token',
    );
  });
});

describe('mapTrack', () => {
  it('maps all fields', () => {
    const result = mapTrack(MOCK_TRACK);
    expect(result.id).toBe('1');
    expect(result.title).toBe('Harder, Better, Faster, Stronger');
    expect(result.duration).toBe(226);
    expect(result.bpm).toBe(123.4);
    expect(result.gain).toBe(-8.5);
  });

  it('maps title_short → titleShort, release_date → releaseDate, explicit_lyrics → explicitLyrics', () => {
    const result = mapTrack(MOCK_TRACK);
    expect(result.titleShort).toBe('Harder, Better');
    expect(result.releaseDate).toBe('2001-03-07');
    expect(result.explicitLyrics).toBe(false);
  });

  it('maps nested artist', () => {
    const result = mapTrack(MOCK_TRACK);
    expect(result.artist.id).toBe('10');
    expect(result.artist.name).toBe('Daft Punk');
  });

  it('maps inline nested album', () => {
    const result = mapTrack(MOCK_TRACK);
    expect(result.album.id).toBe('20');
    expect(result.album.title).toBe('Discovery');
    expect(result.album.cover).toBe('https://api.deezer.com/album/20/image');
  });

  it('sets nullable fields to null when absent', () => {
    const { title_short: _ts, isrc: _i, bpm: _b, gain: _g, ...minimal } = MOCK_TRACK;
    const result = mapTrack(minimal as DeezerTrack);
    expect(result.titleShort).toBeNull();
    expect(result.isrc).toBeNull();
    expect(result.bpm).toBeNull();
    expect(result.gain).toBeNull();
  });

  it('sets isFavorite to null (not derivable from the public Deezer REST endpoint)', () => {
    const result = mapTrack(MOCK_TRACK);
    expect(result.isFavorite).toBeNull();
  });
});

const MOCK_DB_ARTIST = {
  id: 10,
  name: 'Daft Punk',
  link: null,
  picture: null,
  nbAlbum: null,
  nbFan: null,
};

const MOCK_DB_TRACK = {
  id: 1,
  title: 'Harder, Better, Faster, Stronger',
  titleShort: null,
  titleVersion: null,
  isrc: null,
  link: null,
  duration: 226,
  trackPosition: null,
  diskNumber: null,
  rank: null,
  releaseDate: null,
  explicitLyrics: null,
  preview: null,
  bpm: null,
  gain: null,
  artistId: 10,
  albumId: 20,
};

describe('Query.track', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the raw DB row without calling Deezer when found', async () => {
    mockPrisma.track.findUnique.mockResolvedValue(MOCK_DB_TRACK);
    const result = await trackResolvers.Query.track(undefined, { id: '1' });
    expect(mockPrisma.track.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(getTrack).not.toHaveBeenCalled();
    expect(result).toEqual(MOCK_DB_TRACK);
  });

  it('falls back to Deezer when not found in DB', async () => {
    mockPrisma.track.findUnique.mockResolvedValue(null);
    vi.mocked(getTrack).mockResolvedValue(MOCK_TRACK);
    const result = await trackResolvers.Query.track(undefined, { id: '1' });
    expect(getTrack).toHaveBeenCalledWith('1');
    expect(result?.title).toBe('Harder, Better, Faster, Stronger');
    expect(result?.duration).toBe(226);
  });

  it('falls back to Deezer when id is not numeric', async () => {
    vi.mocked(getTrack).mockResolvedValue(MOCK_TRACK);
    const result = await trackResolvers.Query.track(undefined, { id: 'abc' });
    expect(mockPrisma.track.findUnique).not.toHaveBeenCalled();
    expect(getTrack).toHaveBeenCalledWith('abc');
    expect(result?.title).toBe('Harder, Better, Faster, Stronger');
  });

  it('returns null when both DB and Deezer fail', async () => {
    mockPrisma.track.findUnique.mockResolvedValue(null);
    vi.mocked(getTrack).mockRejectedValue(new Error('Not found'));
    const result = await trackResolvers.Query.track(undefined, { id: '999' });
    expect(result).toBeNull();
  });
});

describe('Query.tracks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated tracks from DB', async () => {
    mockPrisma.track.findMany.mockResolvedValue([MOCK_DB_TRACK]);
    mockPrisma.track.count.mockResolvedValue(1);

    const result = await trackResolvers.Query.tracks(undefined, { limit: 10, offset: 0 });

    expect(mockPrisma.track.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Harder, Better, Faster, Stronger');
    expect(result.pagination).toEqual({ offset: 0, limit: 10, total: 1 });
  });

  it('defaults limit and offset when not provided', async () => {
    mockPrisma.track.findMany.mockResolvedValue([]);
    mockPrisma.track.count.mockResolvedValue(0);

    await trackResolvers.Query.tracks(undefined, {});

    expect(mockPrisma.track.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });
});

describe('Track.artist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns parent.artist directly when already resolved (Deezer fallback)', async () => {
    const mappedTrack = mapTrack(MOCK_TRACK);
    const result = await trackResolvers.Track.artist(mappedTrack);
    expect(mockPrisma.artist.findMany).not.toHaveBeenCalled();
    expect(result).toBe(mappedTrack.artist);
  });

  it('loads from Prisma by artistId when not already resolved (DB row), batched via findMany', async () => {
    mockPrisma.artist.findMany.mockResolvedValue([MOCK_DB_ARTIST]);
    const result = await trackResolvers.Track.artist(MOCK_DB_TRACK);
    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith({ where: { id: { in: [10] } } });
    expect(result).toEqual(MOCK_DB_ARTIST);
  });
});

describe('Track.album', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns parent.album directly when already resolved (Deezer fallback)', async () => {
    const mappedTrack = mapTrack(MOCK_TRACK);
    const result = await trackResolvers.Track.album(mappedTrack);
    expect(mockPrisma.album.findMany).not.toHaveBeenCalled();
    expect(result).toBe(mappedTrack.album);
  });

  it('loads from Prisma by albumId when not already resolved (DB row), batched via findMany', async () => {
    const dbAlbum = { id: 20, title: 'Discovery' };
    mockPrisma.album.findMany.mockResolvedValue([dbAlbum]);
    const result = await trackResolvers.Track.album(MOCK_DB_TRACK);
    expect(mockPrisma.album.findMany).toHaveBeenCalledWith({ where: { id: { in: [20] } } });
    expect(result).toEqual(dbAlbum);
  });
});

describe('Query.search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lowercases SearchType enum and passes to searchDeezer', async () => {
    vi.mocked(searchDeezer).mockResolvedValue({ tracks: { data: [MOCK_TRACK] } });
    await trackResolvers.Query.search(undefined, { query: 'daft punk', type: 'TRACK', limit: 5 });
    expect(searchDeezer).toHaveBeenCalledWith('daft punk', 'track', 5);
  });

  it('defaults to type track when no type given', async () => {
    vi.mocked(searchDeezer).mockResolvedValue({ tracks: { data: [MOCK_TRACK] } });
    await trackResolvers.Query.search(undefined, { query: 'test' });
    expect(searchDeezer).toHaveBeenCalledWith('test', 'track', 25);
  });

  it('returns mapped tracks in SearchResults', async () => {
    vi.mocked(searchDeezer).mockResolvedValue({ tracks: { data: [MOCK_TRACK] } });
    const result = await trackResolvers.Query.search(undefined, { query: 'daft punk', type: 'TRACK' });
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks![0].title).toBe('Harder, Better, Faster, Stronger');
    expect(result.albums).toBeNull();
    expect(result.artists).toBeNull();
    expect(result.playlists).toBeNull();
  });

  it('returns mapped artists when type is ARTIST', async () => {
    vi.mocked(searchDeezer).mockResolvedValue({ artists: { data: [MOCK_ARTIST] } });
    const result = await trackResolvers.Query.search(undefined, { query: 'daft', type: 'ARTIST' });
    expect(result.artists).toHaveLength(1);
    expect(result.artists![0].name).toBe('Daft Punk');
    expect(result.tracks).toBeNull();
  });

  it('returns mapped albums when type is ALBUM', async () => {
    vi.mocked(searchDeezer).mockResolvedValue({ albums: { data: [MOCK_ALBUM] } });
    const result = await trackResolvers.Query.search(undefined, { query: 'discovery', type: 'ALBUM' });
    expect(result.albums).toHaveLength(1);
    expect(result.albums![0].title).toBe('Discovery');
  });

  it('returns mapped playlists when type is PLAYLIST', async () => {
    const MOCK_PLAYLIST: DeezerPlaylist = {
      id: 30,
      title: 'Top Hits',
      link: '',
      tracklist: '',
      type: 'playlist',
    };
    vi.mocked(searchDeezer).mockResolvedValue({ playlists: { data: [MOCK_PLAYLIST] } });
    const result = await trackResolvers.Query.search(undefined, { query: 'top hits', type: 'PLAYLIST' });
    expect(searchDeezer).toHaveBeenCalledWith('top hits', 'playlist', 25);
    expect(result.playlists).toHaveLength(1);
    expect(result.playlists![0].title).toBe('Top Hits');
    expect(result.tracks).toBeNull();
  });

  it('returns empty arrays when searchDeezer returns empty data', async () => {
    vi.mocked(searchDeezer).mockResolvedValue({ tracks: { data: [] } });
    const result = await trackResolvers.Query.search(undefined, { query: 'nothing', type: 'TRACK' });
    expect(result.tracks).toEqual([]);
    expect(result.albums).toBeNull();
  });

  it('returns empty SearchResults when searchDeezer throws', async () => {
    vi.mocked(searchDeezer).mockRejectedValue(new Error('Rate limited'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await trackResolvers.Query.search(undefined, { query: 'test' });
    expect(result).toEqual({ tracks: null, albums: null, artists: null, playlists: null });
    expect(consoleSpy).toHaveBeenCalledWith('[resolver] search error:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
