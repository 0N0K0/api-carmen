import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDeezerJwt, resetDeezerJwt } from './deezer-jwt';

// JWT valide : payload { exp: <loin dans le futur> }
function makeJwt(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `header.${payload}.signature`;
}

const FAR_FUTURE = Math.floor(Date.now() / 1000) + 3600;
const MOCK_JWT = makeJwt(FAR_FUTURE);

function mockAuthOk(jwt: string = MOCK_JWT): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(JSON.stringify({ jwt })),
  } as unknown as Response;
}

function mockAuthError(status = 401): Response {
  return {
    ok: false,
    status,
    statusText: 'Unauthorized',
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

describe('deezer-jwt', () => {
  beforeEach(() => {
    vi.stubEnv('DEEZER_ARL', 'test-arl');
    vi.stubGlobal('fetch', vi.fn());
    resetDeezerJwt();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('acquiert un JWT depuis ARL et le met en cache', async () => {
    vi.mocked(fetch).mockResolvedValue(mockAuthOk());
    const jwt = await getDeezerJwt();
    expect(jwt).toBe(MOCK_JWT);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('auth.deezer.com'),
      expect.objectContaining({ headers: expect.objectContaining({ Cookie: 'arl=test-arl' }) }),
    );
  });

  it('retourne le cache sans rappeler l\'API si JWT valide', async () => {
    vi.mocked(fetch).mockResolvedValue(mockAuthOk());
    await getDeezerJwt();
    await getDeezerJwt();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rafraîchit si JWT expiré (exp dans le passé)', async () => {
    const expiredJwt = makeJwt(Math.floor(Date.now() / 1000) - 10);
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockAuthOk(expiredJwt))
      .mockResolvedValueOnce(mockAuthOk(MOCK_JWT));
    await getDeezerJwt();
    const jwt2 = await getDeezerJwt();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(jwt2).toBe(MOCK_JWT);
  });

  it('sérialise les appels concurrents — un seul fetch', async () => {
    vi.mocked(fetch).mockResolvedValue(mockAuthOk());
    const [a, b, c] = await Promise.all([getDeezerJwt(), getDeezerJwt(), getDeezerJwt()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toBe(MOCK_JWT);
    expect(b).toBe(MOCK_JWT);
    expect(c).toBe(MOCK_JWT);
  });

  it('lève une erreur si DEEZER_ARL absent', async () => {
    vi.stubEnv('DEEZER_ARL', '');
    await expect(getDeezerJwt()).rejects.toThrow('DEEZER_ARL not set');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('lève une erreur sur réponse HTTP d\'auth non-OK', async () => {
    vi.mocked(fetch).mockResolvedValue(mockAuthError(403));
    await expect(getDeezerJwt()).rejects.toThrow('Deezer JWT auth failed: 403');
  });

  it('lève une erreur si le token retourné est absent', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ jwt: '' })),
    } as unknown as Response);
    await expect(getDeezerJwt()).rejects.toThrow('invalid token');
  });

  it('lève une erreur si le payload JWT n\'est pas du JSON base64 valide', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ jwt: 'header.!!!notbase64!!!.sig' })),
    } as unknown as Response);
    await expect(getDeezerJwt()).rejects.toThrow('failed to parse token expiry');
  });

  it('lève une erreur si le payload JWT n\'a pas de champ exp', async () => {
    const noExp = `header.${Buffer.from('{"sub":"123"}').toString('base64url')}.sig`;
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ jwt: noExp })),
    } as unknown as Response);
    await expect(getDeezerJwt()).rejects.toThrow('failed to parse token expiry');
  });
});
