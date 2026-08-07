import { ROUTES } from "../auth";

export function resolvePostLoginRedirectForContext(_context?: unknown) {
  return ROUTES.courses;
}
