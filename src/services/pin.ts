import { getPrismaClient } from '../plugins/prisma';

export type PinnableType = 'PLAYLIST' | 'ALBUM' | 'ARTIST';

/**
 * Calcule le prochain rang dans l'ordre manuel unifié des pins (tous types confondus).
 * @returns {Promise<number>} Rang à assigner au prochain élément épinglé.
 */
async function nextPinnedOrder(): Promise<number> {
  const prisma = getPrismaClient();
  const [playlistMax, albumMax, artistMax] = await Promise.all([
    prisma.playlist.aggregate({ _max: { pinnedOrder: true } }),
    prisma.album.aggregate({ _max: { pinnedOrder: true } }),
    prisma.artist.aggregate({ _max: { pinnedOrder: true } }),
  ]);
  const max = Math.max(
    playlistMax._max.pinnedOrder ?? -1,
    albumMax._max.pinnedOrder ?? -1,
    artistMax._max.pinnedOrder ?? -1,
  );
  return max + 1;
}

/**
 * Épingle une playlist (fonctionnalité locale Carmen, indépendante de Deezer) — prend
 * le dernier rang de l'ordre manuel unifié.
 * @param {number | bigint} id Id DB de la playlist.
 * @returns {Promise<object>} Playlist mise à jour.
 */
export async function pinPlaylist(id: number | bigint) {
  const pinnedOrder = await nextPinnedOrder();
  return getPrismaClient().playlist.update({ where: { id }, data: { isPinned: true, pinnedOrder } });
}

/**
 * Désépingle une playlist et la retire de l'ordre manuel.
 * @param {number | bigint} id Id DB de la playlist.
 * @returns {Promise<object>} Playlist mise à jour.
 */
export async function unpinPlaylist(id: number | bigint) {
  return getPrismaClient().playlist.update({ where: { id }, data: { isPinned: false, pinnedOrder: null } });
}

/**
 * Épingle un album — prend le dernier rang de l'ordre manuel unifié.
 * @param {number} id Id DB de l'album.
 * @returns {Promise<object>} Album mis à jour.
 */
export async function pinAlbum(id: number) {
  const pinnedOrder = await nextPinnedOrder();
  return getPrismaClient().album.update({ where: { id }, data: { isPinned: true, pinnedOrder } });
}

/**
 * Désépingle un album et le retire de l'ordre manuel.
 * @param {number} id Id DB de l'album.
 * @returns {Promise<object>} Album mis à jour.
 */
export async function unpinAlbum(id: number) {
  return getPrismaClient().album.update({ where: { id }, data: { isPinned: false, pinnedOrder: null } });
}

/**
 * Épingle un artiste — prend le dernier rang de l'ordre manuel unifié.
 * @param {number} id Id DB de l'artiste.
 * @returns {Promise<object>} Artiste mis à jour.
 */
export async function pinArtist(id: number) {
  const pinnedOrder = await nextPinnedOrder();
  return getPrismaClient().artist.update({ where: { id }, data: { isPinned: true, pinnedOrder } });
}

/**
 * Désépingle un artiste et le retire de l'ordre manuel.
 * @param {number} id Id DB de l'artiste.
 * @returns {Promise<object>} Artiste mis à jour.
 */
export async function unpinArtist(id: number) {
  return getPrismaClient().artist.update({ where: { id }, data: { isPinned: false, pinnedOrder: null } });
}

/**
 * Récupère tous les éléments épinglés (playlists, albums, artistes), triés par
 * `pinnedOrder` croissant, tous types mélangés. Chaque objet est tagué `__typename`
 * pour permettre à graphql-js de résoudre le type concret de l'union `PinnedItem`
 * sans resolver dédié.
 * @returns {Promise<object[]>} Éléments épinglés, dans l'ordre manuel.
 */
export async function getPinnedItems() {
  const prisma = getPrismaClient();
  const [playlists, albums, artists] = await Promise.all([
    prisma.playlist.findMany({ where: { isPinned: true } }),
    prisma.album.findMany({ where: { isPinned: true } }),
    prisma.artist.findMany({ where: { isPinned: true } }),
  ]);
  const tagged = [
    ...playlists.map((p) => ({ ...p, __typename: 'Playlist' as const })),
    ...albums.map((a) => ({ ...a, __typename: 'Album' as const })),
    ...artists.map((a) => ({ ...a, __typename: 'Artist' as const })),
  ];
  tagged.sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0));
  return tagged;
}

/**
 * Réordonne manuellement les éléments épinglés : le client envoie la liste complète
 * dans l'ordre voulu (tous types mélangés), on assigne `pinnedOrder` séquentiellement
 * (0, 1, 2...) selon cet ordre. Un élément absent de la liste précédente est aussi
 * marqué `isPinned: true` (épingler via un reorder est accepté).
 * @param {{ type: PinnableType; id: number }[]} items Éléments dans l'ordre voulu.
 * @returns {Promise<object[]>} Éléments épinglés, dans le nouvel ordre.
 */
export async function reorderPinnedItems(items: { type: PinnableType; id: number }[]) {
  const prisma = getPrismaClient();
  await Promise.all(
    items.map((item, index) => {
      const data = { isPinned: true, pinnedOrder: index };
      if (item.type === 'PLAYLIST') return prisma.playlist.update({ where: { id: item.id }, data });
      if (item.type === 'ALBUM') return prisma.album.update({ where: { id: item.id }, data });
      return prisma.artist.update({ where: { id: item.id }, data });
    }),
  );
  return getPinnedItems();
}
