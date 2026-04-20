// -----------------------------------------------------------------------------
// @file: lib/errors/insufficient-tokens.ts
// @purpose: Shared shape + helper for "company can't afford this action"
//           responses. All server routes that debit company tokens should
//           emit the same 402 body so the client can recognise it and surface
//           the "buy more tokens" UX consistently.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

export const INSUFFICIENT_TOKENS_CODE = "INSUFFICIENT_TOKENS";
export const INSUFFICIENT_TOKENS_STATUS = 402;

export type InsufficientTokensBody = {
  error: string;
  code: typeof INSUFFICIENT_TOKENS_CODE;
  required: number;
  balance: number;
  shortBy: number;
  /** Short label the UI can render: "consultation booking", "ticket", "AI image" ... */
  action?: string;
};

/** Build the plain JSON body for an "insufficient tokens" response. Used by
 *  routes that need the raw shape (e.g. SSE routes that can't return a
 *  NextResponse directly).
 */
export function insufficientTokensBody(args: {
  required: number;
  balance: number;
  action?: string;
}): InsufficientTokensBody {
  const shortBy = Math.max(0, args.required - args.balance);
  return {
    error: "Insufficient token balance",
    code: INSUFFICIENT_TOKENS_CODE,
    required: args.required,
    balance: args.balance,
    shortBy,
    action: args.action,
  };
}

/** Build a normalised 402 response for "company can't afford this action". */
export function insufficientTokensResponse(args: {
  required: number;
  balance: number;
  action?: string;
}): NextResponse {
  return NextResponse.json(insufficientTokensBody(args), { status: INSUFFICIENT_TOKENS_STATUS });
}

/** Client-side type guard — true when a JSON error response is an
 *  insufficient-tokens signal (status 402 + our known code). */
export function isInsufficientTokensBody(body: unknown): body is InsufficientTokensBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    b.code === INSUFFICIENT_TOKENS_CODE &&
    typeof b.required === "number" &&
    typeof b.balance === "number"
  );
}
