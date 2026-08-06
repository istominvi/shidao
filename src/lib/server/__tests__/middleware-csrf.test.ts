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
