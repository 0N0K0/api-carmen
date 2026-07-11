import { describe, it, expect, vi } from 'vitest';
import { paginate, parseDbId, sortDirection } from './pagination';

describe('parseDbId', () => {
  it('parses a numeric string', () => {
    expect(parseDbId('123')).toBe(123);
  });

  it('returns null for an empty string', () => {
    expect(parseDbId('')).toBeNull();
  });

  it('returns null for a whitespace-only string', () => {
    expect(parseDbId('   ')).toBeNull();
  });

  it('returns null for a non-numeric string', () => {
    expect(parseDbId('abc')).toBeNull();
  });
});

describe('sortDirection', () => {
  it('defaults to asc when undefined', () => {
    expect(sortDirection(undefined)).toBe('asc');
  });

  it('maps ASC to asc', () => {
    expect(sortDirection('ASC')).toBe('asc');
  });

  it('maps DESC to desc', () => {
    expect(sortDirection('DESC')).toBe('desc');
  });
});

describe('paginate', () => {
  it('defaults to limit 20, offset 0', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);

    await paginate({}, findMany, count);

    expect(findMany).toHaveBeenCalledWith(20, 0);
  });

  it('clamps limit above 100 down to 100', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);

    const result = await paginate({ limit: 5000, offset: 0 }, findMany, count);

    expect(findMany).toHaveBeenCalledWith(100, 0);
    expect(result.pagination.limit).toBe(100);
  });

  it('clamps limit below 1 up to 1', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);

    await paginate({ limit: -5, offset: 0 }, findMany, count);

    expect(findMany).toHaveBeenCalledWith(1, 0);
  });

  it('clamps negative offset up to 0', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);

    await paginate({ limit: 10, offset: -50 }, findMany, count);

    expect(findMany).toHaveBeenCalledWith(10, 0);
  });

  it('returns items and pagination from parallel calls', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 1 }]);
    const count = vi.fn().mockResolvedValue(42);

    const result = await paginate({ limit: 10, offset: 5 }, findMany, count);

    expect(result.items).toEqual([{ id: 1 }]);
    expect(result.pagination).toEqual({ offset: 5, limit: 10, total: 42 });
  });
});
