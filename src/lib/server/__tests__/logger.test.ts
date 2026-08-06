import test from "node:test";
import assert from "node:assert/strict";
import { logger } from "../logger";

test("logger redacts provider API keys and credential headers recursively", () => {
  const originalInfo = console.info;
  let emitted = "";

  console.info = (value?: unknown) => {
    emitted = String(value ?? "");
  };

  try {
    logger.info("provider request", {
      apiKey: "fake-api-key-value",
      api_key: "fake-snake-key-value",
      ROUTERAI_API_KEY: "fake-router-key-value",
      headers: {
        Authorization: "Bearer fake-provider-token",
        Cookie: "session=fake-session-cookie",
        "X-Request-Id": "safe-request-id",
      },
      nested: {
        accessToken: "fake-access-token",
      },
      provider: "routerai",
    });
  } finally {
    console.info = originalInfo;
  }

  const payload = JSON.parse(emitted) as {
    meta: {
      apiKey: string;
      api_key: string;
      ROUTERAI_API_KEY: string;
      headers: Record<string, string>;
      nested: { accessToken: string };
      provider: string;
    };
  };

  assert.equal(payload.meta.apiKey, "[redacted]");
  assert.equal(payload.meta.api_key, "[redacted]");
  assert.equal(payload.meta.ROUTERAI_API_KEY, "[redacted]");
  assert.equal(payload.meta.headers.Authorization, "[redacted]");
  assert.equal(payload.meta.headers.Cookie, "[redacted]");
  assert.equal(payload.meta.nested.accessToken, "[redacted]");
  assert.equal(payload.meta.headers["X-Request-Id"], "safe-request-id");
  assert.equal(payload.meta.provider, "routerai");

  for (const forbidden of [
    "fake-api-key-value",
    "fake-snake-key-value",
    "fake-router-key-value",
    "fake-provider-token",
    "fake-session-cookie",
    "fake-access-token",
  ]) {
    assert.doesNotMatch(emitted, new RegExp(forbidden));
  }
});
