import test from "node:test";
import assert from "node:assert/strict";
import { isCrossOriginRequest, isUnsafeMethod } from "../csrf";

const base = {
  host: "app.example.com",
  forwardedHost: "app.example.com",
  configuredAppUrl: "https://app.example.com",
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

test("same V2 app origin POST is allowed", () => {
  assert.equal(
    isCrossOriginRequest({
      host: "v2.shidao.ru",
      forwardedHost: "v2.shidao.ru",
      configuredAppUrl: "https://v2.shidao.ru",
      method: "POST",
      origin: "https://v2.shidao.ru",
      secFetchSite: "same-origin",
    }),
    false,
  );
});

test("landing origin is rejected for an unsafe V2 app request", () => {
  assert.equal(
    isCrossOriginRequest({
      host: "v2.shidao.ru",
      forwardedHost: "v2.shidao.ru",
      configuredAppUrl: "https://v2.shidao.ru",
      method: "POST",
      origin: "https://shidao.ru",
      secFetchSite: "same-site",
    }),
    true,
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
      configuredAppUrl: null,
    }),
    false,
  );
});

test("localhost falls back to the request host when app URL is not configured", () => {
  assert.equal(
    isCrossOriginRequest({
      method: "POST",
      origin: "http://localhost:49892",
      secFetchSite: "same-origin",
      host: "localhost:49892",
      forwardedHost: null,
      configuredAppUrl: null,
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
      configuredAppUrl: "http://localhost:49892",
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
