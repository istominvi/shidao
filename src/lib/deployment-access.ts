export const PRIMARY_PUBLIC_HOSTS = new Set(["shidao.ru", "www.shidao.ru"]);
export const V2_APP_HOST = "v2.shidao.ru";
export const V2_APP_ORIGIN = `https://${V2_APP_HOST}`;
export const DEMO_HOST = "demo.shidao.ru";
export const BRAND_HOST = "brand.shidao.ru";
export const MODEL_HOST = "model.shidao.ru";
export const PROJECT_IN_DEVELOPMENT_PATH = "/project-in-development";
export const PUBLIC_SURFACE_HEADER = "x-shidao-public-surface";
export const LANDING_ONLY_SURFACE = "landing-only";
export const DEMO_PUBLIC_SURFACE = "standalone-demo";

const DEMO_PUBLIC_ASSET_PATHS = new Set(["/favicon.svg", "/og-demo-v2.png"]);

const PUBLIC_ASSET_PREFIXES = ["/landing/"];
const PUBLIC_ASSET_PATHS = new Set([
  "/favicon.svg",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/email-templates/confirmation.html",
  "/email-templates/email-change.html",
  "/email-templates/invite.html",
  "/email-templates/recovery.html",
]);

export type PrimaryHostRequestPolicy =
  | "pass-through"
  | "landing"
  | "maintenance"
  | "maintenance-page"
  | "blocked-api";

export function normalizeRequestHost(value: string | null | undefined) {
  const first = (value ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("[")) {
    const closingBracket = first.indexOf("]");
    return closingBracket === -1 ? first : first.slice(1, closingBracket);
  }
  return first.split(":")[0] ?? "";
}

export function isLocalDevelopmentHost(host: string) {
  const normalized = normalizeRequestHost(host);
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

export type DeploymentHostPolicy = "allowed" | "blocked";

export function resolveDeploymentHostPolicy(
  host: string,
  pathname: string,
  environment = process.env.NODE_ENV,
): DeploymentHostPolicy {
  const normalized = normalizeRequestHost(host);
  if (
    PRIMARY_PUBLIC_HOSTS.has(normalized) ||
    normalized === V2_APP_HOST ||
    normalized === DEMO_HOST
  ) {
    return "allowed";
  }
  if (normalized === BRAND_HOST || normalized === MODEL_HOST) {
    return pathname === "/" ? "allowed" : "blocked";
  }
  if (environment !== "production" && isLocalDevelopmentHost(normalized)) {
    return "allowed";
  }
  return "blocked";
}

export function isPrimaryPublicHost(host: string) {
  return PRIMARY_PUBLIC_HOSTS.has(normalizeRequestHost(host));
}

export function isV2AppHost(host: string) {
  return normalizeRequestHost(host) === V2_APP_HOST;
}

export function isDemoHost(host: string) {
  return normalizeRequestHost(host) === DEMO_HOST;
}

export function isDemoPublicAsset(pathname: string) {
  return DEMO_PUBLIC_ASSET_PATHS.has(pathname);
}

export function isIdentityInvitationPage(pathname: string) {
  return /^\/identity\/invitations\/[^/]+\/?$/.test(pathname);
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
