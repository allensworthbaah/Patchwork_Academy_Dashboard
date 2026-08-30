import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema.js";

const yoga = createYoga({
  schema,
  cors: {
    origin: process.env.WEB_ORIGIN || "http://localhost:5173",
    credentials: true,
  },
  graphqlEndpoint: "/graphql",
});

const server = createServer(yoga);
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`AllensworthOS Academy GraphQL API running on http://localhost:${PORT}/graphql`);
});
