import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// Next.js reads .env.local; mirror that for drizzle-kit so there's one source of truth.
config({ path: ".env.local" });
config({ path: ".env" });

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
} satisfies Config;
