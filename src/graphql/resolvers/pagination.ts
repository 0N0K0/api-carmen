const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Parse un ID GraphQL (string) en identifiant numérique DB.
 * @param {string} id Identifiant GraphQL brut.
 * @returns {number | null} Identifiant numérique, ou null si non exploitable en DB.
 */
export function parseDbId(id: string): number | null {
  if (id.trim() === '') return null;
  const n = Number(id);
  return Number.isNaN(n) ? null : n;
}

/**
 * Normalise limit/offset : limit borné entre 1 et 100, offset jamais négatif.
 * @param {{ limit?: number; offset?: number }} args Arguments de pagination bruts.
 * @returns {{ limit: number; offset: number }} Pagination normalisée.
 */
function normalizePagination(args: { limit?: number; offset?: number }) {
  const limit = Math.min(MAX_LIMIT, Math.max(1, args.limit ?? DEFAULT_LIMIT));
  const offset = Math.max(0, args.offset ?? 0);
  return { limit, offset };
}

/**
 * Exécute une liste paginée et son compte total en parallèle, et formate le résultat GraphQL.
 * @param {{ limit?: number; offset?: number }} args Arguments de pagination bruts.
 * @param {(limit: number, offset: number) => Promise<T[]>} findMany Requête Prisma paginée.
 * @param {() => Promise<number>} count Requête Prisma de comptage total.
 * @returns {Promise<{ items: T[]; pagination: { offset: number; limit: number; total: number } }>} Page GraphQL.
 */
export async function paginate<T>(
  args: { limit?: number; offset?: number },
  findMany: (limit: number, offset: number) => Promise<T[]>,
  count: () => Promise<number>,
) {
  const { limit, offset } = normalizePagination(args);
  const [items, total] = await Promise.all([findMany(limit, offset), count()]);
  return { items, pagination: { offset, limit, total } };
}
