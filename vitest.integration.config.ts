import { defineConfig } from "vitest/config";
import path from "path";

// Integration suite — real Postgres, real Prisma client, single-threaded so
// tests do not race on shared state. Requires DATABASE_URL to point at a
// throwaway test database. CI sets this via a Postgres service container.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    // Run one test file at a time so cleanup is predictable
    fileParallelism: false,
    pool: "threads",
    // Integration tests can hit the DB/network, allow more time
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["./tests/integration/setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
