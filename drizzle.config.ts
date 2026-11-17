import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: ["./db/schema.ts", "./db/auth-schema.ts"],
  dialect: "sqlite",
});
