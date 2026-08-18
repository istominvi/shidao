export type PageTransitionDirection = "forward" | "back";

const SECTION_ROUTE_GROUPS = [
  ["/schedule"],
  ["/students", "/observing"],
  ["/courses"],
  ["/store"],
  ["/profile"],
] as const;

function normalizedPathname(value: string) {
  const pathname = new URL(value, "https://v2.shidao.ru").pathname;
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function sectionRouteIndex(pathname: string) {
  return SECTION_ROUTE_GROUPS.findIndex((routes) =>
    routes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    ),
  );
}

function routeDepth(pathname: string) {
  return pathname.split("/").filter(Boolean).length;
}

export function resolvePageTransitionDirection(
  from: string,
  to: string,
): PageTransitionDirection {
  const fromPathname = normalizedPathname(from);
  const toPathname = normalizedPathname(to);
  const fromSectionIndex = sectionRouteIndex(fromPathname);
  const toSectionIndex = sectionRouteIndex(toPathname);

  if (
    fromSectionIndex >= 0 &&
    toSectionIndex >= 0 &&
    fromSectionIndex !== toSectionIndex
  ) {
    return toSectionIndex > fromSectionIndex ? "forward" : "back";
  }

  const fromDepth = routeDepth(fromPathname);
  const toDepth = routeDepth(toPathname);
  if (toDepth !== fromDepth) return toDepth > fromDepth ? "forward" : "back";

  return "forward";
}

export function pageTransitionPathname(value: string) {
  return normalizedPathname(value);
}
