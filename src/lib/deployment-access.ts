export const PRIMARY_PUBLIC_HOSTS = new Set(["shidao.ru", "www.shidao.ru"]);
export const V2_APP_HOST = "v2.shidao.ru";
export const PROJECT_IN_DEVELOPMENT_PATH = "/project-in-development";
export const PUBLIC_SURFACE_HEADER = "x-shidao-public-surface";
export const LANDING_ONLY_SURFACE = "landing-only";

const PUBLIC_ASSET_PREFIXES = ["/landing/", "/methodologies/"];
const PUBLIC_ASSET_PATHS = new Set([
  "/favicon.svg",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
]);

export type PrimaryHostRequestPolicy =
  | "pass-through"
  | "landing"
  | "maintenance"
  | "maintenance-page"
  | "blocked-api";

export function normalizeRequestHost(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().split(":")[0];
}

export function isPrimaryPublicHost(host: string) {
  return PRIMARY_PUBLIC_HOSTS.has(normalizeRequestHost(host));
}

export function isV2AppHost(host: string) {
  return normalizeRequestHost(host) === V2_APP_HOST;
}

function isPublicLandingAsset(pathname: string) {
  return (
    PUBLIC_ASSET_PATHS.has(pathname) ||
    PUBLIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function resolvePrimaryHostRequestPolicy(
  host: string,
  pathname: string,
): PrimaryHostRequestPolicy {
  if (!isPrimaryPublicHost(host)) {
    return "pass-through";
  }

  if (pathname === "/") {
    return "landing";
  }

  if (pathname === PROJECT_IN_DEVELOPMENT_PATH) {
    return "maintenance-page";
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return "blocked-api";
  }

  if (isPublicLandingAsset(pathname)) {
    return "pass-through";
  }

  return "maintenance";
}
