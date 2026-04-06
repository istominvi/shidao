import { NextRequest } from "next/server";

type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  resetAt: number;
  count: number;
};

const buckets = new Map<string, Bucket>();

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

export function hitRateLimit(req: NextRequest, config: RateLimitConfig) {
  const now = Date.now();
  const key = `${config.key}:${getClientIp(req)}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (existing.count >= config.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { limited: true, retryAfterSeconds };
  }

  existing.count += 1;
  return { limited: false, retryAfterSeconds: 0 };
}
