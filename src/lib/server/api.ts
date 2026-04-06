import { NextRequest, NextResponse } from "next/server";
import type { Parser } from "@/lib/server/validation";

export function apiError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function parseJsonWithSchema<T>(
  req: NextRequest,
  schema: Parser<T>,
  fallbackMessage: string,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return { ok: false, response: apiError(400, fallbackMessage) };
  }

  const result = schema(payload);
  if (!result.success) {
    return { ok: false, response: apiError(400, result.message) };
  }

  return { ok: true, data: result.data };
}
