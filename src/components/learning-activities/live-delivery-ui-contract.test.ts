import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const teacher = source(
  "src/components/learning-activities/run-live-delivery-panel.tsx",
);
const teacherIntegration = source(
  "src/components/learning-activities/run-observation-page-client.tsx",
);
const learner = source(
  "src/components/learning-activities/learner-live-delivery.tsx",
);
const learnerPage = source("src/app/(live)/live/[lessonRunId]/page.tsx");
const learnerLayout = source("src/app/(live)/layout.tsx");
const teacherCss = source(
  "src/components/learning-activities/run-live-delivery-panel.module.css",
);

test("focused Run owns an explicit cursor and two-layer learner access UI", () => {
  assert.match(teacher, /Курсор показа/);
  assert.match(teacher, /expectedRevision: delivery\.cursor\.revision/);
  assert.match(teacher, /courseAccessEnabled/);
  assert.match(teacher, /runCapabilityEnabled/);
  assert.match(teacher, /Аудитория и roster не дают права автоматически/);
  assert.match(
    teacher,
    /Курсор не связан с текущим[\s\S]*?компонентом наблюдения/,
  );
  assert.match(teacher, /slide\.componentCount > 0/);
  assert.match(teacher, /cursorLocked \|\| slide\.componentCount === 0/);
  assert.match(teacher, /нет learner-visible компонентов/);
  assert.match(teacher, /validSlides\.length === 0/);
  assert.match(teacher, /aria-pressed=\{delivery\.cursor\.slideId === null\}/);
  assert.match(
    teacher,
    /aria-pressed=\{slide\.id === delivery\.cursor\.slideId\}/,
  );
  assert.match(
    teacher,
    /aria-label=\{`Доступ к курсу для \$\{learner\.displayName\}, ученик \$\{learnerIndex \+ 1\}`\}/,
  );
  assert.match(
    teacher,
    /aria-label=\{`Доступ к этому запуску для \$\{learner\.displayName\}, ученик \$\{learnerIndex \+ 1\}`\}/,
  );
  assert.match(teacher, /const accessLocked = pendingLearnerId !== null/);
  assert.match(teacher, /disabled=\{[\s\S]*?accessLocked[\s\S]*?offline/);
  assert.match(
    teacher,
    /delivery\.run\.ended && !learner\.courseAccessEnabled/,
  );
  assert.match(teacher, /Ссылка на live-урок скопирована/);
  assert.match(
    teacher,
    /loading \|\|[\s\S]*?cursorPending \|\|[\s\S]*?pendingLearnerId/,
  );
  assert.doesNotMatch(teacher, /teacherComment|learningRecordId/);
  assert.match(
    teacherIntegration,
    /key=\{`\$\{lessonRunId\}:\$\{workspace\.run\.updatedAt\}`\}/,
  );
});

test("learner live surface polls without overlap and handles every fail-closed state", () => {
  assert.match(learner, /const POLL_INTERVAL_MS = 2_000/);
  assert.match(learner, /const POLL_REQUEST_TIMEOUT_MS = 6_000/);
  assert.match(learner, /if \(running \|\| stopped/);
  assert.match(learner, /AbortController/);
  assert.match(learner, /visibilitychange/);
  assert.match(learner, /generation !== generationRef\.current/);
  assert.match(learner, /requestController\.signal\.aborted/);
  assert.match(learner, /learnerLiveDeliveryResponseSchema\.safeParse/);
  assert.match(
    learner,
    /response\.status === 400[\s\S]*?kind: "denied"[\s\S]*?GENERIC_DENIED_MESSAGE/,
  );
  assert.match(learner, /LiveFrame/);
  assert.match(learner, /Показывается слайд/);
  for (const state of [
    "loading",
    "waiting",
    "reconnecting",
    "denied",
    "ended",
  ]) {
    assert.match(learner, new RegExp(`\\b${state}\\b`));
  }
  assert.match(
    learner,
    /Содержимое скрыто до следующей успешной проверки доступа/,
  );
  assert.match(learner, /interaction="presentation"/);
  assert.doesNotMatch(
    learner,
    /Предыдущий слайд|Следующий слайд|teacherComment/,
  );
});

test("learner route preserves an exact safe live return path in its chrome-free layout", () => {
  assert.match(learnerPage, /LearnerLiveDelivery/);
  assert.match(learnerPage, /resolveAccessPolicy/);
  assert.match(learnerPage, /toLearnerLiveRoute\(lessonRunId\)/);
  assert.match(
    learnerPage,
    /redirect\(`\$\{ROUTES\.login\}\?next=\$\{encodeURIComponent\(next\)\}`\)/,
  );
  assert.doesNotMatch(learnerLayout, /PersistentTopNav|CommunicationCenter/);
});

test("teacher live motion fully stops for reduced-motion users", () => {
  assert.match(
    teacherCss,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.spin[\s\S]*?animation: none/,
  );
  assert.match(
    teacherCss,
    /\.slideList button:focus-visible,[\s\S]*?\.learnerRow input:focus-visible \{[\s\S]*?outline: 3px solid #7c3aed/,
  );
  assert.match(
    teacherCss,
    /\.cardHeading > span \{[\s\S]*?background: #f3f4f6;[\s\S]*?color: #4b5563/,
  );
});
