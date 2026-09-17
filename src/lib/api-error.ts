import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

/**
 * Every API route wraps its handler body in this so unexpected errors
 * become a generic, safe JSON response — never a leaked stack trace or
 * internal error message — while the full detail still reaches the
 * server logs for debugging.
 */
export function apiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request", details: err.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const status = (err as any)?.status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return NextResponse.json({ error: (err as Error).message }, { status });
  }

  logger.error("api.unhandled_error", {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
