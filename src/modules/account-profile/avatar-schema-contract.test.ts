import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260814050347_account_profile_avatars.sql",
  "utf8",
);
const snapshot = readFileSync("supabase/schema/current-schema.sql", "utf8");
const snapshotRefresh = readFileSync(
  "scripts/refresh-schema-snapshot.sh",
  "utf8",
);

function migrationFunction(name: string) {
  const start = migration.indexOf(`create function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = migration.indexOf("\n$function$;", start);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return migration.slice(start, end + "\n$function$;".length);
}

test("Account avatars are one guarded forward migration", () => {
  assert.match(migration, /^begin;\n/);
  assert.equal((migration.match(/^begin;$/gm) ?? []).length, 1);
  assert.equal((migration.match(/^commit;$/gm) ?? []).length, 1);
  assert.match(migration, /shidao_schema_sanity_check_failed/);
  assert.match(migration, /account_profile_avatar_objects_already_exist/);
  assert.match(migration, /\nnotify pgrst, 'reload schema';\n\ncommit;\n$/);
  assert.doesNotMatch(migration, /drop\s+(?:table|schema)[^;]*\bcascade\b/i);
});

test("Account owns exactly one required avatar source", () => {
  for (const column of [
    "avatar_kind text",
    "avatar_preset_key text",
    "avatar_storage_path text",
    "avatar_revision integer",
    "avatar_updated_at timestamptz",
  ]) {
    assert.match(migration, new RegExp(`add column ${column}`));
  }

  assert.match(migration, /alter column avatar_kind set default 'preset'/);
  assert.match(
    migration,
    /alter column avatar_preset_key set default 'sd-avatar-v1-01'/,
  );
  assert.match(migration, /account_avatar_revision_check[\s\S]*>= 1/);
  assert.match(
    migration,
    /account_avatar_selection_check[\s\S]*avatar_kind = 'preset'[\s\S]*avatar_preset_key is not null[\s\S]*avatar_storage_path is null[\s\S]*avatar_kind = 'custom'[\s\S]*avatar_preset_key is null[\s\S]*avatar_storage_path is not null/,
  );
  assert.match(
    migration,
    /account_avatar_storage_path_check[\s\S]*\[0-9a-f\]\{8\}[\s\S]*-4\[0-9a-f\]\{3\}-\[89ab\][\s\S]*\\\.webp\$/,
  );

  const presetConstraint = migration.slice(
    migration.indexOf("account_avatar_preset_key_check"),
    migration.indexOf("account_avatar_storage_path_check"),
  );
  const presetKeys = Array.from(
    presetConstraint.matchAll(/'sd-avatar-v1-(\d{2})'/g),
    (match) => match[1],
  );
  assert.deepEqual(
    presetKeys,
    Array.from({ length: 20 }, (_, index) =>
      String(index + 1).padStart(2, "0"),
    ),
  );

  assert.match(migration, /disable trigger trg_account_updated_at/);
  assert.match(
    migration,
    /avatar_preset_key = 'sd-avatar-v1-' \|\| lpad\([\s\S]*md5\(account\.id::text\)[\s\S]*% 20/,
  );
  assert.match(migration, /avatar_updated_at = account.updated_at/);
  assert.match(migration, /enable trigger trg_account_updated_at/);
  assert.match(
    migration,
    /revoke update \([\s\S]*avatar_storage_path[\s\S]*\) on table public\.account from public, anon, authenticated/,
  );
});

test("custom avatar Storage is private and server-only", () => {
  assert.match(
    migration,
    /values \(\s*'profile-avatars',\s*'profile-avatars',\s*false,\s*1048576,\s*array\['image\/webp'\]::text\[\]/,
  );
  assert.match(
    migration,
    /No storage\.objects policy is created for profile-avatars/,
  );
  assert.doesNotMatch(migration, /create policy profile_avatars_/i);
  assert.doesNotMatch(
    migration,
    /create policy[^;]+bucket_id = 'profile-avatars'/i,
  );
  assert.doesNotMatch(migration, /owner_id/);
});

test("avatar mutation is a locked server-only optimistic RPC", () => {
  const setter = migrationFunction("set_current_account_avatar");

  assert.match(setter, /security definer[\s\S]*set search_path = ''/);
  assert.match(setter, /p_actor_auth_user_id uuid/);
  assert.match(
    setter,
    /p_actor_auth_user_id is null[\s\S]*account_avatar_not_found/,
  );
  assert.match(
    setter,
    /account\.auth_user_id = p_actor_auth_user_id[\s\S]*account\.status in \('active', 'provisional'\)/,
  );
  assert.match(setter, /for update of account/);
  assert.match(
    setter,
    /avatar_revision <> p_expected_revision[\s\S]*account_avatar_stale'[\s\S]*errcode = '40001'/,
  );
  assert.match(
    setter,
    /'\^' \|\| v_account\.id::text[\s\S]*-4\[0-9a-f\]\{3\}-\[89ab\][\s\S]*\\\.webp\$[\s\S]*from storage\.objects as object[\s\S]*object\.bucket_id = 'profile-avatars'[\s\S]*object\.name = p_avatar_storage_path/,
  );
  assert.doesNotMatch(setter, /auth\.uid|owner_id/);
  assert.match(setter, /avatar_revision = account\.avatar_revision \+ 1/);
  assert.match(setter, /previous_storage_path text/);

  assert.match(
    migration,
    /alter function public\.set_current_account_avatar\(uuid, text, text, text, integer\)\s+owner to supabase_admin/,
  );
  const setterAcl = migration.slice(
    migration.indexOf("alter function public.set_current_account_avatar"),
    migration.indexOf("do $postflight$"),
  );
  assert.match(
    setterAcl,
    /revoke all on function public\.set_current_account_avatar\([\s\S]*?from public, anon, authenticated, service_role;/,
  );
  assert.match(setterAcl, /grant execute[\s\S]*?to postgres, service_role;/);
  assert.doesNotMatch(setterAcl, /grant execute[\s\S]*?to[^;]*authenticated/);
});

test("auth context and reviewed snapshot preserve the avatar contract", () => {
  const context = migrationFunction("current_account_auth_context");
  const existingField = context.indexOf("can_author_educator_courses boolean");
  const avatarField = context.indexOf("avatar_kind text");
  assert.ok(existingField >= 0 && avatarField > existingField);
  for (const field of [
    "account.avatar_kind",
    "account.avatar_preset_key",
    "account.avatar_storage_path",
    "account.avatar_revision",
    "account.avatar_updated_at",
  ]) {
    assert.match(context, new RegExp(field.replace(".", "\\.")));
    assert.match(snapshot, new RegExp(field.replace(".", "\\.")));
  }

  for (const marker of [
    "CREATE FUNCTION public.set_current_account_avatar",
    "'profile-avatars'",
    "No storage.objects policy exists for profile-avatars",
  ]) {
    assert.match(snapshot, new RegExp(marker.replaceAll(".", "\\.")));
    assert.match(snapshotRefresh, new RegExp(marker.replaceAll(".", "\\.")));
  }
  assert.doesNotMatch(snapshot, /CREATE POLICY profile_avatars_/);
  assert.doesNotMatch(
    snapshot,
    /CREATE POLICY[^;]+bucket_id = 'profile-avatars'/,
  );
  assert.match(
    snapshotRefresh,
    /public\.set_current_account_avatar\(uuid,text,text,text,integer\)/,
  );
  assert.match(
    snapshotRefresh,
    /has_function_privilege\(\s*'postgres',[\s\S]{0,160}set_current_account_avatar\(uuid,text,text,text,integer\)/,
  );
  assert.match(
    snapshotRefresh,
    /has_function_privilege\(\s*'service_role',[\s\S]{0,160}set_current_account_avatar\(uuid,text,text,text,integer\)/,
  );
  assert.match(
    snapshotRefresh,
    /unnest\(array\['anon', 'authenticated'\]\)[\s\S]{0,240}set_current_account_avatar\(uuid,text,text,text,integer\)/,
  );
  assert.ok(
    snapshotRefresh.includes(
      "procedure.proconfig @> array['search_path=\\\"\\\"']",
    ),
  );

  const snapshotSetterAclStart = snapshot.indexOf(
    "REVOKE ALL ON FUNCTION public.set_current_account_avatar(",
  );
  assert.notEqual(snapshotSetterAclStart, -1);
  const snapshotSetterAcl = snapshot.slice(
    snapshotSetterAclStart,
    snapshot.indexOf("\n\n--", snapshotSetterAclStart),
  );
  assert.match(snapshotSetterAcl, /TO postgres;/);
  assert.match(snapshotSetterAcl, /TO service_role;/);
  assert.doesNotMatch(snapshotSetterAcl, /TO (?:anon|authenticated);/);
});
