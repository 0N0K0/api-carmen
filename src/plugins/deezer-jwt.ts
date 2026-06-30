const DEEZER_AUTH_URL = 'https://auth.deezer.com/login/arl';
const JWT_REFRESH_MARGIN_SECONDS = 30;
const REQUEST_TIMEOUT_MS = 10000;

let _jwt: string | null = null;
let _jwtExpiresAt = 0;

/**
 * Retourne un JWT Deezer valide, acquis ou rafraîchi depuis l'ARL.
 * Rafraîchit automatiquement 30s avant l'expiration (TTL = 6 min).
 * @returns {Promise<string>} JWT Bearer token.
 * @throws {Error} Si `DEEZER_ARL` n'est pas défini ou si l'auth échoue.
 */
export async function getDeezerJwt(): Promise<string> {
  const now = Date.now() / 1000;
  if (_jwt && now < _jwtExpiresAt - JWT_REFRESH_MARGIN_SECONDS) return _jwt;

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

  const data = JSON.parse(await response.text()) as { jwt: string };
  _jwt = data.jwt;

  const payloadB64 = _jwt.split('.')[1];
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as { exp: number };
  _jwtExpiresAt = payload.exp;

  return _jwt;
}

/** Réinitialise le JWT mis en cache (utile pour les tests). */
export function resetDeezerJwt(): void {
  _jwt = null;
  _jwtExpiresAt = 0;
}
