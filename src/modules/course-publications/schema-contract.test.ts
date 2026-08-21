import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260810035033_course_publication_catalog.sql",
  "utf8",
);
const publicationV2Migration = readFileSync(
  "supabase/migrations/20260820090529_course_publication_snapshot_v2.sql",
  "utf8",
);
const snapshot = readFileSync("supabase/schema/current-schema.sql", "utf8");
const snapshotLower = snapshot.toLowerCase();
const schemaGuide = readFileSync("docs/database/current-schema.md", "utf8");

function migrationFunction(name: string) {
  const start = migration.indexOf(`create function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = migration.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return migration.slice(start, end + 4);
}

function migrationFunctionIn(source: string, name: string) {
  const startMatch = new RegExp(
    `create(?: or replace)? function public\\.${name}\\(`,
    "i",
  ).exec(source);
  assert.ok(startMatch, `missing function ${name}`);
  const start = startMatch.index;
  const tail = source.slice(start);
  const delimiterMatch = /\bas\s+(\$[A-Za-z_]*\$)/i.exec(tail);
  assert.ok(delimiterMatch, `missing function delimiter for ${name}`);
  const delimiter = delimiterMatch[1];
  const bodyStart = start + delimiterMatch.index;
  const end = source.indexOf(`\n${delimiter};`, bodyStart);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return source.slice(start, end + delimiter.length + 2);
}

const publicationTables = [
  "course_publication",
  "course_publication_revision",
  "course_publication_asset",
  "course_publication_origin",
] as const;

test("publication catalog is one forward-only transactional migration mirrored in the snapshot", () => {
  assert.match(migration, /^begin;\n/);
  assert.match(migration, /\ncommit;\n$/);
  assert.doesNotMatch(
    migration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );

  for (const table of publicationTables) {
    assert.equal(
      migration.includes(`create table public.${table} (`),
      true,
      `migration missing ${table}`,
    );
    assert.equal(
      snapshotLower.includes(`create table public.${table} (`),
      true,
      `snapshot missing ${table}`,
    );
    assert.equal(
      migration.includes(
        `alter table public.${table} enable row level security`,
      ),
      true,
      `RLS missing for ${table}`,
    );
    assert.equal(
      migration.includes(
        `grant all on table public.${table} to postgres, service_role`,
      ),
      true,
      `closed service table grant missing for ${table}`,
    );
  }

  assert.doesNotMatch(migration, /create table public\.lesson_step/i);
  assert.doesNotMatch(migration, /\bstep_id\b|\bstepId\b/);
  assert.doesNotMatch(snapshot, /create table public\.lesson_step/i);
});

test("publication survives deletion of live source rows and revisions may repeat an older hash", () => {
  assert.match(
    migration,
    /source_course_id uuid null\s+references public\.course\(id\) on delete set null/,
  );
  assert.match(
    migration,
    /create unique index course_publication_source_course_unique[\s\S]*where source_course_id is not null/,
  );
  assert.match(
    migration,
    /source_stored_file_id uuid null\s+references public\.stored_file\(id\) on delete set null/,
  );
  assert.doesNotMatch(migration, /course_publication_revision_hash_unique/);
  assert.match(migration, /shidao_catalog_reuse_v1/);
  assert.doesNotMatch(migration, /CC-BY|creative commons/i);
  assert.match(migration, /trg_course_publication_revision_immutable/);
  assert.match(migration, /trg_course_publication_asset_immutable/);
  assert.match(
    migration,
    /constraint course_publication_asset_pkey\s+primary key \(revision_id, id\)/,
  );
  assert.doesNotMatch(
    migration,
    /create table public\.course_publication_asset \(\s*id uuid primary key/,
  );
});

test("publication tables and private bucket expose no browser policy or direct grant", () => {
  for (const table of publicationTables) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on table public\\.${table}\\s+from public, anon, authenticated`,
      ),
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`create policy[^;]+on public\\.${table}`, "i"),
    );
  }

  assert.match(
    migration,
    /'course-publication-assets',[\s\S]*false,[\s\S]*10485760/,
  );
  assert.match(migration, /No storage\.objects policy is created/);
  assert.doesNotMatch(
    migration,
    /create policy[^;]+course-publication-assets/i,
  );
});

test("closed publication RPC signatures are SECURITY INVOKER with empty search_path", () => {
  const functions = [
    "publish_course_revision_admin",
    "unpublish_course_publication_admin",
    "list_course_publication_catalog_admin",
    "clone_course_publication_admin",
    "duplicate_course_admin",
  ] as const;

  for (const name of functions) {
    const body = migrationFunction(name);
    assert.match(body, /security invoker/);
    assert.match(body, /set search_path = ''/);
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${name}\\([\\s\\S]*?from public, anon, authenticated, service_role`,
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `grant execute on function public\\.${name}\\([\\s\\S]*?to postgres, service_role`,
      ),
    );
  }

  assert.match(
    migration,
    /publish_course_revision_admin\([\s\S]*p_asset_manifest jsonb,[\s\S]*p_rights_confirmed boolean/,
  );
  assert.match(
    migration,
    /clone_course_publication_admin\([\s\S]*p_id_map jsonb,[\s\S]*p_asset_manifest jsonb/,
  );
  assert.match(
    migration,
    /duplicate_course_admin\([\s\S]*p_target_title text,[\s\S]*p_id_map jsonb/,
  );
  assert.match(
    migration,
    /list_course_publication_catalog_admin\([\s\S]*p_q text,[\s\S]*p_offset integer,[\s\S]*p_limit integer/,
  );
});

test("publish validates publication-local refs by canonical position, never live row UUID equality", () => {
  const publish = migrationFunction("publish_course_revision_admin");

  assert.match(
    publish,
    /submitted\.value ->> 'position'\)::integer = lesson\.position/,
  );
  assert.match(
    publish,
    /submitted_component\.value ->> 'position'\)::integer\s+= component\.position/,
  );
  assert.match(
    publish,
    /submitted_slide\.value ->> 'position'\)::integer\s+= source_slide\.position/,
  );
  assert.match(publish, /submitted_slide\.value ->> 'ref'/);
  assert.doesNotMatch(
    publish,
    /submitted[^\n]*ref[^\n]*= (?:lesson|component|slide)\.id/,
  );
  assert.doesNotMatch(publish, /component\.student_slide_id::text/);

  assert.match(publish, /v_revision\.snapshot = p_snapshot/);
  assert.match(publish, /course_publication_current_hash_snapshot_mismatch/);
  assert.match(publish, /v_asset_count > 24/);
  assert.match(publish, /v_asset_total_bytes > 125829120/);
  assert.match(publish, /asset\."sizeBytes" > 10485760/);
  assert.match(
    publish,
    /p_publication_id::text,[\s\S]*'\/revisions\/',[\s\S]*p_revision_id::text,[\s\S]*'\/assets\/',[\s\S]*asset\."publicationAssetId"::text/,
  );
});

test("publish compares the complete asset-bearing payload after exact file ref remap", () => {
  const remap = migrationFunction("remap_course_publication_component_assets");
  const payloadMatch = migrationFunction(
    "course_publication_snapshot_payloads_match",
  );
  const publish = migrationFunction("publish_course_revision_admin");

  assert.match(
    remap,
    /if v_source_id is null or v_source_id = '' then\s+return p_payload/,
  );
  assert.match(
    remap,
    /jsonb_typeof\(slide\.value -> 'storedFileId'\) = 'null'/,
  );
  assert.match(
    payloadMatch,
    /remap_course_publication_component_assets\([\s\S]*source_component\.payload,[\s\S]*p_asset_id_map[\s\S]*is distinct from submitted\.value -> 'payload'/,
  );
  assert.match(
    publish,
    /asset\."sourceStoredFileId"::text,[\s\S]*asset\."publicationAssetId"::text/,
  );
  assert.match(
    publish,
    /course_publication_snapshot_payloads_match\([\s\S]*v_asset_id_map/,
  );
  assert.doesNotMatch(
    publish,
    /course_publication_component_asset_map_mismatch|coalesce\(source_component\.payload ->> 'storedFileId', ''\) = ''/,
  );
});

test("publication dirty state uses dedicated content and acknowledged clocks", () => {
  const courseClock = migrationFunction(
    "set_course_publication_content_updated_at",
  );
  const publish = migrationFunction("publish_course_revision_admin");

  assert.match(
    migration,
    /alter table public\.course\s+add column publication_content_updated_at timestamptz not null default now\(\)/,
  );
  assert.match(migration, /source_content_updated_at timestamptz not null/);
  assert.match(courseClock, /new\.title is distinct from old\.title/);
  assert.match(
    courseClock,
    /new\.target_lesson_count is distinct from old\.target_lesson_count/,
  );
  assert.doesNotMatch(
    courseClock,
    /teacher_preferences|audience_type|settings|assembled_at|archived_at/,
  );
  assert.match(courseClock, /pg_trigger_depth\(\) > 1/);
  assert.match(
    migration,
    /set updated_at = clock_timestamp\(\),\s+publication_content_updated_at = clock_timestamp\(\)/,
  );
  assert.doesNotMatch(publish, /v_course\.updated_at/);
  assert.match(
    publish,
    /source_course_updated_at,[\s\S]*v_course\.publication_content_updated_at/,
  );
  assert.equal(
    [
      ...publish.matchAll(
        /source_content_updated_at\s*=\s*(?:\n\s*)?v_course\.publication_content_updated_at/g,
      ),
    ].length >= 2,
    true,
  );
  assert.match(publish, /'sourceContentUpdatedAt'/);
});

test("Account deactivation atomically unpublishes and active owners gate catalog use", () => {
  const lifecycle = migrationFunction(
    "unpublish_course_publications_for_inactive_account",
  );
  const catalog = migrationFunction("list_course_publication_catalog_admin");
  const clone = migrationFunction("clone_course_publication_admin");

  assert.match(
    migration,
    /create trigger trg_account_unpublish_course_publications[\s\S]*after update of status on public\.account[\s\S]*when \(old\.status = 'active' and new\.status <> 'active'\)/,
  );
  assert.match(
    lifecycle,
    /if old\.status = 'active' and new\.status <> 'active'/,
  );
  assert.match(
    lifecycle,
    /set status = 'unpublished',[\s\S]*where publication\.owner_account_id = new\.id[\s\S]*publication\.status = 'published'/,
  );
  assert.doesNotMatch(lifecycle, /set status = 'published'/);
  assert.match(lifecycle, /security invoker/);
  assert.match(lifecycle, /set search_path = ''/);
  assert.match(
    migration,
    /revoke all on function\s+public\.unpublish_course_publications_for_inactive_account\(\)[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.match(
    catalog,
    /join public\.account as owner_account[\s\S]*owner_account\.status = 'active'/,
  );
  assert.match(
    clone,
    /v_catalog_owner_account_id[\s\S]*order by account\.id[\s\S]*for share[\s\S]*account\.status = 'active'/,
  );
  assert.match(snapshot, /trg_account_unpublish_course_publications/);
});

test("publication history has a serialized five GiB Account quota", () => {
  const quota = migrationFunction(
    "enforce_course_publication_account_storage_quota",
  );
  const publish = migrationFunction("publish_course_revision_admin");

  assert.match(quota, /security invoker/);
  assert.match(quota, /set search_path = ''/);
  assert.match(quota, /octet_length\(revision\.snapshot::text\)::bigint/);
  assert.match(quota, /sum\(asset\.size_bytes\)/);
  assert.match(quota, /where account\.id = v_owner_account_id\s+for update/);
  assert.match(quota, /> 5368709120/);
  assert.match(quota, /course_publication_account_quota_exceeded/);
  assert.match(
    migration,
    /create trigger trg_course_publication_revision_account_storage_quota\s+before insert on public\.course_publication_revision/,
  );
  assert.match(
    migration,
    /create trigger trg_course_publication_asset_account_storage_quota\s+before insert on public\.course_publication_asset/,
  );
  assert.match(
    migration,
    /revoke all on function\s+public\.enforce_course_publication_account_storage_quota\(\)[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.match(publish, /account\.status = 'active'\s+for update/);
  assert.match(
    publish,
    /v_candidate_storage_bytes :=\s+octet_length\(p_snapshot::text\)::bigint \+ v_asset_total_bytes/,
  );
  assert.match(publish, /course_publication_account_quota_exceeded/);
  assert.equal(
    publish.indexOf("return jsonb_build_object(") <
      publish.indexOf("v_candidate_storage_bytes :="),
    true,
    "same-current idempotent return must happen before growing quota check",
  );
  assert.match(snapshot, /5368709120/);
});

test("idempotent republish revalidates the exact live material set", () => {
  const publish = migrationFunction("publish_course_revision_admin");
  const branchStart = publish.indexOf("and v_revision.snapshot = p_snapshot");
  const branchEnd = publish.indexOf(
    "course_publication_current_hash_snapshot_mismatch",
  );
  const branch = publish.slice(branchStart, branchEnd);

  assert.match(branch, /jsonb_array_length\(p_asset_manifest\) <> 0/);
  assert.match(branch, /from public\.course_attachment as attachment/);
  assert.match(branch, /stored_file\.status <> 'ready'/);
  assert.match(branch, /stored_file\.checksum_sha256/);
  assert.match(branch, /material\.value ->> 'checksumSha256'/);
  assert.match(branch, /from storage\.objects as object/);
  assert.match(branch, /course_publication_idempotent_assets_mismatch/);
  assert.equal(
    branch.indexOf("course_publication_idempotent_assets_mismatch") <
      branch.indexOf("source_content_updated_at"),
    true,
    "live material validation must precede acknowledged clock update",
  );
});

test("catalog list uses compact denormalized rows, DB filters and global facets", () => {
  const catalog = migrationFunction("list_course_publication_catalog_admin");
  const publish = migrationFunction("publish_course_revision_admin");

  for (const column of [
    "title text not null",
    "subject text not null",
    "goal text not null",
    "level text not null",
    "audience_description text not null",
    "target_lesson_count integer not null",
    "lesson_count integer not null",
    "material_count integer not null",
  ]) {
    assert.equal(migration.includes(column), true, `missing ${column}`);
    assert.equal(
      snapshotLower.includes(column),
      true,
      `snapshot missing ${column}`,
    );
  }

  assert.doesNotMatch(catalog, /revision\.snapshot|publication_revision/);
  assert.doesNotMatch(catalog, /'ownerAccountId'/);
  assert.match(
    catalog,
    /when publication\.owner_account_id = p_actor_account_id\s+then publication\.source_course_id/,
  );
  assert.match(catalog, /limit p_limit \+ 1/);
  assert.match(catalog, /'nextOffset'/);
  assert.match(catalog, /'facets'/);
  assert.match(catalog, /'subjects'/);
  assert.match(catalog, /'levels'/);
  assert.equal(
    [...catalog.matchAll(/limit 100/g)].length,
    2,
    "subject and level facets must each be capped at 100 values",
  );
  assert.match(
    catalog,
    /btrim\(p_subject\) <> ''[\s\S]*lower\(value\) = lower\(btrim\(p_subject\)\)[\s\S]*limit 100/,
  );
  assert.match(
    catalog,
    /btrim\(p_level\) <> ''[\s\S]*lower\(value\) = lower\(btrim\(p_level\)\)[\s\S]*limit 100/,
  );
  assert.match(
    catalog,
    /publication\.is_shidao desc,[\s\S]*publication\.published_at desc,[\s\S]*publication\.id desc/,
  );
  assert.match(
    migration,
    /create index course_publication_catalog_subject_idx/,
  );
  assert.match(migration, /create index course_publication_catalog_level_idx/);
  assert.match(
    publish,
    /insert into public\.course_publication \([\s\S]*title,[\s\S]*lesson_count,[\s\S]*material_count,[\s\S]*source_content_updated_at/,
  );
  assert.equal(
    [...publish.matchAll(/set title = v_snapshot_course ->> 'title'/g)]
      .length >= 2,
    true,
    "idempotent and new-revision paths must both refresh compact fields",
  );
});

test("catalog clone and own duplicate have distinct privacy and asset semantics", () => {
  const clone = migrationFunction("clone_course_publication_admin");
  const duplicate = migrationFunction("duplicate_course_admin");

  assert.match(
    clone,
    /v_publication\.status = 'published'|publication\.status = 'published'/,
  );
  assert.match(clone, /teacher_preferences,[\s\S]*'',\s*'none'/);
  assert.match(clone, /insert into public\.stored_file/);
  assert.match(clone, /'ready'/);
  assert.match(clone, /insert into public\.course_publication_origin/);
  assert.match(
    clone,
    /p_actor_account_id::text,[\s\S]*'\/courses\/',[\s\S]*p_target_course_id::text,[\s\S]*'\/assets\/'/,
  );
  assert.match(
    clone,
    /coalesce\([\s\S]*btrim\(p_target_title\),[\s\S]*v_revision\.snapshot -> 'course' ->> 'title'/,
  );

  assert.doesNotMatch(duplicate, /insert into public\.stored_file/);
  assert.doesNotMatch(duplicate, /course_publication_origin/);
  assert.match(duplicate, /source_attachment\.stored_file_id/);
  assert.match(duplicate, /v_source_course\.teacher_preferences/);
  assert.match(duplicate, /source_component\.payload/);
  assert.match(
    duplicate,
    /concat\(left\(v_source_course\.title, 150\), ' — копия'\)/,
  );
  assert.doesNotMatch(
    `${clone}\n${duplicate}`,
    /course_learner|course_learner_group|lesson_run|learning_record|learner_ai_consent/,
  );
});

test("authoring descendants touch the publication clock and repository docs describe the boundary", () => {
  for (const trigger of [
    "trg_lesson_touch_course",
    "trg_lesson_component_touch_course",
    "trg_lesson_student_slide_touch_course",
    "trg_course_attachment_touch_course",
    "trg_stored_file_touch_courses",
  ]) {
    assert.match(migration, new RegExp(`create trigger ${trigger}`));
    assert.match(snapshot, new RegExp(`create trigger ${trigger}`, "i"));
  }

  assert.match(schemaGuide, /Course publication repository contract/);
  assert.match(schemaGuide, /publication-local UUID/);
  assert.match(schemaGuide, /publication_content_updated_at/);
  assert.match(schemaGuide, /source_content_updated_at/);
  assert.match(schemaGuide, /list_course_publication_catalog_admin/);
  assert.match(schemaGuide, /shidao_catalog_reuse_v1/);
  assert.match(
    schemaGuide,
    /Обе migrations[\s\S]*production apply\/postflight и dependent web rollout выполнены/,
  );
  assert.match(schemaGuide, /Current production DB\/source\/web — LA-M3/);
  assert.match(
    schemaGuide,
    /Production schema head:[\s\S]*20260820132725_learning_activity_profile_history_skills_recommendations\.sql/,
  );
  assert.match(
    schemaGuide,
    /2b1a3f475074940e69e1dee6ba12edc8d3103a23a01c640ec342e3cb31f0af46/,
  );
});

test("publication V2 is a forward-only V1-compatible immutable snapshot migration", () => {
  assert.match(publicationV2Migration, /^begin;\n/);
  assert.match(
    publicationV2Migration,
    /\nnotify pgrst, 'reload schema';\n\ncommit;\n$/,
  );
  assert.doesNotMatch(
    publicationV2Migration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );
  assert.match(
    publicationV2Migration,
    /select revision\.id, md5\(revision\.snapshot::text\) as snapshot_md5[\s\S]*?from public\.course_publication_revision/,
  );
  assert.match(
    publicationV2Migration,
    /snapshot ->> 'schemaVersion' in \('1', '2'\)/,
  );
  assert.match(
    publicationV2Migration,
    /snapshot ->> 'schemaVersion' = '1'[\s\S]*?jsonb_typeof\(snapshot -> 'objectives'\) = 'array'/,
  );
  assert.match(
    publicationV2Migration,
    /full join public\.course_publication_revision[\s\S]*?baseline\.snapshot_md5 is distinct from md5\(revision\.snapshot::text\)[\s\S]*?course_publication_v2_immutable_revision_changed/,
  );
  for (const requiredHead of [
    "primary_learning_objective_id",
    "activity_role",
    "source_learning_objective_id_at_time",
    "update_lesson_component_v2",
  ]) {
    assert.equal(
      publicationV2Migration.includes(requiredHead),
      true,
      `V2 preflight missing ${requiredHead}`,
    );
  }
});

test("publication V2 strictly separates V1 and V2 and locks objective state", () => {
  const publish = migrationFunctionIn(
    publicationV2Migration,
    "publish_course_revision_admin",
  ).toLowerCase();

  assert.match(
    publish,
    /v_snapshot_version = 1[\s\S]*?array\['schemaversion', 'course', 'lessons', 'materials'\]/,
  );
  assert.match(
    publish,
    /v_snapshot_version = 2[\s\S]*?array\[[\s\S]*?'objectives'[\s\S]*?'materials'/,
  );
  assert.match(
    publish,
    /v_snapshot_version = 1[\s\S]*?v_objective_count <> 0[\s\S]*?primary_learning_objective_id is not null[\s\S]*?course_publication_snapshot_version_too_old/,
  );
  for (const key of [
    "'ref'",
    "'position'",
    "'title'",
    "'description'",
    "'archivedat'",
  ]) {
    assert.equal(publish.includes(key), true, `objective shape missing ${key}`);
  }
  assert.match(
    publish,
    /char_length\(btrim\(submitted\.value ->> 'title'\)\)[\s\S]*?not between 2 and 240/,
  );
  assert.match(
    publish,
    /row_number\(\) over \([\s\S]*?order by objective\.created_at, objective\.id[\s\S]*?as position/,
  );
  assert.match(
    publish,
    /primaryobjectiveref[\s\S]*?submitted_objective\.value ->> 'ref'/,
  );
  assert.match(publish, /activityrole[\s\S]*?component\.activity_role/);

  const courseLock = publish.indexOf("for update;");
  const lessonLock = publish.indexOf("for update;", courseLock + 1);
  const componentLock = publish.indexOf("for update of component;");
  const objectiveLock = publish.indexOf("for share of objective;");
  assert.equal(
    courseLock >= 0 &&
      courseLock < lessonLock &&
      lessonLock < componentLock &&
      componentLock < objectiveLock,
    true,
    "publication must lock parent state before Component and Objective",
  );
});

test("publication V2 copy paths normalize V1 maps and deterministically remap objectives", () => {
  const clone = migrationFunctionIn(
    publicationV2Migration,
    "clone_course_publication_admin",
  ).toLowerCase();
  const duplicate = migrationFunctionIn(
    publicationV2Migration,
    "duplicate_course_admin",
  ).toLowerCase();

  for (const body of [clone, duplicate]) {
    assert.match(
      body,
      /if not \(p_id_map \? 'objectives'\) then[\s\S]*?jsonb_build_object\('objectives', '\[\]'::jsonb\)/,
    );
    assert.match(body, /jsonb_array_length\(p_id_map -> 'objectives'\)/);
    assert.match(body, /insert into public\.learning_objective/);
    assert.match(body, /primary_learning_objective_id/);
    assert.equal(
      body.indexOf("insert into public.learning_objective") <
        body.indexOf("insert into public.lesson_component"),
      true,
      "objectives must exist before aligned Components",
    );
    assert.equal(
      body.indexOf("insert into public.lesson_component") <
        body.indexOf("update public.learning_objective"),
      true,
      "archived objectives must be restored only after retained alignments",
    );
  }

  assert.match(
    clone,
    /interval '1 microsecond' \* \(submitted\.position - 1\)/,
  );
  assert.match(clone, /order by submitted\.position/);
  assert.match(
    duplicate,
    /row_number\(\) over \([\s\S]*?order by objective\.created_at, objective\.id[\s\S]*?as copy_position/,
  );
  assert.match(
    duplicate,
    /interval '1 microsecond' \* \(source_objective\.copy_position - 1\)/,
  );
  assert.match(duplicate, /order by source_objective\.copy_position/);

  const sourceCourseLock = duplicate.indexOf("select course.*");
  const actorLock = duplicate.indexOf("from public.account as account");
  assert.equal(
    sourceCourseLock >= 0 && sourceCourseLock < actorLock,
    true,
    "duplicate must share publication's Course-before-Account order",
  );
});

test("publication V2 base RPCs remain invoker-only and closed to browser/service roles", () => {
  for (const name of [
    "publish_course_revision_admin",
    "clone_course_publication_admin",
    "duplicate_course_admin",
  ]) {
    const body = migrationFunctionIn(publicationV2Migration, name);
    assert.doesNotMatch(body, /security definer/i);
    assert.match(body, /set search_path to ''/i);
    assert.match(
      publicationV2Migration,
      new RegExp(
        `revoke all on function public\\.${name}\\([\\s\\S]*?from public, anon, authenticated, service_role`,
      ),
    );
  }
  for (const marker of [
    "course_publication_v2_rpc_security_failed",
    "course_publication_v2_rpc_acl_failed",
    "course_publication_v2_rpc_contract_failed",
  ]) {
    assert.equal(
      publicationV2Migration.includes(marker),
      true,
      `postflight missing ${marker}`,
    );
  }
});
