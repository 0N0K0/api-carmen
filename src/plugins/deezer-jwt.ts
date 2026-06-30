const DEEZER_AUTH_URL = 'https://auth.deezer.com/login/arl';
const JWT_REFRESH_MARGIN_SECONDS = 30;
const REQUEST_TIMEOUT_MS = 10000;

let _jwt: string | null = null;
let _jwtExpiresAt = 0;
let _refreshPromise: Promise<string> | null = null;

async function refreshJwt(): Promise<string> {
  const arl = process.env.DEEZER_ARL;
  if (!arl) throw new Error('DEEZER_ARL not set');

  const response = await fetch(`${DEEZER_AUTH_URL}?jo=p&rto=c&i=c`, {
    method: 'POST',
    headers: { Cookie: `arl=${arl}`, 'Content-Length': '0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Deezer JWT auth failed: ${response.status} ${response.statusText}`);
  }

  const data = JSON.parse(await response.text()) as { jwt?: string };
  const jwt = data.jwt;
  if (!jwt || jwt.split('.').length !== 3) {
    throw new Error('Deezer JWT auth returned invalid token');
  }

  let exp: number;
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()) as { exp?: number };
    if (typeof payload.exp !== 'number') throw new Error('missing exp');
    exp = payload.exp;
  } catch {
    throw new Error('Deezer JWT: failed to parse token expiry');
  }

  _jwt = jwt;
  _jwtExpiresAt = exp;
  return jwt;
}

/**
 * Retourne un JWT Deezer valide, acquis ou rafraîchi depuis l'ARL.
 * Sérialise les appels concurrents — un seul refresh en vol à la fois.
 * Rafraîchit automatiquement 30s avant l'expiration (TTL ≈ 6 min).
 * @returns {Promise<string>} JWT Bearer token.
 * @throws {Error} Si `DEEZER_ARL` n'est pas défini ou si l'auth échoue.
 */
export async function getDeezerJwt(): Promise<string> {
  const now = Date.now() / 1000;
  if (_jwt && now < _jwtExpiresAt - JWT_REFRESH_MARGIN_SECONDS) return _jwt;

  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = refreshJwt().finally(() => {
    _refreshPromise = null;
  });

  return _refreshPromise;
}

/** Réinitialise le JWT mis en cache (utile pour les tests). */
export function resetDeezerJwt(): void {
  _jwt = null;
  _jwtExpiresAt = 0;
  _refreshPromise = null;
}
