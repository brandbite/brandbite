// -----------------------------------------------------------------------------
// @file: lib/prisma.ts
// @purpose: Shared Prisma client instance for Brandbite app
// @version: v1.0.1
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Avoid creating multiple instances in dev with HMR
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
