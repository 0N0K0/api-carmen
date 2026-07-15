import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncResolvers } from './sync';

vi.mock('../../services/sync', () => ({
  syncAlbum: vi.fn(),
  syncArtist: vi.fn(),
  syncFavoriteAlbums: vi.fn(),
  syncFavoriteArtists: vi.fn(),
  syncFavoriteTracks: vi.fn(),
  syncPlaylist: vi.fn(),
  syncPlaylists: vi.fn(),
}));

import {
  syncFavoriteAlbums,
  syncFavoriteArtists,
  syncPlaylists,
} from '../../services/sync';

describe('Mutation.syncFavoriteAlbums', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates to the syncFavoriteAlbums service with the given limit', async () => {
    const summary = { synced: 3, errors: [] };
    vi.mocked(syncFavoriteAlbums).mockResolvedValue(summary);

    const result = await syncResolvers.Mutation.syncFavoriteAlbums(undefined, { limit: 100 });

    expect(syncFavoriteAlbums).toHaveBeenCalledWith(100);
    expect(result).toEqual(summary);
  });

  it('passes undefined limit through when not provided', async () => {
    vi.mocked(syncFavoriteAlbums).mockResolvedValue({ synced: 0, errors: [] });

    await syncResolvers.Mutation.syncFavoriteAlbums(undefined, {});

    expect(syncFavoriteAlbums).toHaveBeenCalledWith(undefined);
  });
});

describe('Mutation.syncFavoriteArtists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates to the syncFavoriteArtists service with the given limit', async () => {
    const summary = { synced: 5, errors: [] };
    vi.mocked(syncFavoriteArtists).mockResolvedValue(summary);

    const result = await syncResolvers.Mutation.syncFavoriteArtists(undefined, { limit: 25 });

    expect(syncFavoriteArtists).toHaveBeenCalledWith(25);
    expect(result).toEqual(summary);
  });
});

describe('Mutation.syncPlaylists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates to the syncPlaylists service with the given limit', async () => {
    const summary = { synced: 2, removed: 1, errors: [] };
    vi.mocked(syncPlaylists).mockResolvedValue(summary);

    const result = await syncResolvers.Mutation.syncPlaylists(undefined, { limit: 10 });

    expect(syncPlaylists).toHaveBeenCalledWith(10);
    expect(result).toEqual(summary);
  });
});
