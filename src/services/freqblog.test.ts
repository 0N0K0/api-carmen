import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAudioFeatures, getAudioFeaturesBatch } from './freqblog';
import type { FreqblogAudioFeatures, FreqblogTrackRef } from '../types/freqblog';

vi.mock('../plugins/redis', () => {
  const get = vi.fn();
  const set = vi.fn();
  return { getRedisClient: () => ({ get, set }) };
});

import { getRedisClient } from '../plugins/redis';

function mockOk(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

function mockHttpError(status: number): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

const MOCK_FEATURES: FreqblogAudioFeatures = {
  track_name: 'Blinding Lights',
  artist_name: 'The Weeknd',
  album_name: 'Blinding Lights - Single',
  itunes_track_id: '1488408568',
  isrc: 'USUMV2403154',
  mbid: '1227659f-a933-4549-8fc4-d839b4cd3d45',
  release_date: '2019-11-29',
  duration_ms: 201570,
  explicit: false,
  source: 'itunes_search',
  first_ingested_at: '2026-04-05 07:39:31',
  bpm: 85.39,
  bpm_alt: 170.78,
  bpm_confidence: 3.6127,
  key: 'F-Minor',
  key_confidence: 0.9124,
  mode: 0,
  key_int: 5,
  camelot: '4A',
  open_key: '9m',
  loudness_db: -10.96,
  time_signature: 4,
  mood: 'tense',
  genre: 'synthwave',
  energy: 1.0,
  danceability: 0.7036,
  valence: 0.4224,
  acousticness: null,
  instrumentalness: null,
  liveness: null,
  speechiness: null,
  mood_vector: null,
  representative_segment_start: 0.0,
  onset_rate: null,
  dynamic_complexity: null,
  tuning_frequency: null,
  average_loudness: null,
  feature_source: 'essentia_preview',
  backfill_status: null,
  backfill_notification_id: null,
};

const REF: FreqblogTrackRef = { track: 'Blinding Lights', artist: 'The Weeknd', isrc: 'USUMV2403154' };
const REF_NO_ISRC: FreqblogTrackRef = { track: 'Blinding Lights', artist: 'The Weeknd' };

describe('freqblog service', () => {
  let redisMock: ReturnType<typeof getRedisClient>;

  beforeEach(() => {
    vi.stubEnv('FREQBLOG_API_KEY', 'test-api-key');
    vi.stubGlobal('fetch', vi.fn());
    redisMock = getRedisClient();
    vi.mocked(redisMock.get).mockResolvedValue(null);
    vi.mocked(redisMock.set).mockResolvedValue('OK');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('getAudioFeatures', () => {
    it('fetches correct URL with API key header', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_FEATURES));
      await getAudioFeatures(REF);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.freqblog.com/lookup?track=Blinding+Lights&artist=The+Weeknd',
        expect.objectContaining({ headers: { 'X-Api-Key': 'test-api-key' } }),
      );
    });

    it('returns features from API', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_FEATURES));
      const result = await getAudioFeatures(REF);
      expect(result).toEqual(MOCK_FEATURES);
    });

    it('caches by ISRC when isrc provided', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_FEATURES));
      await getAudioFeatures(REF);
      expect(redisMock.set).toHaveBeenCalledWith(
        'freqblog:USUMV2403154',
        JSON.stringify(MOCK_FEATURES),
        'EX',
        2592000,
      );
    });

    it('caches by track:artist when no isrc', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_FEATURES));
      await getAudioFeatures(REF_NO_ISRC);
      expect(redisMock.set).toHaveBeenCalledWith(
        'freqblog:lookup:blinding lights:the weeknd',
        JSON.stringify(MOCK_FEATURES),
        'EX',
        2592000,
      );
    });

    it('returns cached value without calling API', async () => {
      vi.mocked(redisMock.get).mockResolvedValue(JSON.stringify(MOCK_FEATURES));
      const result = await getAudioFeatures(REF);
      expect(fetch).not.toHaveBeenCalled();
      expect(result).toEqual(MOCK_FEATURES);
    });

    it('returns null when null sentinel cached', async () => {
      vi.mocked(redisMock.get).mockResolvedValue('__not_found__');
      const result = await getAudioFeatures(REF);
      expect(fetch).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('returns null for unknown track (404) and caches null with long TTL', async () => {
      vi.mocked(fetch).mockResolvedValue(mockHttpError(404));
      const result = await getAudioFeatures(REF);
      expect(result).toBeNull();
      expect(redisMock.set).toHaveBeenCalledWith('freqblog:USUMV2403154', '__not_found__', 'EX', 2592000);
    });

    it('returns null for queued track (202) and caches null with short TTL', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 202,
        statusText: 'Accepted',
        json: () => Promise.resolve({ status: 'queued' }),
      } as unknown as Response);
      const result = await getAudioFeatures(REF);
      expect(result).toBeNull();
      expect(redisMock.set).toHaveBeenCalledWith('freqblog:USUMV2403154', '__not_found__', 'EX', 300);
    });

    it('trims and lowercases cache key for track+artist ref', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_FEATURES));
      await getAudioFeatures({ track: '  Blinding Lights  ', artist: '  The Weeknd  ' });
      expect(redisMock.set).toHaveBeenCalledWith(
        'freqblog:lookup:blinding lights:the weeknd',
        expect.any(String),
        'EX',
        2592000,
      );
    });

    it('throws on non-404 HTTP errors', async () => {
      vi.mocked(fetch).mockResolvedValue(mockHttpError(500));
      await expect(getAudioFeatures(REF)).rejects.toThrow('FreqBlog HTTP error: 500');
    });

    it('throws if FREQBLOG_API_KEY not set', async () => {
      vi.unstubAllEnvs();
      await expect(getAudioFeatures(REF)).rejects.toThrow('FREQBLOG_API_KEY not set');
    });
  });

  describe('getAudioFeaturesBatch', () => {
    it('returns empty array for empty input', async () => {
      expect(await getAudioFeaturesBatch([])).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('makes parallel lookup calls for each track', async () => {
      vi.mocked(fetch).mockResolvedValue(mockOk(MOCK_FEATURES));
      const refs: FreqblogTrackRef[] = [
        { track: 'Blinding Lights', artist: 'The Weeknd' },
        { track: 'Starboy', artist: 'The Weeknd' },
      ];
      await getAudioFeaturesBatch(refs);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('skips unknown tracks gracefully', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockOk(MOCK_FEATURES))
        .mockResolvedValueOnce(mockHttpError(404));
      const refs: FreqblogTrackRef[] = [
        { track: 'Blinding Lights', artist: 'The Weeknd' },
        { track: 'Unknown Track', artist: 'Unknown Artist' },
      ];
      const result = await getAudioFeaturesBatch(refs);
      expect(result).toHaveLength(1);
    });

    it('skips tracks with API errors without throwing', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockOk(MOCK_FEATURES))
        .mockResolvedValueOnce(mockHttpError(500));
      const refs: FreqblogTrackRef[] = [
        { track: 'Blinding Lights', artist: 'The Weeknd' },
        { track: 'Error Track', artist: 'Error Artist' },
      ];
      const result = await getAudioFeaturesBatch(refs);
      expect(result).toHaveLength(1);
    });

    it('serves cached tracks without API call', async () => {
      vi.mocked(redisMock.get).mockResolvedValue(JSON.stringify(MOCK_FEATURES));
      const result = await getAudioFeaturesBatch([REF, REF_NO_ISRC]);
      expect(fetch).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });
});
