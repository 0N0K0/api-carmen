# api-carmen.onoko.dev

Backend GraphQL de Carmen, une surcouche Deezer avec intégration freqblog.

## Stack

- **Runtime** : Node.js + TypeScript
- **Framework** : Express
- **API** : GraphQL Yoga
- **ORM** : Prisma 7 + PostgreSQL
- **Cache** : Redis
- **Tests** : Vitest
- **Infra** : Docker Compose (PostgreSQL + Redis)

## Commandes

```bash
npm run dev          # démarre le serveur en watch mode
npm run build        # compile TypeScript
npm run start        # démarre le build compilé
npm run test         # lance les tests Vitest

docker compose up -d      # démarre PostgreSQL + Redis
docker compose down       # arrête les containers

npx prisma migrate dev --config prisma.config.ts --name <nom>   # nouvelle migration
npx prisma studio --config prisma.config.ts                     # interface BDD
npx prisma generate --config prisma.config.ts                   # régénère le client
```

## Structure

```text
src/
├── graphql/
│   ├── schema/       # définition du schéma GraphQL (typeDefs + resolvers assemblés)
│   └── resolvers/    # resolvers par domaine (track, playlist, folder, history...)
├── services/         # logique métier (deezer, freqblog, cache redis...)
├── plugins/          # plugins Express (prisma, redis, cors...)
├── types/            # types TypeScript partagés
└── index.ts          # point d'entrée
prisma/
├── schema.prisma     # modèles de données
└── migrations/       # historique des migrations
prisma.config.ts      # config Prisma 7 (datasource, migrations)
docker-compose.yml
.env                  # non versionné
```

## Variables d'environnement

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carmen
REDIS_URL=redis://localhost:6379
PORT=4000
DEEZER_ARL=        # cookie ARL du compte Deezer (auth non officielle)
FREQBLOG_API_KEY=  # clé API freqblog
```

## Architecture GraphQL

- Le schéma est assemblé dans `src/graphql/schema/index.ts`
- Les resolvers sont organisés par domaine dans `src/graphql/resolvers/`
- La logique métier est dans `src/services/`, jamais dans les resolvers
- Les resolvers appellent les services, pas l'API Deezer directement

## Prisma

- Prisma 7 — la config datasource est dans `prisma.config.ts`, pas dans `schema.prisma`
- Toujours passer `--config prisma.config.ts` aux commandes Prisma CLI

## API Deezer

- API publique : `https://api.deezer.com` (sans auth, quota 50 req/5s)
- Auth personnelle : ARL token via cookie de session (variable `DEEZER_ARL`)
- Les appels Deezer passent tous par `src/services/deezer.ts`

## freqblog

- Base URL : `https://api.freqblog.com/v1`
- Auth : header `X-Api-Key`
- Lookup par ISRC : `GET /audio-features/{isrc}`
- Batch : `GET /audio-features?ids=isrc1,isrc2,...` (max 100)
- Les appels freqblog passent tous par `src/services/freqblog.ts`

## Tests

- Framework : Vitest
- Les fichiers de test sont colocalisés avec le code source : `src/services/deezer.test.ts`
- Tester les services en priorité, mocker les appels externes (Deezer, freqblog)
