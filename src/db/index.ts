import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required");
}

// `prepare: false` is the safe default for serverless/Neon; flip it on for
// long-lived servers if you want statement-cache wins.
const client = postgres(url, { prepare: false });

export const db = drizzle(client, { schema });
