import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapArtist, artistResolvers } from './artist';
import type { DeezerArtist } from '../../types/deezer';

vi.mock('../../services/deezer', () => ({
  getArtist: vi.fn(),
}));

import { getArtist } from '../../services/deezer';

const MOCK_ARTIST: DeezerArtist = {
  id: 10,
  name: 'Daft Punk',
  link: 'https://www.deezer.com/artist/10',
  picture: 'https://api.deezer.com/artist/10/image',
  picture_small: '',
  picture_medium: '',
  picture_big: '',
  picture_xl: '',
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
      link: 'https://www.deezer.com/artist/10',
      picture: 'https://api.deezer.com/artist/10/image',
      nbAlbum: 8,
      nbFan: 5000000,
    });
  });

  it('maps id as string', () => {
    expect(mapArtist(MOCK_ARTIST).id).toBe('10');
  });

  it('maps nb_album → nbAlbum, nb_fan → nbFan', () => {
    const result = mapArtist({ ...MOCK_ARTIST, nb_album: 3, nb_fan: 42 });
    expect(result.nbAlbum).toBe(3);
    expect(result.nbFan).toBe(42);
  });

  it('sets nullable fields to null when absent', () => {
    const { nb_album: _a, nb_fan: _f, ...minimal } = MOCK_ARTIST;
    const result = mapArtist(minimal as DeezerArtist);
    expect(result.nbAlbum).toBeNull();
    expect(result.nbFan).toBeNull();
  });
});

describe('Query.artist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getArtist with the given id and returns mapped artist', async () => {
    vi.mocked(getArtist).mockResolvedValue(MOCK_ARTIST);
    const result = await artistResolvers.Query.artist(undefined, { id: '10' });
    expect(getArtist).toHaveBeenCalledWith('10');
    expect(result?.name).toBe('Daft Punk');
    expect(result?.id).toBe('10');
  });

  it('returns null when service throws', async () => {
    vi.mocked(getArtist).mockRejectedValue(new Error('Not found'));
    const result = await artistResolvers.Query.artist(undefined, { id: '999' });
    expect(result).toBeNull();
  });
});
