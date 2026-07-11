import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/pin', () => ({
  getPinnedItems: vi.fn(),
  pinPlaylist: vi.fn(),
  unpinPlaylist: vi.fn(),
  pinAlbum: vi.fn(),
  unpinAlbum: vi.fn(),
  pinArtist: vi.fn(),
  unpinArtist: vi.fn(),
  reorderPinnedItems: vi.fn(),
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
} from '../../services/pin';
import { pinResolvers } from './pin';

describe('Query.pinnedItems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the pinned items as-is', async () => {
    const items = [{ id: 1, __typename: 'Playlist' }];
    vi.mocked(getPinnedItems).mockResolvedValue(items as never);
    expect(await pinResolvers.Query.pinnedItems()).toBe(items);
  });
});

describe('PinnedItem.__resolveType', () => {
  it('resolves the concrete type from the __typename tag', () => {
    expect(pinResolvers.PinnedItem.__resolveType({ __typename: 'Album' })).toBe('Album');
  });
});

describe('Mutation pin/unpin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pinPlaylist converts the GraphQL id and delegates to the service', async () => {
    vi.mocked(pinPlaylist).mockResolvedValue({ id: 30 } as never);
    const result = await pinResolvers.Mutation.pinPlaylist(undefined, { id: '30' });
    expect(pinPlaylist).toHaveBeenCalledWith(30);
    expect(result).toEqual({ id: 30 });
  });

  it('unpinPlaylist converts the GraphQL id and delegates to the service', async () => {
    await pinResolvers.Mutation.unpinPlaylist(undefined, { id: '30' });
    expect(unpinPlaylist).toHaveBeenCalledWith(30);
  });

  it('pinAlbum converts the GraphQL id and delegates to the service', async () => {
    await pinResolvers.Mutation.pinAlbum(undefined, { id: '20' });
    expect(pinAlbum).toHaveBeenCalledWith(20);
  });

  it('unpinAlbum converts the GraphQL id and delegates to the service', async () => {
    await pinResolvers.Mutation.unpinAlbum(undefined, { id: '20' });
    expect(unpinAlbum).toHaveBeenCalledWith(20);
  });

  it('pinArtist converts the GraphQL id and delegates to the service', async () => {
    await pinResolvers.Mutation.pinArtist(undefined, { id: '10' });
    expect(pinArtist).toHaveBeenCalledWith(10);
  });

  it('unpinArtist converts the GraphQL id and delegates to the service', async () => {
    await pinResolvers.Mutation.unpinArtist(undefined, { id: '10' });
    expect(unpinArtist).toHaveBeenCalledWith(10);
  });

  it('throws a clear error for an invalid id instead of calling the service', async () => {
    await expect(pinResolvers.Mutation.pinPlaylist(undefined, { id: 'not-a-number' })).rejects.toThrow(
      'Invalid id: not-a-number',
    );
    expect(pinPlaylist).not.toHaveBeenCalled();
  });
});

describe('Mutation.reorderPinnedItems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts each item id and delegates to the service, preserving order', async () => {
    const reordered = [{ id: 20, __typename: 'Album' }];
    vi.mocked(reorderPinnedItems).mockResolvedValue(reordered as never);

    const result = await pinResolvers.Mutation.reorderPinnedItems(undefined, {
      items: [
        { type: 'ALBUM', id: '20' },
        { type: 'ARTIST', id: '10' },
      ],
    });

    expect(reorderPinnedItems).toHaveBeenCalledWith([
      { type: 'ALBUM', id: 20 },
      { type: 'ARTIST', id: 10 },
    ]);
    expect(result).toBe(reordered);
  });
});
