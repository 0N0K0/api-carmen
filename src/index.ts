import express from 'express';
import { createYoga } from 'graphql-yoga';
import { schema } from './graphql/schema';

const app = express();

const yoga = createYoga({ schema });

app.use('/graphql', yoga);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/graphql`);
});
