import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_PUBLIC_SURFACE,
  LANDING_ONLY_SURFACE,
  PROJECT_IN_DEVELOPMENT_PATH,
  PUBLIC_SURFACE_HEADER,
  isDemoHost,
  isDemoPublicAsset,
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

function publicSurfaceHeaders(
  req: NextRequest,
  surface = LANDING_ONLY_SURFACE,
) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(PUBLIC_SURFACE_HEADER, surface);
  return requestHeaders;
}

const PRIVATE_SURFACE_ROBOTS_POLICY = "noindex, nofollow, noarchive";

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

  if (isDemoHost(requestHost)) {
    if (req.nextUrl.pathname === "/robots.txt") {
      return new NextResponse("User-agent: *\nDisallow: /\n", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          "X-Robots-Tag": PRIVATE_SURFACE_ROBOTS_POLICY,
        },
      });
    }

    if (isDemoPublicAsset(req.nextUrl.pathname)) {
      const response = NextResponse.next();
      response.headers.set("X-Robots-Tag", PRIVATE_SURFACE_ROBOTS_POLICY);
      return response;
    }

    if (isUnsafeMethod(req.method)) {
      return NextResponse.json(
        { error: "Демо доступно только для просмотра." },
        {
          status: 405,
          headers: {
            Allow: "GET, HEAD, OPTIONS",
            "Cache-Control": "no-store",
            "X-Robots-Tag": PRIVATE_SURFACE_ROBOTS_POLICY,
          },
        },
      );
    }

    const demoUrl = req.nextUrl.clone();
    demoUrl.pathname = "/demo";
    const response = NextResponse.rewrite(demoUrl, {
      request: {
        headers: publicSurfaceHeaders(req, DEMO_PUBLIC_SURFACE),
      },
    });
    response.headers.set("X-Robots-Tag", PRIVATE_SURFACE_ROBOTS_POLICY);
    return response;
  }

  if (
    isUnsafeMethod(req.method) &&
    isCrossOriginRequest({
      method: req.method,
      origin: req.headers.get("origin"),
      secFetchSite: req.headers.get("sec-fetch-site"),
      host: req.headers.get("host"),
      forwardedHost: req.headers.get("x-forwarded-host"),
      // Only the working application URL is an allowed configured origin.
      // When it is absent (for example in local development), csrf.ts falls
      // back to the request Host / X-Forwarded-Host values above.
      configuredAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
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
