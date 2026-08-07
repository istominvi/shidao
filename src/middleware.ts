import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_PUBLIC_SURFACE,
  BRAND_HOST,
  LANDING_ONLY_SURFACE,
  MODEL_HOST,
  PROJECT_IN_DEVELOPMENT_PATH,
  PUBLIC_SURFACE_HEADER,
  isDemoHost,
  isDemoPublicAsset,
  isIdentityInvitationPage,
  isV2AppHost,
  normalizeRequestHost,
  resolveDeploymentHostPolicy,
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

function blockedHostResponse() {
  return NextResponse.json(
    { error: "Недопустимый адрес запроса." },
    {
      status: 421,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": PRIVATE_SURFACE_ROBOTS_POLICY,
      },
    },
  );
}

/**
 * Global CSRF guard: rejects cross-origin state-changing requests before they
 * reach any route handler or server action. See `@/lib/server/csrf` for the
 * decision logic. Safe (GET/HEAD/OPTIONS) requests pass through untouched.
 */
export function middleware(req: NextRequest) {
  const directHost = normalizeRequestHost(req.headers.get("host"));
  const forwardedHost = normalizeRequestHost(
    req.headers.get("x-forwarded-host"),
  );

  if (
    process.env.NODE_ENV === "production" &&
    directHost &&
    forwardedHost &&
    directHost !== forwardedHost
  ) {
    return blockedHostResponse();
  }

  const requestHost = forwardedHost || directHost;
  const isDirectBrandRoute = req.nextUrl.pathname === "/brand";

  if (
    resolveDeploymentHostPolicy(
      requestHost,
      req.nextUrl.pathname,
      process.env.NODE_ENV,
    ) === "blocked"
  ) {
    return blockedHostResponse();
  }

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

  if (requestHost === BRAND_HOST && req.nextUrl.pathname === "/") {
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

  if (requestHost === MODEL_HOST && req.nextUrl.pathname === "/") {
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
    response.headers.set("Cache-Control", "no-store");
    if (req.nextUrl.searchParams.has("restored")) {
      response.headers.set("Clear-Site-Data", '"cache"');
    }
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
      requestUrl: req.nextUrl.toString(),
      environment: process.env.NODE_ENV,
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

  const response = withV2NoIndex(NextResponse.next(), requestHost);
  if (
    isV2AppHost(requestHost) &&
    isIdentityInvitationPage(req.nextUrl.pathname)
  ) {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  return response;
}

export const config = {
  // Run on everything except Next internals and static assets. The guard only
  // acts on unsafe methods, so safe page/asset GETs are unaffected.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|manifest.webmanifest|icon.svg).*)",
  ],
};
