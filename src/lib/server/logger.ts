type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "secret",
  "currentsecret",
  "token",
  "tokenhash",
  "hashedtoken",
  "tokendigest",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "sessionid",
  "sid",
  "apikey",
  "xapikey",
  "routeraiapikey",
  "authorization",
  "proxyauthorization",
  "cookie",
  "setcookie",
  "pin",
  "newpin",
  "rawpin",
  "prawpin",
  "pinhash",
  "sharecode",
  "sharecodedigest",
  "copylink",
  "identifier",
  "login",
  "alias",
  "loginalias",
  "email",
  "authemail",
  "recipientemail",
  "recipientemaildigest",
]);

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (SENSITIVE_KEYS.has(normalized)) return true;
  return [
    "password",
    "secret",
    "token",
    "cookie",
    "authorization",
    "apikey",
    "email",
    "pin",
    "sharecode",
    "copylink",
    "identifier",
    "alias",
    "login",
  ].some((fragment) => normalized.includes(fragment));
}

function sanitize(value: unknown): unknown {
  if (value instanceof Error) {
    // Error messages can contain provider/DB input values. The stable class
    // name is sufficient for structured diagnostics without echoing secrets.
    return { name: value.name };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        isSensitiveKey(key) ? "[redacted]" : sanitize(nested),
      ]),
    );
  }

  return value;
}

function log(level: LogLevel, message: string, meta?: LogMeta) {
  const payload = {
    level,
    message,
    ...(meta ? { meta: sanitize(meta) } : {}),
  };
  console[level](JSON.stringify(payload));
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    log("info", message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    log("warn", message, meta);
  },
  error(message: string, meta?: LogMeta) {
    log("error", message, meta);
  },
};
