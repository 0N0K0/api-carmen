import { getAlbum } from '../../services/deezer';
import { getPrismaClient } from '../../plugins/prisma';
import { mapAlbum } from './mappers';
import { paginate, parseDbId, sortDirection } from './pagination';
import { loadArtistById, loadContributorsByAlbumId, loadGenresByAlbumId, loadTracksByAlbumId } from './loaders';

export { mapAlbum };

type AlbumParent = {
  id: number | string;
  artistId?: number;
  artist?: unknown;
  tracks?: unknown;
  genres?: unknown;
  contributors?: unknown;
};

export const albumResolvers = {
  Query: {
    /**
     * Récupère un album : d'abord en DB, sinon fallback sur l'API Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ id: string }} args Arguments de la query.
     * @returns {Promise<object | null>} Album (ligne Prisma brute ou album Deezer mappé), ou null si non trouvé.
     */
    album: async (_: unknown, args: { id: string }) => {
      try {
        const dbId = parseDbId(args.id);
        if (dbId !== null) {
          const row = await getPrismaClient().album.findUnique({ where: { id: dbId } });
          if (row) return row;
        }
        const a = await getAlbum(args.id);
        return mapAlbum(a);
      } catch (err) {
        console.error('[resolver] album error:', err);
        return null;
      }
    },

    /**
     * Liste les albums synchronisés en DB, paginés, triés par titre.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number; offset?: number; favoritesOnly?: boolean; pinnedOnly?: boolean; orderBy?: 'ASC' | 'DESC' }} args Arguments de pagination, filtre et tri.
     * @returns {Promise<object>} Page d'albums avec pagination.
     */
    albums: async (
      _: unknown,
      args: { limit?: number; offset?: number; favoritesOnly?: boolean; pinnedOnly?: boolean; orderBy?: 'ASC' | 'DESC' },
    ) => {
      const prisma = getPrismaClient();
      const where = {
        ...(args.favoritesOnly ? { isFavorite: true } : {}),
        ...(args.pinnedOnly ? { isPinned: true } : {}),
      };
      const direction = sortDirection(args.orderBy);
      return paginate(
        args,
        (limit, offset) =>
          prisma.album.findMany({ where, skip: offset, take: limit, orderBy: { title: direction } }),
        () => prisma.album.count({ where }),
      );
    },
  },

  Album: {
    /**
     * Résout l'artiste d'un album : déjà présent (résultat Deezer, y compris null si l'album
     * Deezer n'en a pas) sinon chargé depuis Prisma par `artistId` (toujours renseigné en DB),
     * quelle que soit la profondeur de la requête GraphQL.
     * @param {AlbumParent} parent Album parent (ligne Prisma ou album Deezer mappé).
     * @returns {Promise<unknown>} Artiste.
     */
    artist: async (parent: AlbumParent) => {
      if ('artist' in parent) return parent.artist;
      return loadArtistById(parent.artistId as number);
    },

    /**
     * Résout les tracks d'un album : déjà présents (résultat Deezer) sinon chargés depuis Prisma
     * par `albumId`, quelle que soit la profondeur de la requête GraphQL.
     * @param {AlbumParent} parent Album parent (ligne Prisma ou album Deezer mappé).
     * @returns {Promise<unknown>} Tracks de l'album.
     */
    tracks: async (parent: AlbumParent) => {
      if ('tracks' in parent) return parent.tracks;
      return loadTracksByAlbumId(Number(parent.id));
    },

    /**
     * Résout les genres d'un album : déjà présents (résultat Deezer) sinon chargés depuis
     * Prisma via la table de jonction `AlbumGenre`, quelle que soit la profondeur de la requête.
     * @param {AlbumParent} parent Album parent (ligne Prisma ou album Deezer mappé).
     * @returns {Promise<unknown>} Genres de l'album.
     */
    genres: async (parent: AlbumParent) => {
      if ('genres' in parent) return parent.genres;
      const rows = await loadGenresByAlbumId(Number(parent.id));
      return rows.map((r) => r.genre);
    },

    /**
     * Résout les contributeurs (artistes) d'un album : déjà présents (résultat Deezer) sinon
     * chargés depuis Prisma via la table de jonction `AlbumContributor`.
     * @param {AlbumParent} parent Album parent (ligne Prisma ou album Deezer mappé).
     * @returns {Promise<unknown>} Contributeurs de l'album.
     */
    contributors: async (parent: AlbumParent) => {
      if ('contributors' in parent) return parent.contributors;
      const rows = await loadContributorsByAlbumId(Number(parent.id));
      return rows.map((r) => r.artist);
    },
  },
};
