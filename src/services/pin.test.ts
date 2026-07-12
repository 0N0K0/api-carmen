import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  playlist: { update: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
  album: { update: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
  artist: { update: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
};
vi.mock('../plugins/prisma', () => ({
  getPrismaClient: () => mockPrisma,
}));

import {
  getPinnedItems,
  pinAlbum,
  pinArtist,
  pinPlaylist,
  reorderPinnedItems,
  unpinAlbum,
  unpinArtist,
  unpinPlaylist,
} from './pin';

describe('pinPlaylist / pinAlbum / pinArtist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.playlist.aggregate.mockResolvedValue({ _max: { pinnedOrder: null } });
    mockPrisma.album.aggregate.mockResolvedValue({ _max: { pinnedOrder: null } });
    mockPrisma.artist.aggregate.mockResolvedValue({ _max: { pinnedOrder: null } });
  });

  it('pins a playlist at order 0 when nothing is pinned yet', async () => {
    await pinPlaylist(30);
    expect(mockPrisma.playlist.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { isPinned: true, pinnedOrder: 0 },
    });
  });

  it('pins at the next unified order across all three types', async () => {
    mockPrisma.playlist.aggregate.mockResolvedValue({ _max: { pinnedOrder: 2 } });
    mockPrisma.album.aggregate.mockResolvedValue({ _max: { pinnedOrder: 5 } });
    mockPrisma.artist.aggregate.mockResolvedValue({ _max: { pinnedOrder: 1 } });

    await pinAlbum(20);

    expect(mockPrisma.album.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { isPinned: true, pinnedOrder: 6 },
    });
  });

  it('pins an artist using the same unified order sequence', async () => {
    mockPrisma.playlist.aggregate.mockResolvedValue({ _max: { pinnedOrder: 3 } });

    await pinArtist(10);

    expect(mockPrisma.artist.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { isPinned: true, pinnedOrder: 4 },
    });
  });
});

describe('unpinPlaylist / unpinAlbum / unpinArtist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unpins a playlist and clears its order', async () => {
    await unpinPlaylist(30);
    expect(mockPrisma.playlist.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { isPinned: false, pinnedOrder: null },
    });
  });

  it('unpins an album and clears its order', async () => {
    await unpinAlbum(20);
    expect(mockPrisma.album.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { isPinned: false, pinnedOrder: null },
    });
  });

  it('unpins an artist and clears its order', async () => {
    await unpinArtist(10);
    expect(mockPrisma.artist.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { isPinned: false, pinnedOrder: null },
    });
  });
});

describe('getPinnedItems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('merges playlists, albums and artists tagged with __typename, sorted by pinnedOrder', async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([{ id: 30, title: 'P', pinnedOrder: 2 }]);
    mockPrisma.album.findMany.mockResolvedValue([{ id: 20, title: 'A', pinnedOrder: 0 }]);
    mockPrisma.artist.findMany.mockResolvedValue([{ id: 10, name: 'Ar', pinnedOrder: 1 }]);

    const result = await getPinnedItems();

    expect(mockPrisma.playlist.findMany).toHaveBeenCalledWith({ where: { isPinned: true } });
    expect(result).toEqual([
      { id: 20, title: 'A', pinnedOrder: 0, __typename: 'Album' },
      { id: 10, name: 'Ar', pinnedOrder: 1, __typename: 'Artist' },
      { id: 30, title: 'P', pinnedOrder: 2, __typename: 'Playlist' },
    ]);
  });

  it('returns an empty array when nothing is pinned', async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([]);
    mockPrisma.album.findMany.mockResolvedValue([]);
    mockPrisma.artist.findMany.mockResolvedValue([]);

    expect(await getPinnedItems()).toEqual([]);
  });
});

describe('reorderPinnedItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.playlist.findMany.mockResolvedValue([]);
    mockPrisma.album.findMany.mockResolvedValue([]);
    mockPrisma.artist.findMany.mockResolvedValue([]);
  });

  it('assigns sequential pinnedOrder across mixed types, in the given order', async () => {
    await reorderPinnedItems([
      { type: 'ALBUM', id: 20 },
      { type: 'ARTIST', id: 10 },
      { type: 'PLAYLIST', id: 30 },
    ]);

    expect(mockPrisma.album.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { isPinned: true, pinnedOrder: 0 },
    });
    expect(mockPrisma.artist.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { isPinned: true, pinnedOrder: 1 },
    });
    expect(mockPrisma.playlist.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { isPinned: true, pinnedOrder: 2 },
    });
  });

  it('returns the freshly pinned items afterwards', async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([{ id: 30, title: 'P', pinnedOrder: 0 }]);

    const result = await reorderPinnedItems([{ type: 'PLAYLIST', id: 30 }]);

    expect(result).toEqual([{ id: 30, title: 'P', pinnedOrder: 0, __typename: 'Playlist' }]);
  });
});
