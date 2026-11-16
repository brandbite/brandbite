// -----------------------------------------------------------------------------
// @file: lib/ai/unavailable-response.ts
// @purpose: The answer an AI route gives when its provider has no key yet.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { AI_TOOL_UNAVAILABLE } from "./provider-router";

export function aiToolUnavailableResponse() {
  return NextResponse.json(AI_TOOL_UNAVAILABLE.body, { status: AI_TOOL_UNAVAILABLE.status });
}
