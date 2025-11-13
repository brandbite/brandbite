// -----------------------------------------------------------------------------
// @file: lib/prisma.ts
// @purpose: Shared Prisma Client instance for Brandbite application
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

// Next.js hot reload sırasında birden fazla PrismaClient oluşturmamak için
// globalThis hack'i kullanıyoruz.
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

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}