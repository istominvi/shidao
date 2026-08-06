type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "api_key",
  "api-key",
  "x-api-key",
  "routerai_api_key",
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "pin",
  "p_raw_pin",
]);

function isSensitiveKey(key: string) {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

function sanitize(value: unknown): unknown {
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

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
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
