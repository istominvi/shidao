import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";

function unsafeRequest(origin: string, host: string) {
  return new NextRequest(`http://${host}/api/v2/test`, {
    method: "POST",
    headers: {
      host,
      origin,
      "sec-fetch-site": "same-site",
      "x-forwarded-host": host,
    },
  });
}

function demoRequest(
  pathname: string,
  options?: { method?: string; search?: string },
) {
  const url = new URL(`https://demo.shidao.ru${pathname}`);
  url.search = options?.search ?? "";

  return new NextRequest(url, {
    method: options?.method ?? "GET",
    headers: {
      host: "demo.shidao.ru",
      "x-forwarded-host": "demo.shidao.ru",
    },
  });
}

test("middleware serves the standalone demo on root and clean deep links", () => {
  for (const pathname of [
    "/",
    "/students",
    "/courses",
    "/courses/english-b1/lessons/present-perfect",
    "/lesson/live",
  ]) {
    const response = middleware(demoRequest(pathname));
    const rewrite = response.headers.get("x-middleware-rewrite");

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
    assert.ok(rewrite);
    assert.equal(new URL(rewrite).pathname, "/demo");
    assert.equal(
      response.headers.get("x-middleware-request-x-shidao-public-surface"),
      "standalone-demo",
    );
    assert.equal(
      response.headers.get("x-robots-tag"),
      "noindex, nofollow, noarchive",
    );
  }

  const queriedResponse = middleware(
    demoRequest("/courses", { search: "?source=model" }),
  );
  assert.equal(
    new URL(queriedResponse.headers.get("x-middleware-rewrite") ?? "").search,
    "?source=model",
  );

  const recoveryResponse = middleware(
    demoRequest("/", { search: "?restored=1" }),
  );
  assert.equal(recoveryResponse.headers.get("clear-site-data"), '"cache"');
  assert.equal(recoveryResponse.headers.get("cache-control"), "no-store");
});

test("middleware keeps demo assets readable and blocks demo mutations", async () => {
  const assetResponse = middleware(demoRequest("/og-demo-v2.png"));
  assert.equal(assetResponse.status, 200);
  assert.equal(assetResponse.headers.get("x-middleware-rewrite"), null);
  assert.equal(assetResponse.headers.get("location"), null);

  const robotsResponse = middleware(demoRequest("/robots.txt"));
  assert.equal(robotsResponse.status, 200);
  assert.equal(await robotsResponse.text(), "User-agent: *\nDisallow: /\n");

  const mutationResponse = middleware(
    demoRequest("/api/v2/test", { method: "POST" }),
  );
  assert.equal(mutationResponse.status, 405);
  assert.equal(mutationResponse.headers.get("allow"), "GET, HEAD, OPTIONS");
});

test("standalone demo routing does not change V2 or primary host policy", () => {
  const v2Response = middleware(
    new NextRequest("https://v2.shidao.ru/courses", {
      headers: {
        host: "v2.shidao.ru",
        "x-forwarded-host": "v2.shidao.ru",
      },
    }),
  );
  assert.equal(v2Response.status, 200);
  assert.equal(v2Response.headers.get("x-middleware-rewrite"), null);
  assert.equal(
    v2Response.headers.get("x-robots-tag"),
    "noindex, nofollow, noarchive",
  );

  const primaryResponse = middleware(
    new NextRequest("https://shidao.ru/login", {
      headers: {
        host: "shidao.ru",
        "x-forwarded-host": "shidao.ru",
      },
    }),
  );
  assert.equal(primaryResponse.status, 503);
  assert.equal(
    new URL(primaryResponse.headers.get("x-middleware-rewrite") ?? "").pathname,
    "/project-in-development",
  );
});

test("middleware uses the app URL for CSRF and request host as local fallback", () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  try {
    process.env.NEXT_PUBLIC_APP_URL = "https://v2.shidao.ru";
    process.env.NEXT_PUBLIC_SITE_URL = "https://shidao.ru";

    assert.equal(
      middleware(unsafeRequest("https://shidao.ru", "v2.shidao.ru")).status,
      403,
    );
    assert.equal(
      middleware(unsafeRequest("https://v2.shidao.ru", "v2.shidao.ru")).status,
      200,
    );

    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.equal(
      middleware(unsafeRequest("http://localhost:49892", "localhost:49892"))
        .status,
      200,
    );
  } finally {
    if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;

    if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
  }
});

test("production allowlist blocks unknown and deep brand/model hosts before routing", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
      enumerable: true,
      writable: true,
    });
    for (const [host, pathname] of [
      ["unknown.shidao.ru", "/"],
      ["brand.shidao.ru", "/api/auth/session"],
      ["model.shidao.ru", "/courses"],
      ["localhost", "/login"],
    ]) {
      const response = middleware(
        new NextRequest(`https://${host}${pathname}`, {
          headers: { host, "x-forwarded-host": host },
        }),
      );
      assert.equal(response.status, 421, `${host}${pathname}`);
    }
    const forgedForwardedV2Host = middleware(
      new NextRequest("https://unknown.shidao.ru/courses", {
        headers: {
          host: "unknown.shidao.ru",
          "x-forwarded-host": "v2.shidao.ru",
        },
      }),
    );
    assert.equal(forgedForwardedV2Host.status, 421);

    const foreignForwardedHost = middleware(
      new NextRequest("https://v2.shidao.ru/courses", {
        headers: {
          host: "v2.shidao.ru",
          "x-forwarded-host": "foreign.example",
        },
      }),
    );
    assert.equal(foreignForwardedHost.status, 421);

    const equivalentNormalizedHosts = middleware(
      new NextRequest("https://v2.shidao.ru/courses", {
        headers: {
          host: "V2.Shidao.Ru:443",
          "x-forwarded-host": "v2.shidao.ru",
        },
      }),
    );
    assert.equal(equivalentNormalizedHosts.status, 200);

    const missingOrigin = middleware(
      new NextRequest("https://v2.shidao.ru/api/v2/test", {
        method: "POST",
        headers: {
          host: "v2.shidao.ru",
          "x-forwarded-host": "v2.shidao.ru",
          "sec-fetch-site": "same-origin",
        },
      }),
    );
    assert.equal(missingOrigin.status, 403);
  } finally {
    if (previousNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: previousNodeEnv,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    }
  }
});
