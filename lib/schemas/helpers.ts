import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";

type ParseBodySuccess<T> = { success: true; data: T };
type ParseBodyFailure = { success: false; response: NextResponse };
type ParseBodyResult<T> = ParseBodySuccess<T> | ParseBodyFailure;

/**
 * Parse request JSON and validate against a Zod schema in one step.
 * Returns typed data on success, or a pre-formed 400 NextResponse on failure.
 *
 * Error format matches existing convention: `{ error: "Human-readable message" }`
 */
export async function parseBody<T>(
  req: NextRequest,
  schema: ZodType<T>,
): Promise<ParseBodyResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json({ error: "Invalid request body" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    const firstMessage = result.error.issues[0]?.message ?? "Validation failed";
    return {
      success: false,
      response: NextResponse.json({ error: firstMessage }, { status: 400 }),
    };
  }

  return { success: true, data: result.data };
}
