import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapArtist, artistResolvers } from './artist';
import type { DeezerArtist } from '../../types/deezer';

vi.mock('../../services/deezer', () => ({
  getArtist: vi.fn(),
}));

const mockPrisma = {
  artist: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
};
vi.mock('../../plugins/prisma', () => ({
  getPrismaClient: () => mockPrisma,
}));

import { getArtist } from '../../services/deezer';

const MOCK_ARTIST: DeezerArtist = {
  id: 10,
  name: 'Daft Punk',
  link: 'https://www.deezer.com/artist/10',
  share: 'https://www.deezer.com/artist/10?utm_source=deezer',
  picture: 'https://api.deezer.com/artist/10/image',
  picture_small: 'https://cdn-images.dzcdn.net/images/artist/x/56x56.jpg',
  picture_medium: 'https://cdn-images.dzcdn.net/images/artist/x/250x250.jpg',
  picture_big: 'https://cdn-images.dzcdn.net/images/artist/x/500x500.jpg',
  picture_xl: 'https://cdn-images.dzcdn.net/images/artist/x/1000x1000.jpg',
  nb_album: 8,
  nb_fan: 5000000,
  tracklist: '',
  type: 'artist',
};

describe('mapArtist', () => {
  it('maps all fields', () => {
    const result = mapArtist(MOCK_ARTIST);
    expect(result).toEqual({
      id: '10',
      name: 'Daft Punk',
      share: 'https://www.deezer.com/artist/10?utm_source=deezer',
      picture: 'https://api.deezer.com/artist/10/image',
      pictureSmall: 'https://cdn-images.dzcdn.net/images/artist/x/56x56.jpg',
      pictureMedium: 'https://cdn-images.dzcdn.net/images/artist/x/250x250.jpg',
      pictureBig: 'https://cdn-images.dzcdn.net/images/artist/x/500x500.jpg',
      pictureXl: 'https://cdn-images.dzcdn.net/images/artist/x/1000x1000.jpg',
      isFavorite: null,
      isPinned: false,
      pinnedOrder: null,
    });
  });

  it('maps id as string', () => {
    expect(mapArtist(MOCK_ARTIST).id).toBe('10');
  });

  it('sets nullable fields to null when absent', () => {
    const { share: _s, picture_small: _ps, picture_medium: _pm, picture_big: _pb, picture_xl: _px, ...minimal } = MOCK_ARTIST;
    const result = mapArtist(minimal as DeezerArtist);
    expect(result.share).toBeNull();
    expect(result.pictureSmall).toBeNull();
    expect(result.pictureMedium).toBeNull();
    expect(result.pictureBig).toBeNull();
    expect(result.pictureXl).toBeNull();
  });
});

const MOCK_DB_ARTIST = {
  id: 10,
  name: 'Daft Punk',
  share: 'https://www.deezer.com/artist/10?utm_source=deezer',
  picture: 'https://api.deezer.com/artist/10/image',
  pictureSmall: 'https://cdn-images.dzcdn.net/images/artist/x/56x56.jpg',
  pictureMedium: 'https://cdn-images.dzcdn.net/images/artist/x/250x250.jpg',
  pictureBig: 'https://cdn-images.dzcdn.net/images/artist/x/500x500.jpg',
  pictureXl: 'https://cdn-images.dzcdn.net/images/artist/x/1000x1000.jpg',
};

describe('Query.artist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the artist from DB without calling Deezer when found', async () => {
    mockPrisma.artist.findUnique.mockResolvedValue(MOCK_DB_ARTIST);
    const result = await artistResolvers.Query.artist(undefined, { id: '10' });
    expect(mockPrisma.artist.findUnique).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(getArtist).not.toHaveBeenCalled();
    expect(result?.name).toBe('Daft Punk');
    expect(result).toEqual(MOCK_DB_ARTIST);
  });

  it('falls back to Deezer when not found in DB', async () => {
    mockPrisma.artist.findUnique.mockResolvedValue(null);
    vi.mocked(getArtist).mockResolvedValue(MOCK_ARTIST);
    const result = await artistResolvers.Query.artist(undefined, { id: '10' });
    expect(getArtist).toHaveBeenCalledWith('10');
    expect(result?.name).toBe('Daft Punk');
  });

  it('returns null when both DB and Deezer fail', async () => {
    mockPrisma.artist.findUnique.mockResolvedValue(null);
    vi.mocked(getArtist).mockRejectedValue(new Error('Not found'));
    const result = await artistResolvers.Query.artist(undefined, { id: '999' });
    expect(result).toBeNull();
  });
});

describe('Query.artists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated artists from DB', async () => {
    mockPrisma.artist.findMany.mockResolvedValue([MOCK_DB_ARTIST]);
    mockPrisma.artist.count.mockResolvedValue(1);

    const result = await artistResolvers.Query.artists(undefined, { limit: 10, offset: 0 });

    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Daft Punk');
    expect(result.pagination).toEqual({ offset: 0, limit: 10, total: 1 });
  });

  it('defaults limit and offset when not provided', async () => {
    mockPrisma.artist.findMany.mockResolvedValue([]);
    mockPrisma.artist.count.mockResolvedValue(0);

    await artistResolvers.Query.artists(undefined, {});

    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('filters by isFavorite when favoritesOnly is true', async () => {
    mockPrisma.artist.findMany.mockResolvedValue([MOCK_DB_ARTIST]);
    mockPrisma.artist.count.mockResolvedValue(1);

    await artistResolvers.Query.artists(undefined, { favoritesOnly: true });

    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isFavorite: true } }),
    );
    expect(mockPrisma.artist.count).toHaveBeenCalledWith({ where: { isFavorite: true } });
  });

  it('does not filter when favoritesOnly is absent or false', async () => {
    mockPrisma.artist.findMany.mockResolvedValue([]);
    mockPrisma.artist.count.mockResolvedValue(0);

    await artistResolvers.Query.artists(undefined, {});

    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('filters by isPinned when pinnedOnly is true', async () => {
    mockPrisma.artist.findMany.mockResolvedValue([]);
    mockPrisma.artist.count.mockResolvedValue(0);

    await artistResolvers.Query.artists(undefined, { pinnedOnly: true });

    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPinned: true } }),
    );
  });

  it('combines favoritesOnly and pinnedOnly', async () => {
    mockPrisma.artist.findMany.mockResolvedValue([]);
    mockPrisma.artist.count.mockResolvedValue(0);

    await artistResolvers.Query.artists(undefined, { favoritesOnly: true, pinnedOnly: true });

    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isFavorite: true, isPinned: true } }),
    );
  });

  it('sorts by name ascending by default', async () => {
    mockPrisma.artist.findMany.mockResolvedValue([]);
    mockPrisma.artist.count.mockResolvedValue(0);

    await artistResolvers.Query.artists(undefined, {});

    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } }),
    );
  });

  it('sorts by name descending when orderBy is DESC', async () => {
    mockPrisma.artist.findMany.mockResolvedValue([]);
    mockPrisma.artist.count.mockResolvedValue(0);

    await artistResolvers.Query.artists(undefined, { orderBy: 'DESC' });

    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'desc' } }),
    );
  });
});
