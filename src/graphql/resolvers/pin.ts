import {
  getPinnedItems,
  pinAlbum,
  pinArtist,
  pinPlaylist,
  reorderPinnedItems,
  unpinAlbum,
  unpinArtist,
  unpinPlaylist,
  type PinnableType,
} from '../../services/pin';
import { parseDbId } from './pagination';

/**
 * Convertit l'id GraphQL en id DB, ou lève une erreur explicite si non exploitable.
 * @param {string} id Id GraphQL brut.
 * @returns {number} Id DB numérique.
 * @throws {Error} Si l'id n'est pas un nombre valide.
 */
function requireDbId(id: string): number {
  const dbId = parseDbId(id);
  if (dbId === null) throw new Error(`Invalid id: ${id}`);
  return dbId;
}

export const pinResolvers = {
  Query: {
    /**
     * Liste tous les éléments épinglés (playlists, albums, artistes), tous types
     * mélangés, dans l'ordre manuel unifié (`pinnedOrder`).
     * @returns {Promise<object[]>} Éléments épinglés.
     */
    pinnedItems: async () => getPinnedItems(),
  },

  PinnedItem: {
    /**
     * Résout le type concret d'un élément épinglé pour l'union `PinnedItem`.
     * @param {{ __typename: string }} obj Élément épinglé, tagué par `getPinnedItems`/`reorderPinnedItems`.
     * @returns {string} Nom du type GraphQL concret (`Playlist`, `Album` ou `Artist`).
     */
    __resolveType: (obj: { __typename: string }) => obj.__typename,
  },

  Mutation: {
    /**
     * Réordonne manuellement les éléments épinglés (tous types mélangés).
     * @param {unknown} _ Non utilisé.
     * @param {{ items: { type: PinnableType; id: string }[] }} args Ordre voulu.
     * @returns {Promise<object[]>} Éléments épinglés, dans le nouvel ordre.
     */
    reorderPinnedItems: async (_: unknown, args: { items: { type: PinnableType; id: string }[] }) =>
      reorderPinnedItems(args.items.map((item) => ({ type: item.type, id: requireDbId(item.id) }))),

    /**
     * Épingle une playlist. @param {unknown} _ Non utilisé. @param {{ id: string }} args Id GraphQL.
     * @returns {Promise<object>} Playlist mise à jour.
     */
    pinPlaylist: async (_: unknown, args: { id: string }) => pinPlaylist(requireDbId(args.id)),

    /**
     * Désépingle une playlist. @param {unknown} _ Non utilisé. @param {{ id: string }} args Id GraphQL.
     * @returns {Promise<object>} Playlist mise à jour.
     */
    unpinPlaylist: async (_: unknown, args: { id: string }) => unpinPlaylist(requireDbId(args.id)),

    /**
     * Épingle un album. @param {unknown} _ Non utilisé. @param {{ id: string }} args Id GraphQL.
     * @returns {Promise<object>} Album mis à jour.
     */
    pinAlbum: async (_: unknown, args: { id: string }) => pinAlbum(requireDbId(args.id)),

    /**
     * Désépingle un album. @param {unknown} _ Non utilisé. @param {{ id: string }} args Id GraphQL.
     * @returns {Promise<object>} Album mis à jour.
     */
    unpinAlbum: async (_: unknown, args: { id: string }) => unpinAlbum(requireDbId(args.id)),

    /**
     * Épingle un artiste. @param {unknown} _ Non utilisé. @param {{ id: string }} args Id GraphQL.
     * @returns {Promise<object>} Artiste mis à jour.
     */
    pinArtist: async (_: unknown, args: { id: string }) => pinArtist(requireDbId(args.id)),

    /**
     * Désépingle un artiste. @param {unknown} _ Non utilisé. @param {{ id: string }} args Id GraphQL.
     * @returns {Promise<object>} Artiste mis à jour.
     */
    unpinArtist: async (_: unknown, args: { id: string }) => unpinArtist(requireDbId(args.id)),
  },
};
