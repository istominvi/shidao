import { isIP } from "node:net";
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
const MAX_BUCKETS = 10_000;

function normalizeIp(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 64) return null;
  if (isIP(candidate)) return candidate.toLowerCase();

  const bracketed = /^\[([^\]]+)](?::\d{1,5})?$/.exec(candidate);
  if (bracketed?.[1] && isIP(bracketed[1])) {
    return bracketed[1].toLowerCase();
  }

  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(candidate);
  return ipv4WithPort?.[1] && isIP(ipv4WithPort[1]) ? ipv4WithPort[1] : null;
}

function getClientIp(req: NextRequest) {
  const realIp = normalizeIp(req.headers.get("x-real-ip"));
  if (realIp) return realIp;

  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",");
  if (!forwardedFor) return "unknown";
  for (let index = forwardedFor.length - 1; index >= 0; index -= 1) {
    const ip = normalizeIp(forwardedFor[index]);
    if (ip) return ip;
  }
  return "unknown";
}

function bucketKey(scope: string, clientIp: string, now: number) {
  const desired = `${scope}:${clientIp}`;
  if (buckets.has(desired)) return desired;
  if (buckets.size < MAX_BUCKETS) return desired;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  return buckets.size < MAX_BUCKETS ? desired : `${scope}:overflow`;
}

export function hitRateLimit(req: NextRequest, config: RateLimitConfig) {
  const now = Date.now();
  const key = bucketKey(config.key, getClientIp(req), now);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (existing.count >= config.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000),
    );
    return { limited: true, retryAfterSeconds };
  }

  existing.count += 1;
  return { limited: false, retryAfterSeconds: 0 };
}
