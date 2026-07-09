type Waiter<V> = { resolve: (v: V) => void; reject: (e: unknown) => void };

/**
 * Ré-essaie clé par clé après l'échec d'un batch, pour qu'une seule clé en tort
 * n'entraîne pas le rejet des autres appelants du même tick (requêtes concurrentes
 * non liées incluses, le batcher étant partagé au niveau du module).
 * @param {Map<K, Waiter<R>[]>} batch Batch ayant échoué, clé -> appelants en attente.
 * @param {(key: K) => Promise<R>} resolveOne Résout une seule clé (fallback individuel).
 * @returns {Promise<void>} Résolu une fois tous les appelants notifiés (succès ou échec individuel).
 */
async function retryIndividually<K, R>(batch: Map<K, Waiter<R>[]>, resolveOne: (key: K) => Promise<R>) {
  await Promise.all(
    [...batch].map(async ([key, waiters]) => {
      try {
        const value = await resolveOne(key);
        for (const w of waiters) w.resolve(value);
      } catch (err) {
        for (const w of waiters) w.reject(err);
      }
    }),
  );
}

/**
 * Regroupe les appels concurrents faits dans le même tick en une seule requête,
 * puis répartit le résultat (une valeur par clé) à chaque appelant.
 * @param {(keys: K[]) => Promise<V[]>} fetchMany Requête batch (ex: findMany where id in [...]).
 * @param {(value: V) => K} keyOf Extrait la clé d'un résultat pour le rattacher à sa clé demandée.
 * @returns {(key: K) => Promise<V | null>} Fonction de chargement par clé, transparente pour l'appelant.
 */
export function createBatcher<K, V>(
  fetchMany: (keys: K[]) => Promise<V[]>,
  keyOf: (value: V) => K,
): (key: K) => Promise<V | null> {
  let pending: Map<K, Waiter<V | null>[]> | null = null;

  function flush() {
    const batch = pending as Map<K, Waiter<V | null>[]>;
    pending = null;
    fetchMany([...batch.keys()])
      .then((values) => {
        const byKey = new Map(values.map((v) => [keyOf(v), v]));
        for (const [key, waiters] of batch) {
          const value = byKey.get(key) ?? null;
          for (const w of waiters) w.resolve(value);
        }
      })
      .catch(() =>
        retryIndividually(batch, async (key) => {
          const values = await fetchMany([key]);
          return values.find((v) => keyOf(v) === key) ?? null;
        }),
      );
  }

  return (key: K) =>
    new Promise<V | null>((resolve, reject) => {
      if (!pending) {
        pending = new Map();
        queueMicrotask(flush);
      }
      const waiters = pending.get(key) ?? [];
      waiters.push({ resolve, reject });
      pending.set(key, waiters);
    });
}

/**
 * Comme `createBatcher`, mais pour une relation 1-N : chaque clé peut correspondre
 * à plusieurs résultats (ex: tracks d'un album). L'ordre relatif de `fetchMany` est préservé par groupe.
 * @param {(keys: K[]) => Promise<V[]>} fetchMany Requête batch (ex: findMany where albumId in [...]).
 * @param {(value: V) => K} keyOf Extrait la clé de regroupement d'un résultat.
 * @returns {(key: K) => Promise<V[]>} Fonction de chargement par clé, retourne un tableau (vide si aucun résultat).
 */
export function createGroupBatcher<K, V>(
  fetchMany: (keys: K[]) => Promise<V[]>,
  keyOf: (value: V) => K,
): (key: K) => Promise<V[]> {
  let pending: Map<K, Waiter<V[]>[]> | null = null;

  function flush() {
    const batch = pending as Map<K, Waiter<V[]>[]>;
    pending = null;
    fetchMany([...batch.keys()])
      .then((values) => {
        const byKey = new Map<K, V[]>();
        for (const v of values) {
          const k = keyOf(v);
          const arr = byKey.get(k) ?? [];
          arr.push(v);
          byKey.set(k, arr);
        }
        for (const [key, waiters] of batch) {
          const arr = byKey.get(key) ?? [];
          for (const w of waiters) w.resolve(arr);
        }
      })
      .catch(() =>
        retryIndividually(batch, (key) => fetchMany([key])),
      );
  }

  return (key: K) =>
    new Promise<V[]>((resolve, reject) => {
      if (!pending) {
        pending = new Map();
        queueMicrotask(flush);
      }
      const waiters = pending.get(key) ?? [];
      waiters.push({ resolve, reject });
      pending.set(key, waiters);
    });
}
