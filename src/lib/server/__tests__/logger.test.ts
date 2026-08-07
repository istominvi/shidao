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
        refresh_token: "fake-refresh-token",
      },
      token_hash: "fake-token-hash",
      identityInvitationToken: "fake-invitation-token",
      recipientEmailDigest: "fake-email-digest",
      copyLink: "https://v2.shidao.ru/invite#token=fake-link-token",
      loginAlias: "private-login",
      email: "private@example.test",
      error: new Error("request failed for PIN 4321"),
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
      nested: { accessToken: string; refresh_token: string };
      token_hash: string;
      identityInvitationToken: string;
      recipientEmailDigest: string;
      copyLink: string;
      loginAlias: string;
      email: string;
      error: { name: string; message?: string };
      provider: string;
    };
  };

  assert.equal(payload.meta.apiKey, "[redacted]");
  assert.equal(payload.meta.api_key, "[redacted]");
  assert.equal(payload.meta.ROUTERAI_API_KEY, "[redacted]");
  assert.equal(payload.meta.headers.Authorization, "[redacted]");
  assert.equal(payload.meta.headers.Cookie, "[redacted]");
  assert.equal(payload.meta.nested.accessToken, "[redacted]");
  assert.equal(payload.meta.nested.refresh_token, "[redacted]");
  assert.equal(payload.meta.token_hash, "[redacted]");
  assert.equal(payload.meta.identityInvitationToken, "[redacted]");
  assert.equal(payload.meta.recipientEmailDigest, "[redacted]");
  assert.equal(payload.meta.copyLink, "[redacted]");
  assert.equal(payload.meta.loginAlias, "[redacted]");
  assert.equal(payload.meta.email, "[redacted]");
  assert.deepEqual(payload.meta.error, { name: "Error" });
  assert.equal(payload.meta.headers["X-Request-Id"], "safe-request-id");
  assert.equal(payload.meta.provider, "routerai");

  for (const forbidden of [
    "fake-api-key-value",
    "fake-snake-key-value",
    "fake-router-key-value",
    "fake-provider-token",
    "fake-session-cookie",
    "fake-access-token",
    "fake-refresh-token",
    "fake-token-hash",
    "fake-invitation-token",
    "fake-email-digest",
    "fake-link-token",
    "private-login",
    "private@example.test",
    "4321",
  ]) {
    assert.doesNotMatch(emitted, new RegExp(forbidden));
  }
});
