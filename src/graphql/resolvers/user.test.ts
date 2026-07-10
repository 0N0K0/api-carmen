import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userResolvers } from './user';

vi.mock('../../services/deezer', () => ({
  getCurrentUser: vi.fn(),
  getUserLibrary: vi.fn(),
}));

vi.mock('../../services/sync', () => ({
  syncUserLibrary: vi.fn(),
}));

import { getCurrentUser, getUserLibrary } from '../../services/deezer';
import { syncUserLibrary } from '../../services/sync';

describe('Query.currentUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the current user profile', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: '99', name: 'Test User', email: 'test@test.com' });
    const result = await userResolvers.Query.currentUser();
    expect(result).toEqual({ id: '99', name: 'Test User', email: 'test@test.com' });
  });

  it('propagates auth errors instead of swallowing them (unlike public lookups)', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Deezer ARL expired — renew your ARL token'));
    await expect(userResolvers.Query.currentUser()).rejects.toThrow('Deezer ARL expired');
  });
});

describe('Query.userLibrary', () => {
  beforeEach(() => vi.clearAllMocks());

  const LIBRARY = { tracks: [], albums: [], artists: [], playlists: [] };

  it('forwards the given limit to getUserLibrary', async () => {
    vi.mocked(getUserLibrary).mockResolvedValue(LIBRARY);
    await userResolvers.Query.userLibrary(undefined, { limit: 200 });
    expect(getUserLibrary).toHaveBeenCalledWith(200);
  });

  it('returns the library as-is', async () => {
    vi.mocked(getUserLibrary).mockResolvedValue(LIBRARY);
    const result = await userResolvers.Query.userLibrary(undefined, {});
    expect(result).toBe(LIBRARY);
  });

  it('propagates errors instead of swallowing them', async () => {
    vi.mocked(getUserLibrary).mockRejectedValue(new Error('Deezer ARL expired — renew your ARL token'));
    await expect(userResolvers.Query.userLibrary(undefined, {})).rejects.toThrow('Deezer ARL expired');
  });
});

describe('Mutation.syncUserLibrary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards the given limit and returns the sync summary', async () => {
    const summary = {
      playlistsSynced: 2,
      playlistsRemoved: 1,
      albumsSynced: 1,
      artistsSynced: 3,
      tracksSynced: 4,
      errors: [],
    };
    vi.mocked(syncUserLibrary).mockResolvedValue(summary);

    const result = await userResolvers.Mutation.syncUserLibrary(undefined, { limit: 100 });

    expect(syncUserLibrary).toHaveBeenCalledWith(100);
    expect(result).toBe(summary);
  });
});
