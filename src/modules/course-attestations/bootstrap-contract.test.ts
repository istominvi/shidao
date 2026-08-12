import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bootstrapPath = "scripts/bootstrap-chinese-educator-attestation.sql";
const bootstrap = readFileSync(bootstrapPath, "utf8");

function dollarQuotedJson(tag: string) {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `\\$${escapedTag}\\$([\\s\\S]*?)\\$${escapedTag}\\$::jsonb`,
  ).exec(bootstrap);
  assert.ok(match?.[1], `Missing $${tag}$ JSON fixture`);
  return JSON.parse(match[1]) as unknown;
}

test("educator bootstrap requires explicit Accounts and validates ShiDao before writes", () => {
  const persistentWrite = bootstrap.indexOf(
    "insert into public.course as target_course (",
  );

  assert.match(bootstrap, /\\if :\{\?publisher_account_id\}/);
  assert.match(bootstrap, /\\if :\{\?attested_account_id\}/);
  assert.match(bootstrap, /bootstrap_publisher_account_not_active/);
  assert.match(bootstrap, /bootstrap_attested_account_not_active/);
  assert.match(
    bootstrap,
    /join auth\.users as auth_user on auth_user\.id = account\.auth_user_id/g,
  );
  assert.match(bootstrap, /account\.status = 'active'/);
  assert.match(bootstrap, /shidao_schema_sanity_check_failed/);
  assert.match(bootstrap, /public\.lesson_step/);
  assert.match(
    bootstrap,
    /submit_my_course_publication_attestation\(uuid,uuid,jsonb\)/,
  );
  assert.ok(persistentWrite > 0);
  assert.ok(
    bootstrap.indexOf("shidao_schema_sanity_check_failed") < persistentWrite,
  );

  assert.doesNotMatch(bootstrap, /@[A-Za-z0-9.-]+/);
  assert.doesNotMatch(
    bootstrap,
    /['"][0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}['"]/i,
  );
});

test("educator bootstrap owns a deterministic idempotent six-Lesson fixture", () => {
  const lessonFixture =
    /insert into pg_temp\.shidao_chinese_educator_lessons[\s\S]*?\n  \);/.exec(
      bootstrap,
    )?.[0];
  assert.ok(lessonFixture);
  assert.equal(lessonFixture.match(/^  \(\n    \d,/gm)?.length, 6);

  assert.match(
    bootstrap,
    /md5\('shidao\.bootstrap\.chinese-educator\.course\.v1'\)::uuid/,
  );
  assert.match(bootstrap, /pg_advisory_xact_lock/);
  assert.match(bootstrap, /on conflict \(id\) do update/g);
  assert.match(bootstrap, /is distinct from/g);
  assert.match(bootstrap, /target_lesson_count,[\s\S]*?\n  6,/);
  assert.doesNotMatch(bootstrap, /gen_random_uuid\(\)/);
  assert.doesNotMatch(bootstrap, /\bdelete\s+from\b/i);
  assert.match(
    bootstrap,
    /'Современный урок китайского языка для детей: произношение, иероглифика и формирующее оценивание'/,
  );
  assert.match(bootstrap, /'Методика преподавания китайского языка'/);
  assert.match(bootstrap, /'Профессиональное развитие педагогов'/);
  assert.match(bootstrap, /работающие с детьми 6–14 лет/);
});

test("educator bootstrap records a real 9/10 pass only through scoring RPC", () => {
  const questions = dollarQuotedJson("questions") as Array<{
    id: string;
    correctOptionId: string;
    options: Array<{ id: string; label: string }>;
  }>;
  const answers = dollarQuotedJson("answers") as Record<string, string>;

  assert.equal(questions.length, 10);
  assert.equal(Object.keys(answers).length, 10);
  const mistakes = questions.filter(
    (question) => answers[question.id] !== question.correctOptionId,
  );
  assert.deepEqual(
    mistakes.map((question) => question.id),
    ["q8"],
  );
  assert.equal(
    questions.every((question) => question.options.length >= 2),
    true,
  );

  assert.match(bootstrap, /passing_score_percent,[\s\S]*?\n  80,/);
  assert.match(bootstrap, /set local role authenticated/);
  assert.match(bootstrap, /'request\.jwt\.claim\.sub'/);
  assert.match(
    bootstrap,
    /public\.submit_my_course_publication_attestation\([\s\S]*?:'shidao_fixture_publication_id'::uuid,[\s\S]*?:'shidao_fixture_revision_id'::uuid,[\s\S]*?:'shidao_fixture_answers'::jsonb/,
  );
  assert.doesNotMatch(
    bootstrap,
    /insert\s+into\s+public\.course_attestation_(?:attempt|award)/i,
  );
  assert.match(bootstrap, /v_attempt\.correct_answer_count <> 9/);
  assert.match(bootstrap, /v_attempt\.score_percent <> 90/);
  assert.match(bootstrap, /v_attempt\.passing_score_percent <> 80/);
});

test("educator bootstrap publishes through the attestation-aware wrapper", () => {
  assert.match(
    bootstrap,
    /public\.publish_course_revision_with_attestation_admin\(/,
  );
  assert.match(bootstrap, /p_learning_audience => 'educators'/);
  assert.match(bootstrap, /p_attestation => fixture\.attestation/);
  assert.match(bootstrap, /p_asset_manifest => '\[\]'::jsonb/);
  assert.match(bootstrap, /publication\.status = 'published'/);
  assert.match(bootstrap, /publication\.learning_audience = 'educators'/);
});
