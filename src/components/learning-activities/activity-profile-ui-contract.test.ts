import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const client = source(
  "src/components/learning-activities/activity-profile-client.ts",
);
const activitySections = source(
  "src/components/learning-activities/activity-profile-sections.tsx",
);
const teacherActivitySections = source(
  "src/components/learning-activities/teacher-activity-profile-sections.tsx",
);
const teacherHistory = source(
  "src/components/lesson-runs/learner-history-dialog.tsx",
);
const runHistory = source("src/components/lesson-runs/run-history-list.tsx");
const historyClient = source("src/components/lesson-runs/lesson-run-client.ts");
const evidenceHistoryFormat = source(
  "src/components/learning-activities/evidence-history-format.ts",
);
const selfProfile = source(
  "src/components/learner-identity/learning-profile-workspace.tsx",
);
const observing = source(
  "src/components/learner-identity/observing-workspace.tsx",
);
const legacyProfileRoute = source("src/app/(app)/learning-profile/page.tsx");

test("manual profile workflow uses the existing profile and students shells", () => {
  assert.match(selfProfile, /value: "history",\s*label: "История"/);
  assert.match(selfProfile, /value: "skills",\s*label: "Навыки"/);
  assert.match(
    selfProfile,
    /value: "recommendations",\s*label: "Рекомендации"/,
  );
  assert.match(selfProfile, /<SafeActivityProfileSection/);
  assert.match(observing, /<SafeActivityProfileSection/);
  assert.match(teacherHistory, /<TeacherActivityProfileSections/);
  assert.match(legacyProfileRoute, /redirect\(profileCompatibilityHref/);
  assert.doesNotMatch(legacyProfileRoute, /LearningProfileWorkspace/);
});

test("client integration reloads durable server projections without browser-side storage or table writes", () => {
  for (const path of [
    "/api/v2/me/learning-profile/activity-profile",
    "/api/v2/observations/",
    "/api/v2/learner-profiles/",
  ]) {
    assert.match(client, new RegExp(path.replaceAll("/", "\\/")));
  }
  assert.match(client, /activity-profile\/corrections/);
  assert.match(client, /method: "POST"/);
  assert.match(client, /activity-profile\/recommendation-overrides/);
  assert.match(client, /method: "PUT"/);
  assert.doesNotMatch(client, /localStorage|indexedDB|\/rest\/v1/);
  assert.match(
    teacherHistory,
    /await correctTeacherObservation[\s\S]*?await load\(\)/,
  );
  assert.match(
    teacherHistory,
    /await setTeacherRecommendationOverride[\s\S]*?await load\(\)/,
  );
  assert.match(
    teacherHistory,
    /void loadTeacherActivityProfile\(profile\.id\)/,
  );
  assert.match(teacherHistory, /const history = await loadLearnerHistory/);
  assert.match(teacherHistory, /История доступна, но навыки и рекомендации/);
  assert.match(
    teacherHistory,
    /setEvidenceUnavailable\(history\.evidenceUnavailable\)/,
  );
  assert.match(
    teacherHistory,
    /История и наблюдения доступны, но свидетельства профиля/,
  );
  assert.match(teacherHistory, /Повторить загрузку свидетельств/);
  assert.match(
    observing,
    /void loadObservedActivityProfile\(learnerProfileId\)/,
  );
  assert.match(
    observing,
    /Promise\.allSettled\(\[\s*loadObservedProgress\(learnerProfileId\),\s*loadObservedHistory\(learnerProfileId\),\s*\]\)/,
  );
  assert.match(selfProfile, /void loadSelfActivityProfile\(\)/);
  assert.match(observing, /isProjectionAccessFailure/);
  assert.match(observing, /Навыки временно недоступны/);
});

test("history corrections and recommendation overrides remain explicit teacher actions", () => {
  assert.match(teacherHistory, /Исправить итог/);
  assert.match(teacherHistory, /Причина исправления/);
  assert.match(teacherHistory, /Исходная запись останется в истории/);
  assert.match(teacherHistory, /globalThis\.crypto\.randomUUID\(\)/);
  assert.match(
    teacherHistory,
    /setCorrectionIdempotencyKey\(globalThis\.crypto\.randomUUID\(\)\)/,
  );
  assert.match(teacherHistory, /idempotencyKey: correctionIdempotencyKey/);
  assert.match(teacherActivitySections, /Заменить рекомендацию/);
  assert.match(teacherActivitySections, /Скрыть рекомендацию/);
  assert.match(teacherActivitySections, /Вернуть правило/);
  assert.match(teacherHistory, /expectedStateUpdatedAt/);
  assert.match(teacherActivitySections, /useEffect\(\(\) =>/);
  assert.match(teacherActivitySections, /setPrivateReason\(""\)/);
});

test("teacher UI renders synthesized no-data skills without an override editor", () => {
  assert.match(
    teacherActivitySections,
    /state\.status === "no_data" \|\| state\.stateId === null\) return null/,
  );
  assert.match(
    teacherActivitySections,
    /profile\.states\.filter\([\s\S]*?state\.status !== "no_data"[\s\S]*?state\.stateId !== null/,
  );
  assert.match(
    teacherActivitySections,
    /sourceCourseIdAtTime[\s\S]*?sourceLearningObjectiveIdAtTime/,
  );
  assert.match(
    teacherHistory,
    /state\.status === "no_data" \|\| state\.stateId === null/,
  );
});

test("teacher Course, Lesson and Learner histories consume durable evidence", () => {
  assert.match(historyClient, /evidence: LearningEvidence\[\]/);
  assert.match(historyClient, /corrections: LessonObservationCorrection\[\]/);
  assert.match(runHistory, /evidence\?: LearningEvidence\[\]/);
  assert.match(runHistory, /correctionsUnavailable\?: boolean/);
  assert.match(runHistory, /data-learning-evidence="true"/);
  assert.match(teacherHistory, /setEvidence\(history\.evidence\)/);
  assert.match(teacherHistory, /data-learning-evidence="true"/);
  assert.match(runHistory, /Явное исправление предыдущего результата/);
  assert.match(teacherHistory, /Явное исправление предыдущего результата/);
  assert.match(teacherHistory, /<CorrectionAuditList/);
  assert.match(runHistory, /<CorrectionAuditList/);
  assert.match(
    runHistory,
    /Пустой журнал сейчас не означает отсутствие исправлений/,
  );
  assert.match(
    evidenceHistoryFormat,
    /item\.sourceKind !== "observation" \|\| item\.supersededByEvidenceId/,
  );
  assert.match(evidenceHistoryFormat, /item\.sourceObservationId/);
});

test("learner and active observer render only the bounded safe projection", () => {
  const safeProjectionSource = activitySections;

  for (const safeField of [
    "state.evidenceReferences",
    "recommendation.reasonText",
    "recommendation.generatedAt",
    "evidence.evidenceAt",
  ]) {
    assert.match(
      safeProjectionSource,
      new RegExp(safeField.replace(".", "\\.")),
    );
  }
  for (const privateField of [
    "privateNote",
    "privateReason",
    "recordedByAccountId",
    "policyVersion",
    "eligibilityPolicyVersion",
    "evaluator",
  ]) {
    assert.doesNotMatch(safeProjectionSource, new RegExp(privateField));
  }

  assert.match(
    observing,
    /setProgress\(null\);[\s\S]*?setHistory\(\[\]\);[\s\S]*?setActivityProfile\(null\);[\s\S]*?setNextCursor\(null\);/,
  );
  assert.match(observing, /Доступ к профилю больше недоступен/);
  assert.match(observing, /projectionGenerationRef/);
  assert.match(observing, /selectedIdRef\.current !== learnerProfileId/);
  assert.match(observing, /loadObservedHistory\(learnerProfileId, cursor\)/);
  assert.match(
    observing,
    /projectionGenerationRef\.current \+= 1;\s*selectedIdRef\.current = null;\s*setSelectedId\(null\);[\s\S]*?await actOnObserver/,
  );
  assert.match(observing, /setProfiles\(remainingProfiles\)/);
});

test("Russian copy explains state, dates, freshness and non-adaptive recommendations", () => {
  for (const phrase of [
    "Нет данных",
    "Формируется",
    "Подтверждено",
    "Пора перепроверить",
    "Самостоятельно",
    "С поддержкой",
    "Пока не получилось",
    "Одна отметка не подтверждает",
    "не меняют порядок",
    "нет процента освоения",
  ]) {
    assert.match(
      activitySections + teacherActivitySections,
      new RegExp(phrase),
    );
  }
  assert.match(activitySections, /formatActivityDate\(evidence\.evidenceAt\)/);
  assert.doesNotMatch(activitySections, /mastery|процент мастерства/i);
});
