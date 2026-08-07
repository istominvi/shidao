import test from "node:test";
import assert from "node:assert/strict";
import { isCrossOriginRequest, isUnsafeMethod } from "../csrf";

const productionBase = {
  host: "v2.shidao.ru",
  forwardedHost: "v2.shidao.ru",
  configuredAppUrl: "https://v2.shidao.ru",
  requestUrl: "https://v2.shidao.ru/api/v2/test",
  environment: "production",
};

test("safe methods are unaffected by the CSRF guard", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(
      isCrossOriginRequest({
        ...productionBase,
        method,
        origin: "https://evil.example.net",
        secFetchSite: "cross-site",
      }),
      false,
    );
  }
  assert.equal(isUnsafeMethod("post"), true);
  assert.equal(isUnsafeMethod("DELETE"), true);
  assert.equal(isUnsafeMethod("get"), false);
});

test("production accepts only the exact HTTPS V2 origin", () => {
  assert.equal(
    isCrossOriginRequest({
      ...productionBase,
      method: "POST",
      origin: "https://v2.shidao.ru",
      secFetchSite: "same-origin",
    }),
    false,
  );

  for (const origin of [
    "https://shidao.ru",
    "https://www.shidao.ru",
    "https://demo.shidao.ru",
    "https://brand.shidao.ru",
    "https://model.shidao.ru",
    "http://v2.shidao.ru",
    "https://v2.shidao.ru:444",
    "https://evil.example.net",
    "not-a-url",
  ]) {
    assert.equal(
      isCrossOriginRequest({
        ...productionBase,
        method: "POST",
        origin,
        secFetchSite: "same-site",
      }),
      true,
      origin,
    );
  }
});

test("production rejects unsafe requests without Origin", () => {
  for (const secFetchSite of ["same-origin", "same-site", "none", null]) {
    assert.equal(
      isCrossOriginRequest({
        ...productionBase,
        method: "POST",
        origin: null,
        secFetchSite,
      }),
      true,
    );
  }
});

test("production configuration cannot widen the pinned app origin", () => {
  assert.equal(
    isCrossOriginRequest({
      ...productionBase,
      configuredAppUrl: "https://shidao.ru",
      method: "POST",
      origin: "https://shidao.ru",
      secFetchSite: "same-origin",
    }),
    true,
  );
});

test("development fallback compares full request origin including port", () => {
  const base = {
    method: "POST",
    secFetchSite: "same-origin",
    host: "localhost:49892",
    forwardedHost: null,
    configuredAppUrl: null,
    requestUrl: "http://localhost:49892/api/test",
    environment: "development",
  };
  assert.equal(
    isCrossOriginRequest({ ...base, origin: "http://localhost:49892" }),
    false,
  );
  assert.equal(
    isCrossOriginRequest({ ...base, origin: "http://localhost:1234" }),
    true,
  );
  assert.equal(
    isCrossOriginRequest({ ...base, origin: "https://localhost:49892" }),
    true,
  );
});
