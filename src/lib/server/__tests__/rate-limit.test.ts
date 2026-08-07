import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { hitRateLimit } from "../rate-limit";

function makeRequest(ip: string) {
  return new NextRequest("http://localhost/api/test", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

function makeForwardedRequest(headers: Record<string, string>) {
  return new NextRequest("http://localhost/api/test", { headers });
}

test("rate limit blocks requests after threshold", () => {
  const config = {
    key: `test-rate-${Date.now()}`,
    limit: 2,
    windowMs: 10_000,
  };

  const req = makeRequest("203.0.113.10");
  assert.equal(hitRateLimit(req, config).limited, false);
  assert.equal(hitRateLimit(req, config).limited, false);

  const blocked = hitRateLimit(req, config);
  assert.equal(blocked.limited, true);
  assert.equal(blocked.retryAfterSeconds > 0, true);
});

test("rate limit isolated by IP", () => {
  const config = {
    key: `test-ip-${Date.now()}`,
    limit: 1,
    windowMs: 10_000,
  };

  assert.equal(
    hitRateLimit(makeRequest("198.51.100.1"), config).limited,
    false,
  );
  assert.equal(
    hitRateLimit(makeRequest("198.51.100.2"), config).limited,
    false,
  );
});

test("rate limit ignores a forged left XFF prefix and prefers proxy real IP", () => {
  const config = {
    key: `test-forwarded-${Date.now()}`,
    limit: 1,
    windowMs: 10_000,
  };

  assert.equal(
    hitRateLimit(
      makeForwardedRequest({
        "x-forwarded-for": "198.51.100.99, 203.0.113.8",
        "x-real-ip": "203.0.113.8",
      }),
      config,
    ).limited,
    false,
  );
  assert.equal(
    hitRateLimit(
      makeForwardedRequest({
        "x-forwarded-for": "198.51.100.100, 203.0.113.8",
        "x-real-ip": "203.0.113.8",
      }),
      config,
    ).limited,
    true,
  );
});

test("invalid forwarded identifiers share the fail-closed unknown bucket", () => {
  const config = {
    key: `test-invalid-forwarded-${Date.now()}`,
    limit: 1,
    windowMs: 10_000,
  };
  assert.equal(
    hitRateLimit(makeRequest("attacker-controlled-value-1"), config).limited,
    false,
  );
  assert.equal(
    hitRateLimit(makeRequest("attacker-controlled-value-2"), config).limited,
    true,
  );
});
