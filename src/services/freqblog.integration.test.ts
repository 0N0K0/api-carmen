/**
 * Tests d'intégration FreqBlog — appellent la vraie API.
 * Lancer avec : FREQBLOG_API_KEY=<key> npx vitest run --reporter=verbose src/services/freqblog.integration.test.ts
 * Nécessite REDIS_URL en plus pour le cache.
 */
import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { getAudioFeatures, getAudioFeaturesBatch } from './freqblog';

const hasKey = !!process.env.FREQBLOG_API_KEY;

describe.skipIf(!hasKey)('freqblog integration', () => {
  beforeAll(() => {
    if (!process.env.REDIS_URL) {
      console.warn('[integration] REDIS_URL not set — cache skipped (Redis errors expected)');
    }
  });

  it('lookup single track — Blinding Lights', async () => {
    const result = await getAudioFeatures({
      track: 'Blinding Lights',
      artist: 'The Weeknd',
      isrc: 'USUMV2403154',
    });
    expect(result).not.toBeNull();
    expect(result?.track_name).toBeTruthy();
    expect(result?.artist_name).toBeTruthy();
    expect(result?.bpm).toBeTypeOf('number');
  });

  it('lookup known tracks — Starboy', async () => {
    const result = await getAudioFeatures({
      track: 'Starboy',
      artist: 'The Weeknd',
    });
    expect(result).not.toBeNull();
    expect(result?.bpm).toBeTypeOf('number');
  });

  it('batch lookup — multiple known tracks', async () => {
    const results = await getAudioFeaturesBatch([
      { track: 'Blinding Lights', artist: 'The Weeknd' },
      { track: 'Starboy', artist: 'The Weeknd' },
    ]);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((f) => f.track_name && f.artist_name)).toBe(true);
  });
});
