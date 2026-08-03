import { NextRequest, NextResponse } from "next/server";
import {
  LANDING_ONLY_SURFACE,
  PROJECT_IN_DEVELOPMENT_PATH,
  PUBLIC_SURFACE_HEADER,
  isV2AppHost,
  normalizeRequestHost,
  resolvePrimaryHostRequestPolicy,
} from "@/lib/deployment-access";
import { isCrossOriginRequest, isUnsafeMethod } from "@/lib/server/csrf";

function withV2NoIndex(response: NextResponse, requestHost: string) {
  if (isV2AppHost(requestHost)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return response;
}

function publicSurfaceHeaders(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(PUBLIC_SURFACE_HEADER, LANDING_ONLY_SURFACE);
  return requestHeaders;
}

/**
 * Global CSRF guard: rejects cross-origin state-changing requests before they
 * reach any route handler or server action. See `@/lib/server/csrf` for the
 * decision logic. Safe (GET/HEAD/OPTIONS) requests pass through untouched.
 */
export function middleware(req: NextRequest) {
  const requestHost = normalizeRequestHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "",
  );
  const isDirectBrandRoute = req.nextUrl.pathname === "/brand";

  const primaryHostPolicy = resolvePrimaryHostRequestPolicy(
    requestHost,
    req.nextUrl.pathname,
  );

  if (primaryHostPolicy === "landing") {
    return NextResponse.next({
      request: {
        headers: publicSurfaceHeaders(req),
      },
    });
  }

  if (primaryHostPolicy === "blocked-api") {
    return NextResponse.json(
      { error: "Проект находится в разработке." },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "3600",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      },
    );
  }

  if (primaryHostPolicy === "maintenance") {
    const maintenanceUrl = req.nextUrl.clone();
    maintenanceUrl.pathname = PROJECT_IN_DEVELOPMENT_PATH;
    maintenanceUrl.search = "";

    return NextResponse.rewrite(maintenanceUrl, {
      status: 503,
      request: {
        headers: publicSurfaceHeaders(req),
      },
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "3600",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  }

  if (primaryHostPolicy === "maintenance-page") {
    return NextResponse.next({
      request: {
        headers: publicSurfaceHeaders(req),
      },
    });
  }

  if (isV2AppHost(requestHost) && req.nextUrl.pathname === "/robots.txt") {
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  }

  if (requestHost === "brand.shidao.ru" && req.nextUrl.pathname === "/") {
    const brandUrl = req.nextUrl.clone();
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-shidao-public-surface", "brand");
    brandUrl.pathname = "/brand";
    return NextResponse.rewrite(brandUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (requestHost === "model.shidao.ru" && req.nextUrl.pathname === "/") {
    const modelUrl = req.nextUrl.clone();
    modelUrl.pathname = "/model";
    return NextResponse.rewrite(modelUrl);
  }

  if (requestHost === "demo.shidao.ru") {
    const demoUrl = req.nextUrl.clone();
    demoUrl.pathname = "/demo";
    return NextResponse.rewrite(demoUrl);
  }

  if (
    isUnsafeMethod(req.method) &&
    isCrossOriginRequest({
      method: req.method,
      origin: req.headers.get("origin"),
      secFetchSite: req.headers.get("sec-fetch-site"),
      host: req.headers.get("host"),
      forwardedHost: req.headers.get("x-forwarded-host"),
      configuredSiteUrl:
        process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? null,
    })
  ) {
    return NextResponse.json(
      { error: "Запрос отклонён: недопустимый источник." },
      { status: 403 },
    );
  }

  if (isDirectBrandRoute) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-shidao-public-surface", "brand");
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return withV2NoIndex(NextResponse.next(), requestHost);
}

export const config = {
  // Run on everything except Next internals and static assets. The guard only
  // acts on unsafe methods, so safe page/asset GETs are unaffected.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|manifest.webmanifest|icon.svg).*)",
  ],
};
