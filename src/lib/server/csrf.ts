import { V2_APP_ORIGIN } from "@/lib/deployment-access";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

export type CsrfCheckInput = {
  method: string;
  origin: string | null;
  secFetchSite: string | null;
  host: string | null;
  forwardedHost: string | null;
  configuredAppUrl?: string | null;
  requestUrl?: string | null;
  environment?: string;
};

function originFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

function resolveAllowedOrigin(input: CsrfCheckInput): string | null {
  if ((input.environment ?? process.env.NODE_ENV) === "production") {
    // Production has one application origin. Runtime configuration may never
    // widen this boundary to landing, demo, brand/model, or an unknown host.
    return V2_APP_ORIGIN;
  }

  return (
    originFromUrl(input.configuredAppUrl) ?? originFromUrl(input.requestUrl)
  );
}

/** Returns true when an unsafe request must be rejected. */
export function isCrossOriginRequest(input: CsrfCheckInput): boolean {
  if (!isUnsafeMethod(input.method)) return false;

  const environment = input.environment ?? process.env.NODE_ENV;
  if (input.origin) {
    const origin = originFromUrl(input.origin);
    const allowedOrigin = resolveAllowedOrigin(input);
    return !origin || !allowedOrigin || origin !== allowedOrigin;
  }

  // Browsers send Origin for mutating fetch/form requests. Missing Origin in
  // production is therefore rejected instead of trusting spoofable Host or
  // Sec-Fetch-Site headers.
  if (environment === "production") return true;

  if (input.secFetchSite) {
    return input.secFetchSite.trim().toLowerCase() === "cross-site";
  }
  return false;
}
