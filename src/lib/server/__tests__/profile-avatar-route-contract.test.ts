import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("profile avatar API keeps private object identity out of public responses", () => {
  const route = source("src/app/api/settings/profile/avatar/route.ts");
  const delivery = source("src/lib/server/profile-avatar-delivery.ts");
  const publicAvatarStart = route.indexOf("function publicAvatar(");
  const publicAvatarEnd = route.indexOf("\n}\n", publicAvatarStart) + 2;
  const publicAvatar = route.slice(publicAvatarStart, publicAvatarEnd);

  assert.ok(publicAvatarStart >= 0 && publicAvatarEnd > publicAvatarStart);
  assert.match(publicAvatar, /kind: avatar\.kind/);
  assert.match(publicAvatar, /presetKey: avatar\.presetKey/);
  assert.match(publicAvatar, /revision: avatar\.revision/);
  assert.doesNotMatch(publicAvatar, /storagePath|storage_path/);
  assert.match(route, /account\.authUserId !== session\.uid/);
  assert.match(route, /isSessionRevoked/);
  assert.match(route, /requestedRevision !== account\.avatar\.revision/);
  assert.match(route, /parseProfileAvatarDeliveryWidth/);
  assert.match(route, /suppliedDeliveryKey !== expectedDeliveryKey/);
  assert.match(route, /private, max-age=31536000, immutable/);
  assert.match(route, /Vary: "Cookie"/);
  assert.match(route, /req\.headers\.get\("if-none-match"\) === etag/);
  assert.match(route, /renderProfileAvatarDeliveryVariant\(bytes, width\)/);
  assert.match(route, /"X-Content-Type-Options": "nosniff"/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|service-role/);
  assert.match(delivery, /createHmac\("sha256", appSessionSecret\(\)\)/);
  assert.match(delivery, /DELIVERY_KEY_SCOPE/);
  assert.doesNotMatch(delivery, /storagePath|storage_path/);
});

test("custom avatar upload is validated server-side before private Storage", () => {
  const route = source("src/app/api/settings/profile/avatar/route.ts");
  const storage = source("src/lib/server/profile-avatar-storage.ts");

  assert.match(route, /ACCOUNT_AVATAR_MAX_UPLOAD_BYTES/);
  assert.match(route, /processProfileAvatarImage/);
  assert.match(route, /uploadProfileAvatarObject/);
  assert.match(route, /setCurrentAccountAvatar/);
  assert.match(
    route,
    /bestEffortDelete\(context\.account\.accountId, storagePath\)/,
  );
  assert.match(route, /formData\.get\("file"\)/);
  assert.match(route, /formData\.get\("expectedRevision"\)/);
  assert.match(route, /expectedRevision,/);
  assert.match(storage, /\/storage\/v1\/object\/authenticated\//);
  assert.match(storage, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(storage, /Authorization: `Bearer \$\{serviceRoleKey\}`/);
  assert.doesNotMatch(storage, /accessToken/);
  assert.match(storage, /"x-upsert": "false"/);
  assert.doesNotMatch(storage, /\/object\/public\//);
});

test("avatar writes keep the browser revision and map stale updates to 409", () => {
  const route = source("src/app/api/settings/profile/avatar/route.ts");

  assert.match(route, /body\?\.expectedRevision/);
  assert.match(route, /Number\.isSafeInteger\(revision\)/);
  assert.match(route, /revision >= 1/);
  assert.doesNotMatch(
    route,
    /expectedRevision: context\.account\.avatar\.revision/,
  );
  assert.match(route, /AccountAvatarRevisionConflictError/);
  assert.match(route, /apiError\(409,/);
});

test("commit-unknown reconciliation never deletes an ambiguous custom object", () => {
  const route = source("src/app/api/settings/profile/avatar/route.ts");
  const notCommittedStart = route.indexOf(
    'reconciliation.status === "not_committed"',
  );
  const ambiguousStart = route.indexOf("} else {", notCommittedStart);
  const rethrow = route.indexOf("throw error;", ambiguousStart);

  assert.ok(notCommittedStart >= 0 && ambiguousStart > notCommittedStart);
  assert.match(
    route.slice(notCommittedStart, ambiguousStart),
    /bestEffortDelete\(context\.account\.accountId, storagePath\)/,
  );
  assert.doesNotMatch(
    route.slice(ambiguousStart, rethrow),
    /bestEffortDelete|deleteProfileAvatarObject/,
  );
  assert.match(
    route.slice(ambiguousStart, rethrow),
    /uploaded object retained/,
  );
});
