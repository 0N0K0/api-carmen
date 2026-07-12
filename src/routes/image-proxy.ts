import { Router, Request, Response } from 'express';

const ALLOWED_HOSTS = ['api.deezer.com', 'cdn-images.dzcdn.net', 'e-cdns-images.dzcdn.net'];
const CACHE_MAX_AGE_SECONDS = 60 * 60 * 24; // 1 jour — les covers/pictures Deezer changent rarement
const MAX_REDIRECTS = 5;

// Le Content-Type amont n'est pas fiable (serveur tiers) : un attaquant contrôlant une des
// origines whitelistées (ou un cache/CDN mal configuré) pourrait renvoyer text/html et
// obtenir un XSS same-origin via ce proxy. On ne relaie que des types image connus.
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.includes(hostname);
}

/**
 * Suit les redirections manuellement (au lieu de `redirect: 'follow'`) pour revalider
 * chaque hop contre la whitelist — sinon une origine autorisée pourrait rediriger vers
 * une cible arbitraire (SSRF via redirection).
 * @param {URL} url Cible initiale (déjà validée contre `ALLOWED_HOSTS`).
 * @returns {Promise<globalThis.Response>} Réponse finale après redirections validées.
 * @throws {Error} Si un hop pointe vers un host non whitelisté ou si `MAX_REDIRECTS` est dépassé.
 */
async function fetchFollowingValidatedRedirects(url: URL): Promise<globalThis.Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (res.status < 300 || res.status >= 400) return res;

    const location = res.headers.get('location');
    if (!location) return res;

    const next = new URL(location, current);
    if (!isAllowedHost(next.hostname)) {
      throw new Error(`Redirect to disallowed host: ${next.hostname}`);
    }
    current = next;
  }
  throw new Error('Too many redirects');
}

/**
 * Relaie une image Deezer (cover, picture) pour contourner les restrictions CORS/hotlinking
 * côté navigateur. `url` est restreinte à une whitelist de domaines Deezer connus pour
 * éviter d'exposer un open proxy (SSRF) ; les redirections sont revalidées hop par hop pour
 * la même raison. Le Content-Type renvoyé est restreint à des types image connus (XSS).
 * @param {Request} req Requête Express, `req.query.url` porte l'URL cible.
 * @param {Response} res Réponse Express.
 * @returns {Promise<void>} Renvoie le binaire de l'image, ou un statut d'erreur.
 */
export async function imageProxyHandler(req: Request, res: Response): Promise<void> {
  const rawUrl = req.query.url;
  if (typeof rawUrl !== 'string') {
    res.status(400).send('Missing or invalid url parameter');
    return;
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    res.status(400).send('Invalid url parameter');
    return;
  }

  if (!isAllowedHost(target.hostname)) {
    res.status(400).send('Host not allowed');
    return;
  }

  let upstream: globalThis.Response;
  try {
    upstream = await fetchFollowingValidatedRedirects(target);
  } catch {
    res.status(502).send('Upstream fetch failed');
    return;
  }

  if (!upstream.ok) {
    res.status(502).send('Upstream returned an error');
    return;
  }

  const contentType = upstream.headers.get('content-type')?.split(';')[0].trim();
  if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
    res.status(502).send('Upstream returned an unexpected content type');
    return;
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  res
    .status(200)
    .header('Content-Type', contentType)
    .header('Cache-Control', `public, max-age=${CACHE_MAX_AGE_SECONDS}`)
    .header('Content-Disposition', 'inline; filename="image"')
    .header('X-Content-Type-Options', 'nosniff')
    .header('Content-Security-Policy', "default-src 'none'; sandbox")
    .send(body);
}

export const imageProxyRouter = Router();
imageProxyRouter.get('/image-proxy', imageProxyHandler);
