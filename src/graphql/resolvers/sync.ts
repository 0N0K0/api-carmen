import {
  syncAlbum,
  syncArtist,
  syncFavoriteAlbums,
  syncFavoriteArtists,
  syncFavoriteTracks,
  syncPlaylist,
  syncPlaylists,
} from '../../services/sync';
import { mapPrismaAlbum, mapPrismaArtist, mapPrismaPlaylist, mapPrismaTrack } from './mappers';

export const syncResolvers = {
  Mutation: {
    /**
     * Synchronise une playlist Deezer dans la base de données. Par défaut, si le `checksum`
     * Deezer n'a pas changé depuis la dernière synchro, les tracks ne sont pas retouchés
     * (cf. `syncPlaylist` service) — `force: true` ignore ce raccourci.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ deezerId: string; force?: boolean }} args Arguments de la mutation.
     * @returns {Promise<object>} Playlist mappée au format GraphQL.
     */
    syncPlaylist: async (_: unknown, args: { deezerId: string; force?: boolean }) => {
      const playlist = await syncPlaylist(args.deezerId, { force: args.force });
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

    /**
     * Synchronise les tracks favoris Deezer de l'utilisateur dans la base de données.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number }} args Arguments de la mutation.
     * @returns {Promise<object[]>} Tracks favoris mappés au format GraphQL.
     */
    syncFavoriteTracks: async (_: unknown, args: { limit?: number }) => {
      const tracks = await syncFavoriteTracks(args.limit);
      return tracks.map(mapPrismaTrack);
    },

    /**
     * Synchronise tous les albums favoris de l'utilisateur Deezer dans la base de données.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number }} args Arguments de la mutation.
     * @returns {Promise<object>} Résumé de synchro (nombre synchronisé, erreurs).
     */
    syncFavoriteAlbums: async (_: unknown, args: { limit?: number }) => {
      return syncFavoriteAlbums(args.limit);
    },

    /**
     * Synchronise tous les artistes favoris de l'utilisateur Deezer dans la base de données.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number }} args Arguments de la mutation.
     * @returns {Promise<object>} Résumé de synchro (nombre synchronisé, erreurs).
     */
    syncFavoriteArtists: async (_: unknown, args: { limit?: number }) => {
      return syncFavoriteArtists(args.limit);
    },

    /**
     * Synchronise toutes les playlists possédées par l'utilisateur Deezer (pas seulement
     * mises en favori) dans la base de données.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number }} args Arguments de la mutation.
     * @returns {Promise<object>} Résumé de synchro (nombre synchronisé/supprimé, erreurs).
     */
    syncPlaylists: async (_: unknown, args: { limit?: number }) => {
      return syncPlaylists(args.limit);
    },
  },
};
