import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../types/src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env["DATABASE_URL"] ??
      "postgresql://postgres:postgres@localhost:5432/template",
  },
  verbose: true,
  strict: true,
});
