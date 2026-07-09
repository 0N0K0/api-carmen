import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DeezerAlbum, DeezerArtist, DeezerPlaylist, DeezerTrack } from '../types/deezer';

vi.mock('./deezer', () => ({
  getPlaylist: vi.fn(),
  getAlbum: vi.fn(),
  getArtist: vi.fn(),
  deezerFetchAll: vi.fn(),
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

import { deezerFetchAll, getAlbum, getArtist, getPlaylist } from './deezer';
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
  type: 'playlist',
};

const MOCK_TRACK_2: DeezerTrack = { ...MOCK_TRACK, id: 2, title: 'Track Two' };

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
      vi.mocked(deezerFetchAll).mockResolvedValue([MOCK_TRACK]);

      await syncPlaylist(30);

      expect(getPlaylist).toHaveBeenCalledWith(30);
      expect(deezerFetchAll).toHaveBeenCalledWith('/playlist/30/tracks');
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

    it('upserts every track across multiple Deezer pages (deezerFetchAll follows next)', async () => {
      vi.mocked(getPlaylist).mockResolvedValue(MOCK_PLAYLIST);
      vi.mocked(deezerFetchAll).mockResolvedValue([MOCK_TRACK, MOCK_TRACK_2]);

      await syncPlaylist(30);

      expect(mockPrisma.track.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.playlistTrack.upsert).toHaveBeenCalledWith({
        where: { playlistId_trackId: { playlistId: 30, trackId: 1 } },
        create: { playlistId: 30, trackId: 1, position: 1 },
        update: { position: 1 },
      });
      expect(mockPrisma.playlistTrack.upsert).toHaveBeenCalledWith({
        where: { playlistId_trackId: { playlistId: 30, trackId: 2 } },
        create: { playlistId: 30, trackId: 2, position: 2 },
        update: { position: 2 },
      });
    });

    it('is idempotent: always calls upsert (not create) for existing rows', async () => {
      vi.mocked(getPlaylist).mockResolvedValue(MOCK_PLAYLIST);
      vi.mocked(deezerFetchAll).mockResolvedValue([MOCK_TRACK]);

      await syncPlaylist(30);
      await syncPlaylist(30);

      expect(mockPrisma.track.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.playlist.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.playlistTrack.upsert).toHaveBeenCalledTimes(2);
    });

    it('returns the playlist fetched from Prisma with tracks included', async () => {
      vi.mocked(getPlaylist).mockResolvedValue(MOCK_PLAYLIST);
      vi.mocked(deezerFetchAll).mockResolvedValue([MOCK_TRACK]);

      const result = await syncPlaylist(30);

      expect(mockPrisma.playlist.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 30 } }),
      );
      expect(result).toEqual({ id: 30, tracks: [] });
    });
  });

  describe('syncAlbum', () => {
    it('upserts artist, album and each track', async () => {
      const albumWithArtist: DeezerAlbum = { ...MOCK_ALBUM, artist: MOCK_ARTIST };
      vi.mocked(getAlbum).mockResolvedValue(albumWithArtist);
      vi.mocked(deezerFetchAll).mockResolvedValue([MOCK_TRACK]);

      await syncAlbum(20);

      expect(getAlbum).toHaveBeenCalledWith(20);
      expect(deezerFetchAll).toHaveBeenCalledWith('/album/20/tracks');
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

    it('upserts every track across multiple Deezer pages (deezerFetchAll follows next)', async () => {
      const albumWithArtist: DeezerAlbum = { ...MOCK_ALBUM, artist: MOCK_ARTIST };
      vi.mocked(getAlbum).mockResolvedValue(albumWithArtist);
      vi.mocked(deezerFetchAll).mockResolvedValue([MOCK_TRACK, MOCK_TRACK_2]);

      await syncAlbum(20);

      expect(mockPrisma.track.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.track.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 2 } }),
      );
    });

    it('falls back to contributors[0] when album has no artist', async () => {
      const albumWithContributor: DeezerAlbum = { ...MOCK_ALBUM, contributors: [MOCK_ARTIST] };
      vi.mocked(getAlbum).mockResolvedValue(albumWithContributor);
      vi.mocked(deezerFetchAll).mockResolvedValue([]);

      await syncAlbum(20);

      expect(mockPrisma.album.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ artistId: 10 }) }),
      );
    });

    it('throws if album has no artist and no contributors', async () => {
      const albumWithoutArtist: DeezerAlbum = { ...MOCK_ALBUM };
      vi.mocked(getAlbum).mockResolvedValue(albumWithoutArtist);

      await expect(syncAlbum(20)).rejects.toThrow('Album 20 has no artist');
      expect(deezerFetchAll).not.toHaveBeenCalled();
    });
  });

  describe('syncArtist', () => {
    it('upserts artist and top tracks', async () => {
      vi.mocked(getArtist).mockResolvedValue(MOCK_ARTIST);
      vi.mocked(deezerFetchAll).mockResolvedValue([MOCK_TRACK]);

      await syncArtist(10);

      expect(getArtist).toHaveBeenCalledWith(10);
      expect(deezerFetchAll).toHaveBeenCalledWith('/artist/10/top?limit=50');
      expect(mockPrisma.artist.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 10 } }),
      );
      expect(mockPrisma.track.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('upserts top tracks across multiple Deezer pages (deezerFetchAll follows next)', async () => {
      vi.mocked(getArtist).mockResolvedValue(MOCK_ARTIST);
      vi.mocked(deezerFetchAll).mockResolvedValue([MOCK_TRACK, MOCK_TRACK_2]);

      await syncArtist(10);

      expect(mockPrisma.track.upsert).toHaveBeenCalledTimes(2);
    });

    it('passes custom limit in the Deezer path', async () => {
      vi.mocked(getArtist).mockResolvedValue(MOCK_ARTIST);
      vi.mocked(deezerFetchAll).mockResolvedValue([]);

      await syncArtist(10, 10);

      expect(deezerFetchAll).toHaveBeenCalledWith('/artist/10/top?limit=10');
    });
  });
});
