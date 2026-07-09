import { describe, it, expect, vi } from 'vitest';
import { createBatcher, createGroupBatcher } from './batch';

describe('createBatcher', () => {
  it('groups concurrent calls in the same tick into a single fetchMany call', async () => {
    const fetchMany = vi.fn().mockResolvedValue([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
    const load = createBatcher(fetchMany, (v: { id: number }) => v.id);

    const [a, b] = await Promise.all([load(1), load(2)]);

    expect(fetchMany).toHaveBeenCalledTimes(1);
    expect(fetchMany).toHaveBeenCalledWith([1, 2]);
    expect(a).toEqual({ id: 1, name: 'A' });
    expect(b).toEqual({ id: 2, name: 'B' });
  });

  it('deduplicates repeated keys within the same batch', async () => {
    const fetchMany = vi.fn().mockResolvedValue([{ id: 1, name: 'A' }]);
    const load = createBatcher(fetchMany, (v: { id: number }) => v.id);

    await Promise.all([load(1), load(1)]);

    expect(fetchMany).toHaveBeenCalledWith([1]);
  });

  it('resolves missing keys to null', async () => {
    const fetchMany = vi.fn().mockResolvedValue([]);
    const load = createBatcher(fetchMany, (v: { id: number }) => v.id);

    const result = await load(999);

    expect(result).toBeNull();
  });

  it('issues a new fetchMany call for a later batch', async () => {
    const fetchMany = vi.fn().mockResolvedValue([{ id: 1, name: 'A' }]);
    const load = createBatcher(fetchMany, (v: { id: number }) => v.id);

    await load(1);
    await load(1);

    expect(fetchMany).toHaveBeenCalledTimes(2);
  });

  it('rejects all waiters in the batch when fetchMany fails', async () => {
    const fetchMany = vi.fn().mockRejectedValue(new Error('DB down'));
    const load = createBatcher(fetchMany, (v: { id: number }) => v.id);

    await expect(Promise.all([load(1), load(2)])).rejects.toThrow('DB down');
  });
});

describe('createGroupBatcher', () => {
  it('groups results by key, preserving relative order within each group', async () => {
    const fetchMany = vi.fn().mockResolvedValue([
      { albumId: 1, position: 1 },
      { albumId: 2, position: 1 },
      { albumId: 1, position: 2 },
    ]);
    const load = createGroupBatcher(fetchMany, (v: { albumId: number }) => v.albumId);

    const [tracksOf1, tracksOf2] = await Promise.all([load(1), load(2)]);

    expect(fetchMany).toHaveBeenCalledTimes(1);
    expect(fetchMany).toHaveBeenCalledWith([1, 2]);
    expect(tracksOf1).toEqual([{ albumId: 1, position: 1 }, { albumId: 1, position: 2 }]);
    expect(tracksOf2).toEqual([{ albumId: 2, position: 1 }]);
  });

  it('resolves an empty array for a key with no matching results', async () => {
    const fetchMany = vi.fn().mockResolvedValue([]);
    const load = createGroupBatcher(fetchMany, (v: { albumId: number }) => v.albumId);

    const result = await load(42);

    expect(result).toEqual([]);
  });
});
