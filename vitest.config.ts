import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Unit tests: fast, jsdom, mocked Prisma. The integration suite in
// tests/integration lives under vitest.integration.config.ts and runs
// against a real Postgres.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    pool: "threads",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    css: false,
    exclude: ["**/node_modules/**", "**/.next/**", "tests/integration/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
