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

  it('rejects every waiter when fetchMany fails for every key individually too', async () => {
    const fetchMany = vi.fn().mockRejectedValue(new Error('DB down'));
    const load = createBatcher(fetchMany, (v: { id: number }) => v.id);

    await expect(Promise.all([load(1), load(2)])).rejects.toThrow('DB down');
  });

  it('isolates a single bad key: retries individually on batch failure so unrelated keys still resolve', async () => {
    const fetchMany = vi.fn().mockImplementation((keys: number[]) => {
      if (keys.length > 1) return Promise.reject(new Error('invalid key in batch'));
      if (keys[0] === 666) return Promise.reject(new Error('key 666 is cursed'));
      return Promise.resolve([{ id: keys[0], name: `item-${keys[0]}` }]);
    });
    const load = createBatcher(fetchMany, (v: { id: number }) => v.id);

    const [good, bad] = await Promise.allSettled([load(1), load(666)]);

    expect(good).toEqual({ status: 'fulfilled', value: { id: 1, name: 'item-1' } });
    expect(bad.status).toBe('rejected');
    expect((bad as PromiseRejectedResult).reason.message).toBe('key 666 is cursed');
  });

  it('does not retry when the failed batch had a single key (would just repeat the same failure)', async () => {
    const fetchMany = vi.fn().mockRejectedValue(new Error('key 1 is invalid'));
    const load = createBatcher(fetchMany, (v: { id: number }) => v.id);

    await expect(load(1)).rejects.toThrow('key 1 is invalid');
    expect(fetchMany).toHaveBeenCalledTimes(1);
  });

  it('fails fast on likely-systemic failure: if the first retried key also fails, rejects the rest without calling fetchMany for each', async () => {
    let individualCalls = 0;
    const fetchMany = vi.fn().mockImplementation((keys: number[]) => {
      if (keys.length > 1) return Promise.reject(new Error('connection reset'));
      individualCalls += 1;
      return Promise.reject(new Error('connection reset'));
    });
    const load = createBatcher(fetchMany, (v: { id: number }) => v.id);

    const results = await Promise.allSettled([load(1), load(2), load(3)]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(individualCalls).toBe(1);
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
