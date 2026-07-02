import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapAlbum, albumResolvers } from './album';
import type { DeezerAlbum, DeezerArtist, DeezerTrack } from '../../types/deezer';

vi.mock('../../services/deezer', () => ({
  getAlbum: vi.fn(),
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

describe('Query.album', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getAlbum with the given id and returns mapped album', async () => {
    vi.mocked(getAlbum).mockResolvedValue(MOCK_ALBUM);
    const result = await albumResolvers.Query.album(undefined, { id: '20' });
    expect(getAlbum).toHaveBeenCalledWith('20');
    expect(result?.title).toBe('Discovery');
    expect(result?.nbTracks).toBe(14);
  });

  it('returns null when service throws', async () => {
    vi.mocked(getAlbum).mockRejectedValue(new Error('Not found'));
    const result = await albumResolvers.Query.album(undefined, { id: '999' });
    expect(result).toBeNull();
  });
});
