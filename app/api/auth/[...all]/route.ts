// -----------------------------------------------------------------------------
// @file: app/api/auth/[...all]/route.ts
// @purpose: BetterAuth catch-all API handler for sign-up, sign-in, sign-out,
//           magic link, session, etc. All endpoints live under /api/auth/*
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-22
// -----------------------------------------------------------------------------

import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
