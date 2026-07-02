import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapPlaylist, playlistResolvers } from './playlist';
import type { DeezerAlbum, DeezerArtist, DeezerPlaylist, DeezerTrack } from '../../types/deezer';

vi.mock('../../services/deezer', () => ({
  getPlaylist: vi.fn(),
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

describe('Query.playlist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls getPlaylist with the given id and returns mapped playlist', async () => {
    vi.mocked(getPlaylist).mockResolvedValue(MOCK_PLAYLIST);
    const result = await playlistResolvers.Query.playlist(undefined, { id: '30' });
    expect(getPlaylist).toHaveBeenCalledWith('30');
    expect(result?.title).toBe('My Playlist');
    expect(result?.fans).toBe(42);
  });

  it('returns null when service throws', async () => {
    vi.mocked(getPlaylist).mockRejectedValue(new Error('Not found'));
    const result = await playlistResolvers.Query.playlist(undefined, { id: '999' });
    expect(result).toBeNull();
  });
});
