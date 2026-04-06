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

  assert.equal(hitRateLimit(makeRequest("198.51.100.1"), config).limited, false);
  assert.equal(hitRateLimit(makeRequest("198.51.100.2"), config).limited, false);
});
