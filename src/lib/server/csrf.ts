/**
 * Stateless CSRF defense for state-changing requests.
 *
 * The app authenticates via the `shidao_session` cookie (SameSite=Lax), which
 * already blocks most cross-site cookie-bearing POSTs in modern browsers. This
 * module adds defense-in-depth by validating the request `Origin` (and, as a
 * fallback, `Sec-Fetch-Site`) against the application's own host for every
 * unsafe HTTP method. It is pure and Edge-safe so it can run in middleware.
 *
 * Next.js server actions already perform an equivalent Origin/Host check
 * internally; this guard primarily protects the `/api/*` route handlers and
 * plain HTML form posts, which have no built-in protection.
 */

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

export type CsrfCheckInput = {
  method: string;
  /** `Origin` request header, if any. */
  origin: string | null;
  /** `Sec-Fetch-Site` request header, if any. */
  secFetchSite: string | null;
  /** `Host` request header (origin server host). */
  host: string | null;
  /** `X-Forwarded-Host` request header (host presented by the edge proxy). */
  forwardedHost: string | null;
  /** Configured public site URL (NEXT_PUBLIC_SITE_URL / SITE_URL). */
  configuredSiteUrl?: string | null;
};

function hostFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function collectAllowedHosts(input: CsrfCheckInput): Set<string> {
  const hosts = new Set<string>();
  for (const raw of [input.forwardedHost, input.host]) {
    if (raw) hosts.add(raw.trim().toLowerCase());
  }
  const configuredHost = hostFromUrl(input.configuredSiteUrl);
  if (configuredHost) hosts.add(configuredHost);
  return hosts;
}

/**
 * Returns true when an unsafe request must be rejected as cross-origin.
 *
 * Decision order:
 *  1. Safe methods (GET/HEAD/OPTIONS) are always allowed.
 *  2. If an `Origin` header is present, its host must match an allowed host.
 *     A malformed `Origin` is rejected.
 *  3. Otherwise, if `Sec-Fetch-Site` is present, reject only `cross-site`.
 *  4. If neither header is present (non-browser client), allow — the
 *     SameSite=Lax session cookie remains the backstop. This is a deliberate,
 *     documented tradeoff, not an oversight.
 */
export function isCrossOriginRequest(input: CsrfCheckInput): boolean {
  if (!isUnsafeMethod(input.method)) return false;

  if (input.origin) {
    const originHost = hostFromUrl(input.origin);
    if (!originHost) return true;
    return !collectAllowedHosts(input).has(originHost);
  }

  if (input.secFetchSite) {
    return input.secFetchSite.trim().toLowerCase() === "cross-site";
  }

  return false;
}
