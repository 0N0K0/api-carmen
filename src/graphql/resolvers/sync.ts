import { syncAlbum, syncArtist, syncPlaylist } from '../../services/sync';
import { mapPrismaAlbum, mapPrismaArtist, mapPrismaPlaylist } from './mappers';

export const syncResolvers = {
  Mutation: {
    /**
     * Synchronise une playlist Deezer dans la base de données.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ deezerId: string }} args Arguments de la mutation.
     * @returns {Promise<object>} Playlist mappée au format GraphQL.
     */
    syncPlaylist: async (_: unknown, args: { deezerId: string }) => {
      const playlist = await syncPlaylist(args.deezerId);
      return mapPrismaPlaylist(playlist);
    },

    /**
     * Synchronise un album Deezer dans la base de données.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ deezerId: string }} args Arguments de la mutation.
     * @returns {Promise<object>} Album mappé au format GraphQL.
     */
    syncAlbum: async (_: unknown, args: { deezerId: string }) => {
      const album = await syncAlbum(args.deezerId);
      return mapPrismaAlbum(album);
    },

    /**
     * Synchronise les top tracks d'un artiste Deezer dans la base de données.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ deezerId: string; limit?: number }} args Arguments de la mutation.
     * @returns {Promise<object>} Artiste mappé au format GraphQL.
     */
    syncArtist: async (_: unknown, args: { deezerId: string; limit?: number }) => {
      const artist = await syncArtist(args.deezerId, args.limit);
      return mapPrismaArtist(artist);
    },
  },
};
