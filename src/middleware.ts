import { NextRequest, NextResponse } from "next/server";
import { isCrossOriginRequest, isUnsafeMethod } from "@/lib/server/csrf";

/**
 * Global CSRF guard: rejects cross-origin state-changing requests before they
 * reach any route handler or server action. See `@/lib/server/csrf` for the
 * decision logic. Safe (GET/HEAD/OPTIONS) requests pass through untouched.
 */
export function middleware(req: NextRequest) {
  const requestHost = (
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    ""
  )
    .split(":")[0]
    .toLowerCase();

  if (requestHost === "model.shidao.ru" && req.nextUrl.pathname === "/") {
    const modelUrl = req.nextUrl.clone();
    modelUrl.pathname = "/model";
    return NextResponse.rewrite(modelUrl);
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

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets. The guard only
  // acts on unsafe methods, so safe page/asset GETs are unaffected.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|icon.svg).*)",
  ],
};
