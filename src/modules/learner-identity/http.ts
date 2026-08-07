import { NextRequest, NextResponse } from "next/server";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { LearnerIdentityApplicationError } from "./service";

export function identityMutationRateLimit(
  request: NextRequest,
  key: string,
  limit = 12,
) {
  const rate = hitRateLimit(request, { key, limit, windowMs: 60_000 });
  if (!rate.limited) return null;
  return NextResponse.json(
    {
      error: "Слишком много запросов. Попробуйте немного позже.",
      code: "learner_identity_rate_limited",
    },
    {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    },
  );
}

export function assertAction<T extends string>(
  value: string,
  allowed: readonly T[],
): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new LearnerIdentityApplicationError(
    "Неизвестное действие.",
    "learner_identity_action_invalid",
    404,
  );
}

export function cursorQuery(request: Request) {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  return {
    cursor: url.searchParams.get("cursor"),
    limit: rawLimit === null ? 25 : Number(rawLimit),
  };
}

export async function readIdentityJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new LearnerIdentityApplicationError(
      "Ожидался JSON body.",
      "learner_identity_validation",
      400,
    );
  }
}
