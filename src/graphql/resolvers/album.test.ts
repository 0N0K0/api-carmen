import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapAlbum, albumResolvers } from './album';
import type { DeezerAlbum, DeezerArtist, DeezerTrack } from '../../types/deezer';

vi.mock('../../services/deezer', () => ({
  getAlbum: vi.fn(),
}));

const mockPrisma = {
  album: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
};
vi.mock('../../plugins/prisma', () => ({
  getPrismaClient: () => mockPrisma,
}));

import { getAlbum } from '../../services/deezer';

const MOCK_ARTIST: DeezerArtist = {
  id: 10,
  name: 'Daft Punk',
  link: '',
  picture: 'https://api.deezer.com/artist/10/image',
  picture_small: '',
  picture_medium: '',
  picture_big: '',
  picture_xl: '',
  tracklist: '',
  type: 'artist',
};

const MOCK_TRACK: DeezerTrack = {
  id: 1,
  title: 'One More Time',
  duration: 320,
  link: 'https://www.deezer.com/track/1',
  artist: MOCK_ARTIST,
  album: { id: 20, title: 'Discovery', link: '', cover: '', cover_small: '', cover_medium: '', cover_big: '', cover_xl: '', tracklist: '', type: 'album' },
  type: 'track',
};

const MOCK_ALBUM: DeezerAlbum = {
  id: 20,
  title: 'Discovery',
  upc: '724384960255',
  link: 'https://www.deezer.com/album/20',
  cover: 'https://api.deezer.com/album/20/image',
  cover_small: '',
  cover_medium: '',
  cover_big: '',
  cover_xl: '',
  label: 'Virgin',
  nb_tracks: 14,
  duration: 3600,
  fans: 800000,
  release_date: '2001-03-07',
  record_type: 'album',
  explicit_lyrics: false,
  artist: MOCK_ARTIST,
  tracks: { data: [MOCK_TRACK] },
  tracklist: '',
  type: 'album',
};

describe('mapAlbum', () => {
  it('maps all fields', () => {
    const result = mapAlbum(MOCK_ALBUM);
    expect(result.id).toBe('20');
    expect(result.title).toBe('Discovery');
    expect(result.upc).toBe('724384960255');
    expect(result.label).toBe('Virgin');
    expect(result.nbTracks).toBe(14);
    expect(result.releaseDate).toBe('2001-03-07');
    expect(result.recordType).toBe('album');
    expect(result.explicitLyrics).toBe(false);
  });

  it('maps nb_tracks → nbTracks, release_date → releaseDate, record_type → recordType, explicit_lyrics → explicitLyrics', () => {
    const result = mapAlbum(MOCK_ALBUM);
    expect(result.nbTracks).toBe(14);
    expect(result.releaseDate).toBe('2001-03-07');
    expect(result.recordType).toBe('album');
    expect(result.explicitLyrics).toBe(false);
  });

  it('maps nested artist', () => {
    const result = mapAlbum(MOCK_ALBUM);
    expect(result.artist?.name).toBe('Daft Punk');
    expect(result.artist?.id).toBe('10');
  });

  it('maps nested tracks', () => {
    const result = mapAlbum(MOCK_ALBUM);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks![0].title).toBe('One More Time');
  });

  it('sets artist and tracks to null when absent', () => {
    const { artist: _a, tracks: _t, ...minimal } = MOCK_ALBUM;
    const result = mapAlbum(minimal as DeezerAlbum);
    expect(result.artist).toBeNull();
    expect(result.tracks).toBeNull();
  });
});

const MOCK_DB_ARTIST = { id: 10, name: 'Daft Punk', link: null, picture: null, nbAlbum: null, nbFan: null };

const MOCK_DB_ALBUM = {
  id: 20,
  title: 'Discovery',
  upc: null,
  link: null,
  cover: null,
  md5Image: null,
  label: null,
  nbTracks: 14,
  duration: null,
  fans: null,
  releaseDate: null,
  recordType: null,
  explicitLyrics: null,
  artistId: 10,
  artist: MOCK_DB_ARTIST,
  tracks: [],
};

const MOCK_DB_TRACK_WITH_ALBUM = {
  id: 1,
  title: 'One More Time',
  titleShort: null,
  titleVersion: null,
  isrc: null,
  link: null,
  duration: 320,
  trackPosition: 1,
  diskNumber: null,
  rank: null,
  releaseDate: null,
  explicitLyrics: null,
  preview: null,
  bpm: null,
  gain: null,
  artistId: 10,
  albumId: 20,
  artist: MOCK_DB_ARTIST,
  album: { ...MOCK_DB_ALBUM, tracks: undefined },
};

describe('Query.album', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the album from DB without calling Deezer when found', async () => {
    mockPrisma.album.findUnique.mockResolvedValue(MOCK_DB_ALBUM);
    const result = await albumResolvers.Query.album(undefined, { id: '20' });
    expect(mockPrisma.album.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 20 } }),
    );
    expect(getAlbum).not.toHaveBeenCalled();
    expect(result?.title).toBe('Discovery');
    expect(result?.artist?.name).toBe('Daft Punk');
  });

  it('falls back to Deezer when not found in DB', async () => {
    mockPrisma.album.findUnique.mockResolvedValue(null);
    vi.mocked(getAlbum).mockResolvedValue(MOCK_ALBUM);
    const result = await albumResolvers.Query.album(undefined, { id: '20' });
    expect(getAlbum).toHaveBeenCalledWith('20');
    expect(result?.title).toBe('Discovery');
    expect(result?.nbTracks).toBe(14);
  });

  it('returns null when both DB and Deezer fail', async () => {
    mockPrisma.album.findUnique.mockResolvedValue(null);
    vi.mocked(getAlbum).mockRejectedValue(new Error('Not found'));
    const result = await albumResolvers.Query.album(undefined, { id: '999' });
    expect(result).toBeNull();
  });

  it('includes album on each nested track (Track.album is non-null in schema)', async () => {
    mockPrisma.album.findUnique.mockResolvedValue({
      ...MOCK_DB_ALBUM,
      tracks: [MOCK_DB_TRACK_WITH_ALBUM],
    });
    const result = await albumResolvers.Query.album(undefined, { id: '20' });
    expect(result?.tracks?.[0].album).not.toBeNull();
    expect(result?.tracks?.[0].album?.title).toBe('Discovery');
  });
});

describe('Query.albums', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated albums from DB', async () => {
    mockPrisma.album.findMany.mockResolvedValue([MOCK_DB_ALBUM]);
    mockPrisma.album.count.mockResolvedValue(1);

    const result = await albumResolvers.Query.albums(undefined, { limit: 10, offset: 0 });

    expect(mockPrisma.album.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Discovery');
    expect(result.pagination).toEqual({ offset: 0, limit: 10, total: 1 });
  });

  it('defaults limit and offset when not provided', async () => {
    mockPrisma.album.findMany.mockResolvedValue([]);
    mockPrisma.album.count.mockResolvedValue(0);

    await albumResolvers.Query.albums(undefined, {});

    expect(mockPrisma.album.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });
});
