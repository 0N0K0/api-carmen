import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DeezerAlbum, DeezerArtist, DeezerPlaylist, DeezerTrack } from '../types/deezer';

vi.mock('./deezer', () => ({
  getPlaylist: vi.fn(),
  getAlbum: vi.fn(),
  getArtist: vi.fn(),
  getArtistTopTracks: vi.fn(),
}));

const mockPrisma = {
  artist: { upsert: vi.fn(), findUniqueOrThrow: vi.fn() },
  album: { upsert: vi.fn(), findUniqueOrThrow: vi.fn() },
  track: { upsert: vi.fn() },
  playlist: { upsert: vi.fn(), findUniqueOrThrow: vi.fn() },
  playlistTrack: { upsert: vi.fn() },
};
vi.mock('../plugins/prisma', () => ({
  getPrismaClient: () => mockPrisma,
}));

import { getAlbum, getArtist, getArtistTopTracks, getPlaylist } from './deezer';
import { syncAlbum, syncArtist, syncPlaylist } from './sync';

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
  link: '',
  tracklist: '',
  tracks: { data: [MOCK_TRACK] },
  type: 'playlist',
};

describe('sync service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.playlist.findUniqueOrThrow.mockResolvedValue({ id: 30, tracks: [] });
    mockPrisma.album.findUniqueOrThrow.mockResolvedValue({ id: 20, tracks: [] });
    mockPrisma.artist.findUniqueOrThrow.mockResolvedValue({ id: 10 });
  });

  describe('syncPlaylist', () => {
    it('upserts artist, album, track, playlist and playlistTrack with position', async () => {
      vi.mocked(getPlaylist).mockResolvedValue(MOCK_PLAYLIST);

      await syncPlaylist(30);

      expect(getPlaylist).toHaveBeenCalledWith(30);
      expect(mockPrisma.artist.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 10 }, create: expect.objectContaining({ id: 10 }) }),
      );
      expect(mockPrisma.album.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 20 }, create: expect.objectContaining({ id: 20, artistId: 10 }) }),
      );
      expect(mockPrisma.track.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          create: expect.objectContaining({ id: 1, artistId: 10, albumId: 20 }),
        }),
      );
      expect(mockPrisma.playlist.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 30 }, create: expect.objectContaining({ id: 30 }) }),
      );
      expect(mockPrisma.playlistTrack.upsert).toHaveBeenCalledWith({
        where: { playlistId_trackId: { playlistId: 30, trackId: 1 } },
        create: { playlistId: 30, trackId: 1, position: 1 },
        update: { position: 1 },
      });
    });

    it('is idempotent: always calls upsert (not create) for existing rows', async () => {
      vi.mocked(getPlaylist).mockResolvedValue(MOCK_PLAYLIST);

      await syncPlaylist(30);
      await syncPlaylist(30);

      expect(mockPrisma.track.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.playlist.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.playlistTrack.upsert).toHaveBeenCalledTimes(2);
    });

    it('returns the playlist fetched from Prisma with tracks included', async () => {
      vi.mocked(getPlaylist).mockResolvedValue(MOCK_PLAYLIST);

      const result = await syncPlaylist(30);

      expect(mockPrisma.playlist.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 30 } }),
      );
      expect(result).toEqual({ id: 30, tracks: [] });
    });
  });

  describe('syncAlbum', () => {
    it('upserts artist, album and each track', async () => {
      const albumWithTracks: DeezerAlbum = {
        ...MOCK_ALBUM,
        artist: MOCK_ARTIST,
        tracks: { data: [MOCK_TRACK] },
      };
      vi.mocked(getAlbum).mockResolvedValue(albumWithTracks);

      await syncAlbum(20);

      expect(getAlbum).toHaveBeenCalledWith(20);
      expect(mockPrisma.artist.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 10 } }),
      );
      expect(mockPrisma.album.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 20 }, create: expect.objectContaining({ artistId: 10 }) }),
      );
      expect(mockPrisma.track.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('falls back to contributors[0] when album has no artist', async () => {
      const albumWithContributor: DeezerAlbum = {
        ...MOCK_ALBUM,
        contributors: [MOCK_ARTIST],
        tracks: { data: [] },
      };
      vi.mocked(getAlbum).mockResolvedValue(albumWithContributor);

      await syncAlbum(20);

      expect(mockPrisma.album.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ artistId: 10 }) }),
      );
    });

    it('throws if album has no artist and no contributors', async () => {
      const albumWithoutArtist: DeezerAlbum = { ...MOCK_ALBUM, tracks: { data: [] } };
      vi.mocked(getAlbum).mockResolvedValue(albumWithoutArtist);

      await expect(syncAlbum(20)).rejects.toThrow('Album 20 has no artist');
    });
  });

  describe('syncArtist', () => {
    it('upserts artist and top tracks', async () => {
      vi.mocked(getArtist).mockResolvedValue(MOCK_ARTIST);
      vi.mocked(getArtistTopTracks).mockResolvedValue({ data: [MOCK_TRACK] });

      await syncArtist(10);

      expect(getArtist).toHaveBeenCalledWith(10);
      expect(getArtistTopTracks).toHaveBeenCalledWith(10, 50);
      expect(mockPrisma.artist.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 10 } }),
      );
      expect(mockPrisma.track.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('passes custom limit to getArtistTopTracks', async () => {
      vi.mocked(getArtist).mockResolvedValue(MOCK_ARTIST);
      vi.mocked(getArtistTopTracks).mockResolvedValue({ data: [] });

      await syncArtist(10, 10);

      expect(getArtistTopTracks).toHaveBeenCalledWith(10, 10);
    });
  });
});
