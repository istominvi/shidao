import "server-only";

import { createHash } from "node:crypto";

const PRIMARY_HEADER_OWNER_SCOPE =
  "shidao:primary-header-summary-owner:v1\u0000";

/** Browser-safe, UI-scoped marker; never expose the raw Auth user id. */
export function primaryHeaderSummaryOwnerKey(authUserId: string) {
  return createHash("sha256")
    .update(PRIMARY_HEADER_OWNER_SCOPE, "utf8")
    .update(authUserId, "utf8")
    .digest("base64url");
}
