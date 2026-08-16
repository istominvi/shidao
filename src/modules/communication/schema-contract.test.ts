import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260816053117_communication_center.sql",
  "utf8",
);
const atomicScheduleMigration = readFileSync(
  "supabase/migrations/20260816072345_atomic_assistant_lesson_run_schedule.sql",
  "utf8",
);
const rpcContract = readFileSync(
  "src/modules/communication/rpc-contract.ts",
  "utf8",
);
const snapshotRefresh = readFileSync(
  "scripts/refresh-schema-snapshot.sh",
  "utf8",
);

function functionBody(name: string) {
  const start = migration.indexOf(`create function public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = migration.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return migration.slice(start, end + 4);
}

function tableBody(name: string) {
  const start = migration.indexOf(`create table public.${name} (`);
  assert.notEqual(start, -1, `missing table ${name}`);
  const end = migration.indexOf("\n);", start);
  assert.notEqual(end, -1, `unterminated table ${name}`);
  return migration.slice(start, end + 3);
}

function atomicScheduleFunctionBody() {
  const start = atomicScheduleMigration.indexOf(
    "create function public.schedule_lesson_run_if_unchanged(",
  );
  assert.notEqual(start, -1, "missing atomic assistant schedule function");
  const end = atomicScheduleMigration.indexOf("\n$$;", start);
  assert.notEqual(end, -1, "unterminated atomic assistant schedule function");
  return atomicScheduleMigration.slice(start, end + 4);
}

test("communication center is one guarded forward-only V2 migration", () => {
  assert.match(migration, /^begin;\n/);
  assert.match(migration, /\nnotify pgrst, 'reload schema';\n\ncommit;\n$/);
  assert.equal((migration.match(/^begin;$/gm) ?? []).length, 1);
  assert.equal((migration.match(/^commit;$/gm) ?? []).length, 1);
  assert.match(migration, /shidao_communication_schema_sanity_check_failed/);
  assert.match(migration, /shidao_communication_objects_already_exist/);
  assert.doesNotMatch(
    migration,
    /drop\s+(?:table|function|schema)[^;]*\bcascade\b/i,
  );
  assert.doesNotMatch(
    migration,
    /\b(?:user_preference|user_security|message_v1|conversation_v1)\b/i,
  );

  for (const table of [
    "communication_thread",
    "communication_message",
    "communication_read_state",
    "assistant_conversation",
    "assistant_turn",
    "system_notification",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
    );
  }
});

test("human, assistant, and system persistence stay separate and bounded", () => {
  const thread = tableBody("communication_thread");
  const message = tableBody("communication_message");
  const conversation = tableBody("assistant_conversation");
  const turn = tableBody("assistant_turn");
  const notification = tableBody("system_notification");

  assert.match(thread, /kind in \('direct', 'course'\)/);
  assert.match(
    thread,
    /direct_account_low_id[\s\S]*?public\.account\(id\) on delete cascade/,
  );
  assert.match(
    thread,
    /direct_account_high_id[\s\S]*?public\.account\(id\) on delete cascade/,
  );
  assert.match(thread, /public\.course\(id\) on delete cascade/);
  assert.match(message, /sender_account_id[\s\S]*?on delete cascade/);
  assert.match(message, /char_length\(body\) <= 6000/);
  assert.match(
    message,
    /unique \(\s*sender_account_id,\s*client_message_id\s*\)/,
  );

  assert.match(
    conversation,
    /owner_account_id[\s\S]*?public\.account\(id\)[\s\S]*?on delete cascade/,
  );
  assert.match(
    conversation,
    /context_course_id uuid references public\.course\(id\) on delete set null/,
  );
  assert.match(
    conversation,
    /context_lesson_id uuid references public\.lesson\(id\) on delete set null/,
  );
  assert.match(turn, /role in \('user', 'assistant'\)/);
  assert.match(
    turn,
    /delivery_kind in \('interactive', 'background_result', 'insight'\)/,
  );
  assert.match(turn, /char_length\(body\) <= 6000/);
  assert.match(turn, /pg_column_size\(payload\) <= 65536/);

  assert.match(
    notification,
    /severity in \('info', 'success', 'warning', 'error', 'action_required'\)/,
  );
  assert.match(notification, /char_length\(body\) <= 6000/);
  assert.match(notification, /pg_column_size\(payload\) <= 16384/);
  assert.match(
    notification,
    /unique \(\s*recipient_account_id,\s*dedupe_key\s*\)/,
  );
});

test("direct and course access are current-membership dynamic", () => {
  const account = functionBody("communication_current_active_account_id");
  const direct = functionBody("communication_direct_link_is_active");
  const course = functionBody("communication_course_account_is_member");
  const access = functionBody("communication_thread_is_accessible");

  assert.match(account, /account\.status = 'active'/);
  assert.match(account, /account\.auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(direct, /relation\.archived_at is null/);
  assert.match(direct, /teacher_account\.status = 'active'/);
  assert.match(direct, /learner_account\.status = 'active'/);
  assert.match(course, /course\.owner_account_id = p_account_id/);
  assert.match(course, /public\.course_learner as direct/);
  assert.match(course, /public\.course_learner_group as course_group/);
  assert.match(course, /public\.learner_group_member as member/);
  assert.match(course, /relation\.archived_at is null/);
  assert.match(access, /communication_direct_link_is_active/);
  assert.match(access, /communication_course_account_is_member/);
  assert.match(access, /not p_for_write[\s\S]*?course\.archived_at is null/);
  assert.doesNotMatch(access, /role\s*=/i);
});

test("browser human-message RPCs use opaque product identities", () => {
  const openDirect = functionBody("open_direct_communication_thread");
  const threadProjection = functionBody("communication_thread_projection");
  const messageProjection = functionBody("communication_message_projection");
  const targets = functionBody("list_my_message_targets");

  assert.match(openDirect, /p_learner_profile_id uuid/);
  assert.match(openDirect, /resolve_teacher_learner_profile_alias/);
  assert.match(
    openDirect,
    /profile\.account_id[\s\S]*?relation\.learner_profile_id = v_profile_id/,
  );
  assert.doesNotMatch(openDirect, /p_other_account_id/);

  for (const key of [
    "id",
    "kind",
    "title",
    "courseId",
    "directLearnerProfileId",
    "preview",
    "lastMessageId",
    "lastActivityAt",
    "canSend",
    "unreadCount",
  ]) {
    assert.match(threadProjection, new RegExp(`'${key}'`));
  }
  assert.doesNotMatch(threadProjection, /'targetLearnerProfileId'/);
  assert.doesNotMatch(threadProjection, /'(?:accountId|authUserId)'/);

  for (const key of [
    "id",
    "threadId",
    "senderLabel",
    "body",
    "createdAt",
    "isOwn",
  ]) {
    assert.match(messageProjection, new RegExp(`'${key}'`));
  }
  assert.doesNotMatch(messageProjection, /'(?:senderAccountId|accountId)'/);
  assert.match(targets, /'learnerProfileId'/);
  assert.match(targets, /'existingThreadId'/);
  assert.doesNotMatch(targets, /'(?:accountId|authUserId)'/);
});

test("empty human threads remain visible with strict non-null activity", () => {
  const projection = functionBody("communication_thread_projection");
  const inbox = functionBody("list_my_communication_inbox");

  assert.match(
    projection,
    /'lastActivityAt', coalesce\(thread\.last_message_at, thread\.created_at\)/,
  );
  assert.equal(
    (
      inbox.match(/coalesce\(thread\.last_message_at, thread\.created_at\)/g) ??
      []
    ).length >= 4,
    true,
  );
  assert.doesNotMatch(inbox, /where thread\.last_message_id is not null/);
  assert.equal(
    (inbox.match(/'lastMessageId', thread\.last_message_id/g) ?? []).length,
    2,
  );
  assert.equal(
    (inbox.match(/'canSend', projection\.value -> 'canSend'/g) ?? []).length,
    2,
  );
  assert.match(inbox, /'id', 'system'/);
  assert.match(inbox, /'pinned', true/);
  assert.match(inbox, /coalesce\(latest\.occurred_at, v_actor_created_at\)/);
  assert.match(inbox, /'lastNotificationId', latest\.id/);
  assert.match(inbox, /'totalUnread'/);
});

test("read receipts and delete repair preserve strict cursor integrity", () => {
  const threadRead = functionBody("mark_communication_thread_read");
  const assistantRead = functionBody("mark_my_assistant_conversation_read");
  const systemRead = functionBody("mark_my_system_notifications_read");
  const repair = functionBody(
    "recompute_communication_thread_after_message_delete",
  );

  for (const body of [threadRead, assistantRead, systemRead]) {
    assert.match(body, /'markedThroughId'/);
    assert.match(body, /'unreadCount'/);
  }
  assert.match(threadRead, /when v_target_message_id = 0 then null/);
  assert.match(assistantRead, /when v_marked_turn_id = 0 then null/);
  assert.match(systemRead, /greatest\(now\(\), notification\.occurred_at\)/);
  assert.match(repair, /v_has_latest := found/);
  assert.match(repair, /where thread\.id = old\.thread_id/);
  assert.match(repair, /thread\.last_message_id = old\.id/);
  assert.match(
    migration,
    /after delete on public\.communication_message[\s\S]*?recompute_communication_thread_after_message_delete/,
  );
});

test("assistant conversations are persisted, owner-scoped, and patch-safe", () => {
  const getConversation = functionBody("get_my_assistant_conversation");
  const createConversation = functionBody("create_my_assistant_conversation");
  const updateConversation = functionBody("update_my_assistant_conversation");
  const appendUser = functionBody("append_my_assistant_turn");
  const appendAdmin = functionBody("append_assistant_turn_admin");

  assert.match(getConversation, /assistant_conversation_projection/);
  assert.match(
    createConversation,
    /course\.owner_account_id = v_actor_account_id/,
  );
  assert.match(createConversation, /lesson\.course_id = p_context_course_id/);
  assert.match(updateConversation, /p_title is null and p_archived is null/);
  assert.match(
    updateConversation,
    /p_title is not null and p_archived is not null/,
  );
  assert.match(
    updateConversation,
    /title = coalesce\(btrim\(p_title\), conversation\.title\)/,
  );
  assert.match(
    updateConversation,
    /when p_archived is null then conversation\.archived_at/,
  );
  assert.match(appendUser, /conversation\.archived_at is null/);
  assert.match(
    appendUser,
    /conversation\.owner_account_id = v_actor_account_id/,
  );
  assert.match(appendUser, /assistant_turn_idempotency_conflict/);
  assert.match(appendAdmin, /owner_account\.status = 'active'/);
  assert.match(appendAdmin, /assistant_turn_idempotency_conflict/);
});

test("LessonRun emits deferred deduplicated audience-safe notifications", () => {
  const producer = functionBody("emit_lesson_run_communication_notifications");
  const cancellationBranch = producer.slice(
    producer.indexOf("and new.cancelled_at is not null"),
    producer.indexOf("and new.ended_at is not null"),
  );
  const learnerBody = producer.slice(
    producer.indexOf("v_learner_body :="),
    producer.indexOf(
      "perform public.append_system_notification_internal(",
      producer.indexOf("v_learner_body :="),
    ),
  );
  const markSystemRead = functionBody("mark_my_system_notifications_read");

  for (const event of [
    "lesson_run.scheduled",
    "lesson_run.rescheduled",
    "lesson_run.removed_from_schedule",
    "lesson_run.cancelled",
    "lesson_run.completed_owner",
    "lesson_run.completed_learner",
  ]) {
    assert.match(producer, new RegExp(`'${event.replaceAll(".", "\\.")}'`));
  }
  assert.match(
    migration,
    /create constraint trigger trg_lesson_run_communication_notifications[\s\S]*?deferrable initially deferred/,
  );
  assert.equal(
    (producer.match(/learner_account\.id <> v_owner_account_id/g) ?? []).length,
    2,
  );
  assert.match(
    producer,
    /new\.planned_duration_minutes is distinct from[\s\S]*?old\.planned_duration_minutes/,
  );
  assert.match(
    producer,
    /v_current_learner_account_ids is distinct from[\s\S]*?v_previous_learner_account_ids/,
  );
  assert.match(
    producer,
    /unnest\(v_current_learner_account_ids\)[\s\S]*?'lesson_run\.rescheduled'/,
  );
  assert.match(
    producer,
    /unnest\(v_previous_learner_account_ids\)[\s\S]*?not previous\.account_id = any\(v_current_learner_account_ids\)[\s\S]*?'lesson_run\.removed_from_schedule'/,
  );
  assert.match(producer, /'changeKind', 'removed_from_schedule'/);
  assert.match(
    cancellationBranch,
    /unnest\(v_previous_learner_account_ids\) as learner\(account_id\)/,
  );
  assert.match(cancellationBranch, /'lesson_run\.cancelled'/);
  assert.match(producer, /shared_with_learner_at is not null/);
  assert.match(producer, /'sharedComment', v_record\.shared_comment/);
  assert.match(producer, /v_learner_body :=/);
  assert.match(producer, /Вы присутствовали/);
  assert.match(producer, /Вы отсутствовали/);
  assert.match(producer, /Материал нужно повторить/);
  assert.match(producer, /Повторение не требуется/);
  assert.match(producer, /Длительность:/);
  assert.match(producer, /Комментарий преподавателя:/);
  assert.match(learnerBody, /v_record\.shared_comment/);
  assert.doesNotMatch(learnerBody, /teacher_comment/);
  assert.match(
    producer,
    /'lesson_run\.completed_learner'[\s\S]*?v_learner_body/,
  );
  assert.match(producer, /'presentCount', v_present_count/);
  assert.match(producer, /lesson_run:scheduled:/);
  assert.match(producer, /lesson_run:completed_learner:/);
  assert.match(
    producer,
    /notification\.payload ->> 'lessonRunId' = new\.id::text/,
  );
  assert.match(
    producer,
    /notification\.dedupe_key = v_latest_audience_dedupe_key/,
  );
  assert.match(
    migration,
    /create index system_notification_lesson_run_audience_idx[\s\S]*?payload ->> 'lessonRunId'/,
  );
  assert.match(
    markSystemRead,
    /greatest\(now\(\), notification\.occurred_at\)/,
  );
});

test("assistant scheduling uses a separate atomic compare-and-schedule RPC", () => {
  const guard = atomicScheduleFunctionBody();

  assert.match(atomicScheduleMigration, /^begin;\n/);
  assert.match(
    atomicScheduleMigration,
    /\nnotify pgrst, 'reload schema';\n\ncommit;\n$/,
  );
  assert.match(
    atomicScheduleMigration,
    /shidao_atomic_assistant_schedule_preflight_failed/,
  );
  assert.doesNotMatch(
    atomicScheduleMigration,
    /create or replace function public\.schedule_lesson_run\(/,
  );
  assert.doesNotMatch(
    atomicScheduleMigration,
    /(?:alter|drop)\s+function public\.schedule_lesson_run\(/i,
  );

  for (const parameter of [
    "p_lesson_id uuid",
    "p_scheduled_at timestamptz",
    "p_planned_duration_minutes integer",
    "p_expected_lesson_run_id uuid",
    "p_expected_lesson_run_updated_at timestamptz",
    "p_expected_learner_profile_ids uuid[]",
  ]) {
    assert.match(guard, new RegExp(parameter.replaceAll("[", "\\[")));
  }
  assert.match(guard, /returns public\.lesson_run/);
  assert.match(guard, /security definer/);
  assert.match(guard, /set search_path to ''/);
  assert.match(guard, /array_position\(p_expected_learner_profile_ids, null\)/);
  assert.match(guard, /cardinality\(p_expected_learner_profile_ids\) > 200/);
  assert.match(guard, /count\(distinct requested\.id\)/);
  assert.match(guard, /lesson_run_guard_invalid'[\s\S]*?'22023'/);

  const accountLock = guard.indexOf("for update of account;");
  const courseLock = guard.indexOf("for update of course;");
  const lessonLock = guard.indexOf("for update of lesson;");
  const runLock = guard.indexOf("for update of run;");
  const recordLock = guard.indexOf("for update of record;");
  assert.equal(
    accountLock < courseLock &&
      courseLock < lessonLock &&
      lessonLock < runLock &&
      runLock < recordLock,
    true,
    "atomic schedule lock order drifted from Account→Course→Lesson→Run→records",
  );

  const groupLock = guard.indexOf("for update of learner_group;");
  const memberLock = guard.indexOf("for update of member;");
  const relationLock = guard.indexOf("for update of teacher_learner;");
  const createAudienceRead = guard.indexOf(
    "select coalesce(\n      array_agg(effective.id order by effective.id)",
  );
  assert.equal(
    recordLock < groupLock &&
      groupLock < memberLock &&
      memberLock < relationLock &&
      relationLock < createAudienceRead,
    true,
    "create guard must freeze linked Groups, members, and relations before reading effective audience",
  );
  assert.match(
    guard,
    /join public\.course_learner_group as course_group[\s\S]*?for update of learner_group/,
  );
  assert.match(
    guard,
    /from public\.learner_group_member as member[\s\S]*?order by member\.learner_group_id, member\.learner_profile_id[\s\S]*?for update of member/,
  );
  assert.match(
    guard,
    /from public\.teacher_learner as teacher_learner[\s\S]*?course_learner[\s\S]*?learner_group_member[\s\S]*?for update of teacher_learner/,
  );

  assert.match(guard, /public\.course_learner as course_learner/);
  assert.match(guard, /public\.course_learner_group as course_group/);
  assert.match(guard, /public\.learner_group_member as member/);
  assert.match(guard, /teacher_learner\.archived_at is null/);
  assert.match(
    guard,
    /p_expected_lesson_run_id is null[\s\S]*?v_run\.id is not null[\s\S]*?v_current_learner_profile_ids is distinct from[\s\S]*?v_expected_learner_profile_ids/,
  );
  assert.match(
    guard,
    /v_run\.id <> p_expected_lesson_run_id[\s\S]*?v_run\.updated_at is distinct from p_expected_lesson_run_updated_at[\s\S]*?v_run\.started_at is not null[\s\S]*?v_current_learner_profile_ids is distinct from/,
  );
  assert.equal((guard.match(/'lesson_run_changed'/g) ?? []).length, 2);
  assert.equal((guard.match(/using errcode = '55000'/g) ?? []).length, 2);
  assert.equal(
    (guard.match(/from public\.schedule_lesson_run\(/g) ?? []).length,
    2,
  );
  assert.match(
    guard,
    /v_expected_learner_profile_ids,\s*null\s*\) as scheduled/,
  );
  assert.match(guard, /null,\s*p_expected_lesson_run_id\s*\) as scheduled/);

  assert.match(
    atomicScheduleMigration,
    /revoke all on function public\.schedule_lesson_run_if_unchanged\([\s\S]*?from public, anon, authenticated, service_role;/,
  );
  assert.match(
    atomicScheduleMigration,
    /grant execute on function public\.schedule_lesson_run_if_unchanged\([\s\S]*?to postgres, authenticated;/,
  );
  assert.match(
    atomicScheduleMigration,
    /atomic_assistant_schedule_postflight_shape_failed/,
  );
  assert.match(
    atomicScheduleMigration,
    /atomic_assistant_schedule_postflight_acl_failed/,
  );
});

test("RPC bounds and grants match the server adapter", () => {
  const adminGrants = migration.slice(
    migration.indexOf(
      "grant execute on function public.append_assistant_turn_admin(",
    ),
    migration.indexOf("\ndo $postflight$"),
  );
  const rpcNames = Array.from(
    rpcContract.matchAll(/:\s*"([a-z][a-z0-9_]+)"/g),
    (match) => match[1],
  );
  assert.equal(rpcNames.length, 18);
  for (const name of rpcNames) {
    assert.match(migration, new RegExp(`public\\.${name}\\(`));
  }

  for (const name of [
    "list_my_communication_inbox",
    "list_my_message_targets",
    "list_my_communication_messages",
    "list_my_assistant_conversations",
    "list_my_assistant_turns",
    "list_my_system_notifications",
  ]) {
    assert.match(functionBody(name), /p_limit > 50/);
    assert.doesNotMatch(functionBody(name), /p_limit > 100/);
  }

  assert.match(
    migration,
    /revoke all on table[\s\S]*?from public, anon, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.open_direct_communication_thread\(uuid\)[\s\S]*?to postgres, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.append_assistant_turn_admin\([\s\S]*?to postgres, service_role;/,
  );
  assert.doesNotMatch(adminGrants, /\bauthenticated\b/);
  assert.match(migration, /communication_user_rpc_postflight_failed/);
  assert.match(migration, /communication_admin_rpc_postflight_failed/);
});

test("schema refresh rejects partial CC1 databases and generated snapshots", () => {
  const communicationTables = [
    "communication_thread",
    "communication_message",
    "communication_read_state",
    "assistant_conversation",
    "assistant_turn",
    "system_notification",
  ];
  const userRpcSignatures = [
    "public.list_my_communication_inbox(timestamp with time zone,text,text,integer)",
    "public.list_my_message_targets(text,integer)",
    "public.open_direct_communication_thread(uuid)",
    "public.open_course_communication_thread(uuid)",
    "public.list_my_communication_messages(uuid,bigint,integer)",
    "public.send_communication_message(uuid,text,uuid)",
    "public.mark_communication_thread_read(uuid,bigint)",
    "public.list_my_assistant_conversations(boolean,integer)",
    "public.get_my_assistant_conversation(uuid)",
    "public.create_my_assistant_conversation(text,uuid,uuid)",
    "public.update_my_assistant_conversation(uuid,text,boolean)",
    "public.list_my_assistant_turns(uuid,bigint,integer)",
    "public.append_my_assistant_turn(uuid,text,uuid)",
    "public.mark_my_assistant_conversation_read(uuid,bigint)",
    "public.list_my_system_notifications(bigint,integer)",
    "public.mark_my_system_notifications_read(bigint)",
    "public.schedule_lesson_run_if_unchanged(uuid,timestamp with time zone,integer,uuid,timestamp with time zone,uuid[])",
  ];
  const adminRpcSignatures = [
    "public.append_assistant_turn_admin(uuid,uuid,text,jsonb,text,text)",
    "public.append_system_notification_admin(uuid,text,text,text,text,jsonb,text,timestamp with time zone)",
  ];
  const tableCatalog = snapshotRefresh.slice(
    snapshotRefresh.indexOf("), communication_table(table_name) as ("),
    snapshotRefresh.indexOf("), communication_user_rpc(signature) as ("),
  );
  const userRpcCatalog = snapshotRefresh.slice(
    snapshotRefresh.indexOf("), communication_user_rpc(signature) as ("),
    snapshotRefresh.indexOf("), communication_admin_rpc(signature) as ("),
  );
  const adminRpcCatalog = snapshotRefresh.slice(
    snapshotRefresh.indexOf("), communication_admin_rpc(signature) as ("),
    snapshotRefresh.indexOf("), communication_trigger("),
  );
  const cc1Gate = snapshotRefresh.slice(
    snapshotRefresh.indexOf("from communication_table as required_table"),
    snapshotRefresh.indexOf("and to_regclass('public.methodology') is null"),
  );
  const generatedMarkers = snapshotRefresh.slice(
    snapshotRefresh.indexOf("for required in"),
    snapshotRefresh.indexOf("if grep -Eq 'CREATE TABLE public[.]lesson_step"),
  );

  assert.notEqual(tableCatalog, "");
  assert.notEqual(userRpcCatalog, "");
  assert.notEqual(adminRpcCatalog, "");
  assert.notEqual(cc1Gate, "");
  assert.notEqual(generatedMarkers, "");

  for (const table of communicationTables) {
    assert.match(tableCatalog, new RegExp(`\\('${table}'\\)`));
    assert.equal(
      generatedMarkers.includes(`CREATE TABLE public.${table}`),
      true,
      `snapshot marker missing table ${table}`,
    );
  }
  assert.equal(
    (userRpcCatalog.match(/\('public\.[a-z0-9_]+\([^']*\)'\)/g) ?? []).length,
    17,
  );
  for (const signature of userRpcSignatures) {
    assert.equal(userRpcCatalog.includes(`('${signature}')`), true, signature);
  }
  assert.equal(
    (adminRpcCatalog.match(/\('public\.[a-z0-9_]+\([^']*\)'\)/g) ?? []).length,
    2,
  );
  for (const signature of adminRpcSignatures) {
    assert.equal(adminRpcCatalog.includes(`('${signature}')`), true, signature);
  }

  assert.match(cc1Gate, /not relation\.relrowsecurity/);
  assert.match(cc1Gate, /array\['anon', 'authenticated'\]/);
  assert.match(cc1Gate, /checked_table_privilege/);
  assert.match(cc1Gate, /has_table_privilege/);
  assert.match(cc1Gate, /not procedure\.prosecdef/);
  assert.match(cc1Gate, /search_path=\\"\\"/);
  assert.match(
    cc1Gate,
    /communication_user_rpc[\s\S]*?'authenticated'[\s\S]*?EXECUTE/,
  );
  assert.match(
    cc1Gate,
    /communication_user_rpc[\s\S]*?array\['anon', 'service_role'\]/,
  );
  assert.match(
    cc1Gate,
    /communication_admin_rpc[\s\S]*?'service_role'[\s\S]*?EXECUTE/,
  );
  assert.match(
    cc1Gate,
    /communication_admin_rpc[\s\S]*?array\['anon', 'authenticated'\]/,
  );
  assert.match(cc1Gate, /database_trigger\.tgtype/);
  assert.match(cc1Gate, /database_trigger\.tgdeferrable/);
  assert.match(cc1Gate, /database_trigger\.tginitdeferred/);

  for (const marker of [
    "CREATE FUNCTION public.list_my_communication_inbox",
    "CREATE FUNCTION public.open_direct_communication_thread",
    "CREATE FUNCTION public.list_my_assistant_conversations",
    "CREATE FUNCTION public.schedule_lesson_run_if_unchanged",
    "CREATE FUNCTION public.append_assistant_turn_admin",
    "CREATE FUNCTION public.append_system_notification_admin",
    "CREATE CONSTRAINT TRIGGER trg_lesson_run_communication_notifications",
    "CREATE TRIGGER trg_communication_message_recompute_thread_after_delete",
  ]) {
    assert.equal(generatedMarkers.includes(marker), true, marker);
  }
});
