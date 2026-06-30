import test from "node:test";
import assert from "node:assert/strict";
import { isCrossOriginRequest, isUnsafeMethod } from "../csrf";

const base = {
  host: "app.example.com",
  forwardedHost: "app.example.com",
  configuredSiteUrl: "https://app.example.com",
};

test("safe methods are never treated as cross-origin", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(
      isCrossOriginRequest({
        ...base,
        method,
        origin: "https://evil.example.net",
        secFetchSite: "cross-site",
      }),
      false,
    );
  }
});

test("isUnsafeMethod flags mutating verbs", () => {
  assert.equal(isUnsafeMethod("post"), true);
  assert.equal(isUnsafeMethod("DELETE"), true);
  assert.equal(isUnsafeMethod("get"), false);
});

test("same-origin POST is allowed", () => {
  assert.equal(
    isCrossOriginRequest({
      ...base,
      method: "POST",
      origin: "https://app.example.com",
      secFetchSite: "same-origin",
    }),
    false,
  );
});

test("cross-origin POST (mismatched Origin) is rejected", () => {
  assert.equal(
    isCrossOriginRequest({
      ...base,
      method: "POST",
      origin: "https://evil.example.net",
      secFetchSite: "cross-site",
    }),
    true,
  );
});

test("malformed Origin is rejected", () => {
  assert.equal(
    isCrossOriginRequest({
      ...base,
      method: "POST",
      origin: "not-a-url",
      secFetchSite: null,
    }),
    true,
  );
});

test("Origin matched against X-Forwarded-Host behind a proxy", () => {
  assert.equal(
    isCrossOriginRequest({
      method: "POST",
      origin: "https://shidao.ru",
      secFetchSite: null,
      host: "internal-app:3000",
      forwardedHost: "shidao.ru",
      configuredSiteUrl: null,
    }),
    false,
  );
});

test("Origin port must match (different port is cross-origin)", () => {
  assert.equal(
    isCrossOriginRequest({
      method: "POST",
      origin: "http://localhost:1234",
      secFetchSite: null,
      host: "localhost:49892",
      forwardedHost: null,
      configuredSiteUrl: "http://localhost:49892",
    }),
    true,
  );
});

test("no Origin: Sec-Fetch-Site cross-site is rejected", () => {
  assert.equal(
    isCrossOriginRequest({
      ...base,
      method: "POST",
      origin: null,
      secFetchSite: "cross-site",
    }),
    true,
  );
});

test("no Origin: Sec-Fetch-Site same-origin is allowed", () => {
  assert.equal(
    isCrossOriginRequest({
      ...base,
      method: "POST",
      origin: null,
      secFetchSite: "same-origin",
    }),
    false,
  );
});

test("no Origin and no Sec-Fetch-Site: allowed (SameSite cookie is backstop)", () => {
  assert.equal(
    isCrossOriginRequest({
      ...base,
      method: "POST",
      origin: null,
      secFetchSite: null,
    }),
    false,
  );
});
