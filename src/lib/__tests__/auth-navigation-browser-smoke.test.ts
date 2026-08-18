import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import sharp from "sharp";
import {
  buildAppSessionSupabaseTokens,
  createAppSessionPayload,
  sealAppSession,
} from "../server/app-session";

const APP_SESSION_SECRET = "e2e-app-session-secret-value-with-minimum-32-chars";
const E2E_ADULT_USER_ID = "11111111-1111-4111-8111-111111111111";
const E2E_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const E2E_TEACHER_ID = "55555555-5555-4555-8555-555555555555";
const E2E_SCHOOL_ID = "66666666-6666-4666-8666-666666666666";
const E2E_COURSE_ID = "33333333-3333-4333-8333-333333333333";
const E2E_SECOND_COURSE_ID = "33333333-3333-4333-8333-333333333334";
const E2E_EDUCATOR_COURSE_ID = "eb697b66-8655-6939-3d2c-cdf193935004";
const E2E_EDUCATOR_PUBLICATION_ID = "cdcccb90-aab2-302e-3736-fdf6fedd59ba";
const E2E_EDUCATOR_REVISION_ID = "498c525d-7b9e-9123-e185-aa85aab38fda";
const E2E_EDUCATOR_LESSON_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const E2E_EDUCATOR_SLIDE_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const E2E_EDUCATOR_LEARNER_COMPONENT_REF =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const E2E_EDUCATOR_STAFF_COMPONENT_REF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const E2E_EDUCATOR_ATTESTATION_ATTEMPT_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5";
const E2E_LESSON_ID = "44444444-4444-4444-8444-444444444444";
const E2E_SECOND_LESSON_ID = "44444444-4444-4444-8444-444444444445";
const E2E_COMPONENT_ID = "77777777-7777-4777-8777-777777777771";
const E2E_EXERCISE_COMPONENT_ID = "77777777-7777-4777-8777-777777777773";
const E2E_STUDENT_SLIDE_ID = "77777777-7777-4777-8777-777777777770";
const E2E_STORED_FILE_ID = "77777777-7777-4777-8777-777777777772";
const E2E_LEARNER_ANNA_ID = "88888888-8888-4888-8888-888888888881";
const E2E_LEARNER_BORIS_ID = "88888888-8888-4888-8888-888888888882";
const E2E_LEARNER_CLARA_ID = "88888888-8888-4888-8888-888888888883";
const E2E_SELF_LEARNER_ID = "88888888-8888-4888-8888-888888888884";
const E2E_ARCHIVED_LEARNER_ID = "88888888-8888-4888-8888-888888888885";
const E2E_CONNECTION_ID = "88888888-8888-4888-8888-888888888886";
const E2E_OBSERVER_GRANT_ID = "88888888-8888-4888-8888-888888888887";
const E2E_OBSERVER_INVITATION_ID = "88888888-8888-4888-8888-888888888888";
const E2E_OUTGOING_OBSERVER_INVITATION_ID =
  "88888888-8888-4888-8888-888888888897";
const E2E_AI_CONSENT_ID = "88888888-8888-4888-8888-888888888889";
const E2E_PROFILE_INVITATION_ID = "88888888-8888-4888-8888-888888888890";
const E2E_CHILD_INVITATION_ID = "88888888-8888-4888-8888-888888888891";
const E2E_MERGE_INVITATION_ID = "88888888-8888-4888-8888-888888888892";
const E2E_MERGE_OPERATION_ID = "88888888-8888-4888-8888-888888888893";
const E2E_RECOVERY_GRANT_ID = "88888888-8888-4888-8888-888888888894";
const E2E_COMPLETION_PRIVATE_RUN_ID = "88888888-8888-4888-8888-888888888895";
const E2E_COMPLETION_PUBLISHED_RUN_ID = "88888888-8888-4888-8888-888888888896";
const E2E_GROUP_TEEN_ID = "99999999-9999-4999-8999-999999999991";
const E2E_GROUP_EXAM_ID = "99999999-9999-4999-8999-999999999992";
const E2E_COURSE_TITLE = "Английский для жизни";
const E2E_EDUCATOR_COURSE_TITLE =
  "Современный урок китайского языка для детей: произношение, иероглифика и формирующее оценивание";
const E2E_EDUCATOR_LESSON_TITLE = "Цели современного урока";
const E2E_EDUCATOR_LEARNER_TEXT =
  "Наблюдаемая цель описывает действие ученика.";
const E2E_EDUCATOR_PRIVATE_TEXT = "PRIVATE EDUCATOR PLAN — только автору курса";
const E2E_LESSON_TITLE = "Present Perfect · жизненный опыт";
const E2E_SUPABASE_ACCESS_TOKEN = "e2e-supabase-user-access-token";
const E2E_FOREIGN_ACCOUNT_ID = "22222222-2222-4222-8222-222222222229";
const E2E_PRIVATE_SELF_COMMENT = "PRIVATE SELF COMMENT — только преподавателю";
const E2E_PUBLISHED_OBSERVED_COMMENT =
  "Опубликованный комментарий Бориса из completion UI.";
const E2E_PUBLISHED_SELF_COMMENT =
  "Опубликованный комментарий E2E Adult из completion UI.";
const E2E_PRIVATE_OBSERVED_COMMENT =
  "PRIVATE OBSERVED COMMENT — только преподавателю";
const E2E_RAISED_CONTROL_SHADOW = "oklch(0 0 0 / 0.05) 0px 1px 6px 0px";
const E2E_RAISED_CONTROL_HOVER_SHADOW = "oklch(0 0 0 / 0.16) 0px 4px 10px -2px";
const E2E_RAISED_CONTROL_PRESSED_SHADOW = "oklch(0 0 0 / 0.14) 0px 1px 3px 0px";
const E2E_RAISED_SURFACE_SHADOW = E2E_RAISED_CONTROL_SHADOW;
const E2E_ENTRY_CONTROL_SHADOW = E2E_RAISED_SURFACE_SHADOW;
const E2E_PRODUCT_SURFACE_BORDER_COLOR = "oklch(0 0 0 / 0.1)";
const E2E_PRODUCT_SURFACE_BORDER_WIDTH = "1px";
const E2E_PRODUCT_SURFACE_BACKGROUND_CLIP = "padding-box";
const E2E_PRODUCT_HEADER_SHADOW = "oklch(0 0 0 / 0.05) 0px 6px 12px 0px";
const E2E_RAISED_CONTROL_HOVER_TRANSFORM = "matrix(1, 0, 0, 1, 0, -1)";
const E2E_FOCUS_HALO_COLOR = "rgba(20, 20, 20, 0.58)";
const E2E_MUTED_FOREGROUND = "oklch(0.19 0 0 / 0.6)";
const E2E_WORKSPACE_TABS_DIVIDER = "oklch(0.19 0 0 / 0.4)";
const E2E_SEGMENTED_CONTROL_BACKGROUND = E2E_PRODUCT_SURFACE_BORDER_COLOR;
const E2E_DROPDOWN_SHADOW = "rgba(20, 20, 20, 0.24) 0px 24px 32px -24px";

function assertSegmentedSurfaceShadow(
  actual: string,
  expectedOuterShadow: string,
  label: string,
) {
  assert.doesNotMatch(actual, /\binset\b/, `${label}: no inset boundary`);
  assert.equal(
    actual,
    expectedOuterShadow,
    `${label}: one outer elevation matches the ordinary control exactly`,
  );
}

type OpaqueWhiteSurfaceContract = {
  backgroundColor: string;
  backgroundImage: string;
  opacity: string;
  backdropFilter: string;
};

type LucideGlyphContract = {
  width: number;
  height: number;
  strokeWidth: string;
  vectorEffect: string;
};

type RaisedControlSurfaceContract = {
  borderTopWidth: string;
  borderTopStyle: string;
  borderTopColor: string;
  borderRadius: string;
  backgroundColor: string;
  backgroundImage: string;
  backgroundClip: string;
  boxShadow: string;
};

type TouchSegmentedControlContract = {
  group: {
    width: number;
    height: number;
    padding: string;
    gap: string;
    borderTopWidth: string;
    borderTopStyle: string;
    borderTopColor: string;
    borderRadius: string;
    backgroundColor: string;
    backgroundClip: string;
    boxShadow: string;
  };
  groupIndicatorReady: string | null;
  groupBeforeContent: string;
  indicatorCount: number;
  indicator: {
    surface: RaisedControlSurfaceContract;
    width: number;
    height: number;
    opacity: string;
    display: string;
    pointerEvents: string;
    backdropFilter: string;
    zIndex: string;
    ariaHidden: string | null;
    ready: string | null;
    motionReady: string | null;
    transitionProperty: string;
    transitionDuration: string;
    transitionTimingFunction: string;
    selectedStartDelta: number;
    selectedTopDelta: number;
    selectedWidthDelta: number;
    selectedHeightDelta: number;
  };
  optionWidths: number[];
  optionHeights: number[];
  seamGaps: number[];
  optionRadii: string[];
  iconStyles: LucideGlyphContract[];
  referenceButton: RaisedControlSurfaceContract;
  selected: {
    surface: RaisedControlSurfaceContract;
    transform: string;
    beforeContent: string;
  };
  inactive: {
    borderTopWidth: string;
    borderTopStyle: string;
    backgroundColor: string;
    backgroundImage: string;
    boxShadow: string;
    transform: string;
    beforeContent: string;
  };
};

const E2E_OPAQUE_WHITE_SURFACE: OpaqueWhiteSurfaceContract = {
  backgroundColor: "rgb(255, 255, 255)",
  backgroundImage: "none",
  opacity: "1",
  backdropFilter: "none",
};

function assertOpaqueWhiteSurface(
  actual: OpaqueWhiteSurfaceContract,
  label: string,
) {
  assert.deepEqual(actual, E2E_OPAQUE_WHITE_SURFACE, `${label}: opaque white`);
}

function assertTouchSegmentedControl(
  actual: TouchSegmentedControlContract,
  label: string,
) {
  assert.deepEqual(
    actual.group,
    {
      width: 80,
      height: 40,
      padding: "0px",
      gap: "2px",
      borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      borderTopStyle: "solid",
      borderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
      borderRadius: "12px",
      backgroundColor: E2E_SEGMENTED_CONTROL_BACKGROUND,
      backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      boxShadow: "none",
    },
    `${label}: exact bordered 80x40 two-cell group with a two-pixel seam`,
  );
  assert.ok(
    ["none", "normal"].includes(actual.groupBeforeContent),
    `${label}: group must not paint a ::before track`,
  );
  assert.equal(actual.groupIndicatorReady, "true");
  assert.equal(actual.indicatorCount, 1, `${label}: one shared indicator`);
  assert.deepEqual(actual.optionWidths, [38, 38], `${label}: 38px cells`);
  assert.deepEqual(actual.optionHeights, [38, 38], `${label}: 38px cells`);
  assert.deepEqual(actual.seamGaps, [2], `${label}: two-pixel seam`);
  assert.deepEqual(actual.optionRadii, ["11px", "11px"]);
  assert.deepEqual(actual.iconStyles, [
    {
      width: 16,
      height: 16,
      strokeWidth: "2px",
      vectorEffect: "none",
    },
    {
      width: 16,
      height: 16,
      strokeWidth: "2px",
      vectorEffect: "none",
    },
  ]);
  assert.deepEqual(
    actual.referenceButton,
    {
      borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      borderTopStyle: "solid",
      borderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
      borderRadius: "12px",
      backgroundColor: "rgb(255, 255, 255)",
      backgroundImage: "none",
      backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      boxShadow: E2E_RAISED_CONTROL_SHADOW,
    },
    `${label}: live ordinary button surface`,
  );
  assert.equal(
    actual.group.backgroundColor,
    actual.referenceButton.borderTopColor,
    `${label}: group track reuses the ordinary button border color`,
  );
  assert.equal(
    actual.group.borderTopColor,
    actual.referenceButton.borderTopColor,
    `${label}: group border reuses the ordinary button border color`,
  );
  assert.deepEqual(
    {
      borderTopWidth: actual.indicator.surface.borderTopWidth,
      borderTopStyle: actual.indicator.surface.borderTopStyle,
      borderRadius: actual.indicator.surface.borderRadius,
      backgroundColor: actual.indicator.surface.backgroundColor,
      backgroundImage: actual.indicator.surface.backgroundImage,
      backgroundClip: actual.indicator.surface.backgroundClip,
      width: actual.indicator.width,
      height: actual.indicator.height,
      opacity: actual.indicator.opacity,
      display: actual.indicator.display,
      pointerEvents: actual.indicator.pointerEvents,
      backdropFilter: actual.indicator.backdropFilter,
      zIndex: actual.indicator.zIndex,
      ariaHidden: actual.indicator.ariaHidden,
      ready: actual.indicator.ready,
      motionReady: actual.indicator.motionReady,
      transitionProperty: actual.indicator.transitionProperty,
      transitionDuration: actual.indicator.transitionDuration,
      transitionTimingFunction: actual.indicator.transitionTimingFunction,
    },
    {
      borderTopWidth: "0px",
      borderTopStyle: "none",
      borderRadius: "11px",
      backgroundColor: actual.referenceButton.backgroundColor,
      backgroundImage: actual.referenceButton.backgroundImage,
      backgroundClip: actual.referenceButton.backgroundClip,
      width: 38,
      height: 38,
      opacity: "1",
      display: "block",
      pointerEvents: "none",
      backdropFilter: "none",
      zIndex: "0",
      ariaHidden: "true",
      ready: "true",
      motionReady: "true",
      transitionProperty: "width, transform, opacity",
      transitionDuration: "0.36s, 0.36s, 0.12s",
      transitionTimingFunction:
        "cubic-bezier(0.22, 1, 0.36, 1), cubic-bezier(0.22, 1, 0.36, 1), ease",
    },
    `${label}: one opaque raised indicator reuses the ordinary button surface`,
  );
  assertSegmentedSurfaceShadow(
    actual.indicator.surface.boxShadow,
    actual.referenceButton.boxShadow,
    `${label}: selected surface shadow`,
  );
  for (const [axis, delta] of Object.entries({
    start: actual.indicator.selectedStartDelta,
    top: actual.indicator.selectedTopDelta,
    width: actual.indicator.selectedWidthDelta,
    height: actual.indicator.selectedHeightDelta,
  })) {
    assert.ok(
      delta < 0.5,
      `${label}: indicator ${axis} must align to the selected option; got ${delta}`,
    );
  }
  assert.deepEqual(
    {
      borderTopWidth: actual.selected.surface.borderTopWidth,
      borderTopStyle: actual.selected.surface.borderTopStyle,
    },
    {
      borderTopWidth: "0px",
      borderTopStyle: "none",
    },
    `${label}: selected option has no independent border over the shared track`,
  );
  assert.deepEqual(
    {
      backgroundColor: actual.selected.surface.backgroundColor,
      backgroundImage: actual.selected.surface.backgroundImage,
      backgroundClip: actual.selected.surface.backgroundClip,
      boxShadow: actual.selected.surface.boxShadow,
    },
    {
      backgroundColor: "rgba(0, 0, 0, 0)",
      backgroundImage: "none",
      backgroundClip: "border-box",
      boxShadow: "none",
    },
    `${label}: selected option stays transparent above the shared indicator`,
  );
  assert.equal(
    actual.selected.surface.borderRadius,
    "11px",
    `${label}: selected option radius stays concentric inside the one-pixel group border`,
  );
  assert.equal(actual.selected.transform, "none");
  assert.ok(
    ["none", "normal"].includes(actual.selected.beforeContent),
    `${label}: selected option must not paint a ::before plate`,
  );
  assert.deepEqual(
    actual.inactive,
    {
      borderTopWidth: "0px",
      borderTopStyle: "none",
      backgroundColor: "rgba(0, 0, 0, 0)",
      backgroundImage: "none",
      boxShadow: "none",
      transform: "none",
      beforeContent: "none",
    },
    `${label}: inactive option stays transparent over the group track`,
  );
}

const E2E_COURSE_ROW = {
  id: E2E_COURSE_ID,
  owner_account_id: E2E_ACCOUNT_ID,
  title: E2E_COURSE_TITLE,
  learning_audience: "children",
  subject: "Английский язык",
  goal: "Научиться уверенно рассказывать о жизненном опыте.",
  level: "A2–B1",
  audience_description: "Взрослые ученики",
  target_lesson_count: 8,
  teacher_preferences: null,
  audience_type: "none",
  assembled_at: null,
  archived_at: null,
  created_at: "2026-08-05T08:00:00.000Z",
  updated_at: "2026-08-05T09:00:00.000Z",
  publication_content_updated_at: "2026-08-05T09:00:00.000Z",
};

const E2E_SECOND_COURSE_ROW = {
  ...E2E_COURSE_ROW,
  id: E2E_SECOND_COURSE_ID,
  title: "Японский для путешествий",
  subject: "Японский язык",
  goal: "Освоить основные фразы для поездки.",
  level: "Начальный",
  target_lesson_count: 6,
  created_at: "2026-08-06T08:00:00.000Z",
  updated_at: "2026-08-06T09:00:00.000Z",
  publication_content_updated_at: "2026-08-06T09:00:00.000Z",
};

const E2E_LESSON_BASE_ROW = {
  id: E2E_LESSON_ID,
  course_id: E2E_COURSE_ID,
  position: 4,
  title: E2E_LESSON_TITLE,
  summary: "Связываем форму времени с реальными историями ученика.",
  components: [
    {
      id: E2E_COMPONENT_ID,
      lesson_id: E2E_LESSON_ID,
      type_key: "file",
      schema_version: 1,
      position: 1,
      payload: {
        storedFileId: E2E_STORED_FILE_ID,
        label: "Карточка жизненного опыта",
        openMode: "preview",
      },
      placement_config: { width: "content", display: "card" },
      visibility: "staff_only",
      student_slide_id: null,
      created_at: "2026-08-05T08:40:00.000Z",
      updated_at: "2026-08-05T09:00:00.000Z",
    },
  ],
  studentSlides: [],
  created_at: "2026-08-05T08:30:00.000Z",
  updated_at: "2026-08-05T09:00:00.000Z",
};

type E2EStudentScreenRpcPayload = {
  p_component_id: string;
  p_mode: "hide" | "existing" | "new";
  p_slide_id: string | null;
};

let e2eComponentLearnerVisible = false;
let e2eAuthoredExerciseVisible = false;
const e2eStudentScreenRpcPayloads: E2EStudentScreenRpcPayload[] = [];

function e2eLessonComponentRow() {
  const component = E2E_LESSON_BASE_ROW.components[0]!;
  return {
    ...component,
    visibility: e2eComponentLearnerVisible
      ? ("learner_visible" as const)
      : ("staff_only" as const),
    student_slide_id: e2eComponentLearnerVisible ? E2E_STUDENT_SLIDE_ID : null,
  };
}

function e2eAuthoredExerciseComponentRow() {
  return {
    id: E2E_EXERCISE_COMPONENT_ID,
    lesson_id: E2E_LESSON_ID,
    type_key: "fill_blanks" as const,
    schema_version: 1,
    position: 2,
    payload: {
      instruction: "Заполните пропуски",
      template: "I have [[1]] there and [[2]] tea.",
      answers: [{ accepted: ["been"] }, { accepted: ["drunk"] }],
    },
    placement_config: { width: "content", compact: false },
    visibility: "staff_only" as const,
    student_slide_id: null,
    created_at: "2026-08-05T08:45:00.000Z",
    updated_at: "2026-08-05T09:00:00.000Z",
  };
}

function e2eLessonRow() {
  return {
    ...E2E_LESSON_BASE_ROW,
    components: [
      e2eLessonComponentRow(),
      ...(e2eAuthoredExerciseVisible
        ? [e2eAuthoredExerciseComponentRow()]
        : []),
    ],
    studentSlides: e2eComponentLearnerVisible
      ? [
          {
            id: E2E_STUDENT_SLIDE_ID,
            lesson_id: E2E_LESSON_ID,
            position: 1,
            created_at: "2026-08-05T09:00:00.000Z",
            updated_at: "2026-08-05T09:00:00.000Z",
          },
        ]
      : [],
  };
}

const E2E_SECOND_LESSON_ROW = {
  id: E2E_SECOND_LESSON_ID,
  course_id: E2E_COURSE_ID,
  position: 2,
  title: "Travel English · airport",
  summary: "Практикуем диалоги в аэропорту и полезные вопросы.",
  components: [],
  studentSlides: [],
  created_at: "2026-08-04T08:30:00.000Z",
  updated_at: "2026-08-04T09:00:00.000Z",
};

const E2E_TEACHER_LEARNER_ROWS = [
  {
    teacher_account_id: E2E_ACCOUNT_ID,
    learner_profile_id: E2E_LEARNER_ANNA_ID,
    display_name: "Анна Петрова",
    archived_at: null,
    created_at: "2026-08-05T10:00:00.000Z",
    updated_at: "2026-08-05T10:00:00.000Z",
  },
  {
    teacher_account_id: E2E_ACCOUNT_ID,
    learner_profile_id: E2E_LEARNER_BORIS_ID,
    display_name: "Борис Волков",
    archived_at: null,
    created_at: "2026-08-05T10:01:00.000Z",
    updated_at: "2026-08-05T10:01:00.000Z",
  },
  {
    teacher_account_id: E2E_ACCOUNT_ID,
    learner_profile_id: E2E_LEARNER_CLARA_ID,
    display_name: "Клара Смирнова",
    archived_at: null,
    created_at: "2026-08-05T10:02:00.000Z",
    updated_at: "2026-08-05T10:02:00.000Z",
  },
  {
    teacher_account_id: E2E_ACCOUNT_ID,
    learner_profile_id: E2E_SELF_LEARNER_ID,
    display_name: "E2E Adult",
    archived_at: null,
    created_at: "2026-08-05T10:03:00.000Z",
    updated_at: "2026-08-05T10:03:00.000Z",
  },
];

const E2E_LEARNER_GROUP_ROWS = [
  {
    id: E2E_GROUP_TEEN_ID,
    owner_account_id: E2E_ACCOUNT_ID,
    name: "Teen Talk",
    created_at: "2026-08-05T11:00:00.000Z",
    updated_at: "2026-08-05T11:00:00.000Z",
  },
  {
    id: E2E_GROUP_EXAM_ID,
    owner_account_id: E2E_ACCOUNT_ID,
    name: "Подготовка к экзамену",
    created_at: "2026-08-05T11:01:00.000Z",
    updated_at: "2026-08-05T11:01:00.000Z",
  },
];

const E2E_LEARNER_GROUP_MEMBER_ROWS = [
  {
    learner_group_id: E2E_GROUP_TEEN_ID,
    learner_profile_id: E2E_LEARNER_ANNA_ID,
    created_at: "2026-08-05T11:10:00.000Z",
  },
  {
    learner_group_id: E2E_GROUP_TEEN_ID,
    learner_profile_id: E2E_LEARNER_BORIS_ID,
    created_at: "2026-08-05T11:11:00.000Z",
  },
  {
    learner_group_id: E2E_GROUP_EXAM_ID,
    learner_profile_id: E2E_LEARNER_BORIS_ID,
    created_at: "2026-08-05T11:12:00.000Z",
  },
  {
    learner_group_id: E2E_GROUP_EXAM_ID,
    learner_profile_id: E2E_LEARNER_CLARA_ID,
    created_at: "2026-08-05T11:13:00.000Z",
  },
];

type E2ELearningRecordRow = {
  id: string;
  learner_profile_id: string;
  recorded_by_account_id: string;
  lesson_run_id: string | null;
  source_course_id: string | null;
  source_lesson_id: string | null;
  occurred_at: string | null;
  was_present: boolean | null;
  needs_repeat: boolean | null;
  teacher_comment: string | null;
  shared_with_learner_at?: string | null;
  actual_duration_minutes_at_time?: number | null;
  superseded_by_record_id?: string | null;
  course_title_at_time: string | null;
  lesson_title_at_time: string | null;
  subject_at_time: string | null;
  created_at: string;
  updated_at: string;
};

type E2ELessonRunRow = {
  id: string;
  lesson_id: string;
  scheduled_at: string;
  planned_duration_minutes: number;
  actual_duration_minutes: number | null;
  started_at: string | null;
  started_at_is_actual: boolean;
  ended_at: string | null;
  cancelled_at: string | null;
  teacher_report: string | null;
  created_at: string;
  updated_at: string;
};

type E2ECompletionRecordInput = {
  learnerProfileId: string;
  wasPresent: boolean;
  needsRepeat: boolean;
  teacherComment: string;
  shareWithLearner: boolean;
};

type E2ECompletionPayload = {
  p_lesson_run_id: string;
  p_teacher_report: string;
  p_actual_duration_minutes: number | null;
  p_records: E2ECompletionRecordInput[];
};

const E2E_LEARNING_RECORD_ROWS: E2ELearningRecordRow[] = [
  {
    id: "77777777-7777-4777-8777-777777777771",
    learner_profile_id: E2E_LEARNER_ANNA_ID,
    recorded_by_account_id: E2E_ACCOUNT_ID,
    lesson_run_id: null,
    source_course_id: E2E_COURSE_ID,
    source_lesson_id: E2E_LESSON_ID,
    occurred_at: "2026-08-06T09:00:00.000Z",
    was_present: true,
    needs_repeat: false,
    teacher_comment: "Уверенно использует Present Perfect.",
    course_title_at_time: E2E_COURSE_TITLE,
    lesson_title_at_time: E2E_LESSON_TITLE,
    subject_at_time: "Английский язык",
    created_at: "2026-08-06T09:00:00.000Z",
    updated_at: "2026-08-06T09:00:00.000Z",
  },
  {
    id: "77777777-7777-4777-8777-777777777772",
    learner_profile_id: E2E_LEARNER_ANNA_ID,
    recorded_by_account_id: E2E_FOREIGN_ACCOUNT_ID,
    lesson_run_id: null,
    source_course_id: null,
    source_lesson_id: null,
    occurred_at: "2026-08-06T10:00:00.000Z",
    was_present: true,
    needs_repeat: true,
    teacher_comment: "FOREIGN TRAP RECORD",
    course_title_at_time: "Чужой курс",
    lesson_title_at_time: "Чужой урок",
    subject_at_time: null,
    created_at: "2026-08-06T10:00:00.000Z",
    updated_at: "2026-08-06T10:00:00.000Z",
  },
];

const E2E_SAFE_HISTORY = {
  items: [
    {
      key: "safe-e2e-result",
      occurred_at: "2026-08-06T09:00:00.000Z",
      course_title: E2E_COURSE_TITLE,
      lesson_title: E2E_LESSON_TITLE,
      subject: "Английский язык",
      was_present: true,
      needs_repeat: false,
      actual_duration_minutes: 47,
      comment: {
        text: "Опубликованный комментарий для учебного профиля.",
        shared_at: "2026-08-06T09:05:00.000Z",
      },
    },
  ],
  next_cursor: null,
};

const E2E_PROGRESS = {
  finalized_run_count: 3,
  attended_run_count: 2,
  repeat_recommended_count: 1,
  known_actual_duration_minutes: 92,
  known_actual_duration_run_count: 2,
  last_activity_at: "2026-08-06T09:00:00.000Z",
  subjects: [
    {
      subject: "Английский язык",
      completed_run_count: 3,
      attended_run_count: 2,
      repeat_recommended_count: 1,
      known_actual_duration_minutes: 92,
    },
  ],
};

const E2E_COMPLETION_RECORD_IDS = [
  [
    "77777777-7777-4777-8777-777777777781",
    "77777777-7777-4777-8777-777777777782",
  ],
  [
    "77777777-7777-4777-8777-777777777783",
    "77777777-7777-4777-8777-777777777784",
  ],
] as const;

let e2eCompletionPhase: 0 | 1 | 2 | null = null;
let e2eScheduleFixtureVisible = false;
let e2eScheduleFixtureRunCount: 1 | 2 = 1;
let e2eCourseArchived = false;
let e2eSecondCourseVisible = false;
let e2eSecondCourseArchived = false;
let e2eSecondLessonVisible = false;
const e2eCompletionPayloads: E2ECompletionPayload[] = [];
const e2eCompletedLearningRecordRows: E2ELearningRecordRow[] = [];

function resetE2eCompletionFlow() {
  e2eCompletionPhase = 0;
  e2eCompletionPayloads.length = 0;
  e2eCompletedLearningRecordRows.length = 0;
}

function e2eCompletionRunRow(
  index: 0 | 1,
  completed: boolean,
): E2ELessonRunRow {
  const id =
    index === 0
      ? E2E_COMPLETION_PRIVATE_RUN_ID
      : E2E_COMPLETION_PUBLISHED_RUN_ID;
  const payload = e2eCompletionPayloads.find(
    (candidate) => candidate.p_lesson_run_id === id,
  );
  const scheduledAt =
    index === 0 ? "2026-08-07T07:00:00.000Z" : "2026-08-07T08:00:00.000Z";
  const startedAt =
    index === 0 ? "2026-08-07T07:05:00.000Z" : "2026-08-07T08:05:00.000Z";
  const endedAt =
    index === 0 ? "2026-08-07T07:50:00.000Z" : "2026-08-07T08:50:00.000Z";

  return {
    id,
    lesson_id: E2E_LESSON_ID,
    scheduled_at: scheduledAt,
    planned_duration_minutes: 45,
    actual_duration_minutes: completed
      ? (payload?.p_actual_duration_minutes ?? 45)
      : null,
    started_at: startedAt,
    started_at_is_actual: true,
    ended_at: completed ? endedAt : null,
    cancelled_at: null,
    teacher_report: completed ? (payload?.p_teacher_report ?? "") : null,
    created_at: scheduledAt,
    updated_at: completed ? endedAt : startedAt,
  };
}

function e2eCompletionRunRows(): E2ELessonRunRow[] {
  if (e2eScheduleFixtureVisible) {
    return [
      {
        id: E2E_COMPLETION_PRIVATE_RUN_ID,
        lesson_id: E2E_LESSON_ID,
        scheduled_at: "2026-08-12T03:00:00.000Z",
        planned_duration_minutes: 60,
        actual_duration_minutes: null,
        started_at: null,
        started_at_is_actual: false,
        ended_at: null,
        cancelled_at: null,
        teacher_report: null,
        created_at: "2026-08-11T02:00:00.000Z",
        updated_at: "2026-08-11T02:00:00.000Z",
      },
      ...(e2eScheduleFixtureRunCount === 2
        ? [
            {
              id: E2E_COMPLETION_PUBLISHED_RUN_ID,
              lesson_id: E2E_LESSON_ID,
              scheduled_at: "2026-08-12T05:30:00.000Z",
              planned_duration_minutes: 45,
              actual_duration_minutes: null,
              started_at: null,
              started_at_is_actual: false,
              ended_at: null,
              cancelled_at: null,
              teacher_report: null,
              created_at: "2026-08-11T02:30:00.000Z",
              updated_at: "2026-08-11T02:30:00.000Z",
            },
          ]
        : []),
    ];
  }
  if (e2eCompletionPhase === null) return [];
  if (e2eCompletionPhase === 0) return [e2eCompletionRunRow(0, false)];
  if (e2eCompletionPhase === 1) {
    return [e2eCompletionRunRow(1, false), e2eCompletionRunRow(0, true)];
  }
  return [e2eCompletionRunRow(1, true), e2eCompletionRunRow(0, true)];
}

function e2eExpectedCompletionRecords(): E2ELearningRecordRow[] {
  if (e2eCompletionPhase !== 0 && e2eCompletionPhase !== 1) return [];
  const index = e2eCompletionPhase;
  const runId =
    index === 0
      ? E2E_COMPLETION_PRIVATE_RUN_ID
      : E2E_COMPLETION_PUBLISHED_RUN_ID;
  const createdAt =
    index === 0 ? "2026-08-07T07:00:00.000Z" : "2026-08-07T08:00:00.000Z";

  return [E2E_SELF_LEARNER_ID, E2E_LEARNER_BORIS_ID].map(
    (learnerProfileId, learnerIndex): E2ELearningRecordRow => ({
      id: E2E_COMPLETION_RECORD_IDS[index][learnerIndex]!,
      learner_profile_id: learnerProfileId,
      recorded_by_account_id: E2E_ACCOUNT_ID,
      lesson_run_id: runId,
      source_course_id: E2E_COURSE_ID,
      source_lesson_id: E2E_LESSON_ID,
      occurred_at: null,
      was_present: null,
      needs_repeat: null,
      teacher_comment: null,
      shared_with_learner_at: null,
      actual_duration_minutes_at_time: null,
      superseded_by_record_id: null,
      course_title_at_time: E2E_COURSE_TITLE,
      lesson_title_at_time: E2E_LESSON_TITLE,
      subject_at_time: "Английский язык",
      created_at: createdAt,
      updated_at: createdAt,
    }),
  );
}

function e2eAllLearningRecordRows() {
  return [
    ...E2E_LEARNING_RECORD_ROWS,
    ...e2eCompletedLearningRecordRows,
    ...e2eExpectedCompletionRecords(),
  ];
}

function e2eCompletionSafeHistory(learnerProfileId: string) {
  const rows = e2eCompletedLearningRecordRows
    .filter((row) => row.learner_profile_id === learnerProfileId)
    .sort(
      (left, right) =>
        new Date(right.occurred_at ?? 0).getTime() -
        new Date(left.occurred_at ?? 0).getTime(),
    );
  return {
    items: rows.map((row) => ({
      key: row.id,
      occurred_at: row.occurred_at,
      course_title: row.course_title_at_time,
      lesson_title: row.lesson_title_at_time,
      subject: row.subject_at_time,
      was_present: row.was_present,
      needs_repeat: row.needs_repeat,
      actual_duration_minutes: row.actual_duration_minutes_at_time ?? null,
      comment: row.shared_with_learner_at
        ? {
            text: row.teacher_comment,
            shared_at: row.shared_with_learner_at,
          }
        : null,
    })),
    next_cursor: null,
  };
}

let e2eArchivedLearnerRestored = false;
let e2eOfflineProfileCreated = false;
let e2eAiConsentStatus: "pending" | "active" | "revoked" = "pending";
let e2eAiConsentRequested = false;
let e2eObserverInviteCreated = false;
let e2eObserverInvitationAccepted = false;
let e2eObserverGrantRevoked = false;
let e2eObservedGrantLeft = false;
let e2eMergeStatus: "pending" | "cancelled" | "completed" = "pending";
let e2eChildActivationAcknowledged = false;
let e2eRecoveryResetCompleted = false;
let e2eRecoveryDelegateRevoked = false;
let e2eStudentDirectoryRpcDelayMs = 0;
let e2eStudentDirectoryRpcReleaseAt = 0;
let e2eStudentDirectoryRpcGate: Promise<void> | null = null;
let e2eStudentDirectoryRpcObserved: (() => void) | null = null;
let e2eCourseAudienceReplacement: {
  directLearnerProfileIds: string[];
  learnerGroupIds: string[];
} | null = null;
const e2eSupabaseReferers: string[] = [];
const e2eCommunicationInboxRpcPayloads: Record<string, unknown>[] = [];
let e2eCommunicationInboxRpcUnavailable = false;
const E2E_COMMUNICATION_INBOX_PAGE = {
  items: [
    {
      id: "system",
      kind: "system",
      pinned: true,
      title: "ShiDao",
      preview: "Новое системное сообщение",
      lastActivityAt: "2026-08-16T08:00:00.000Z",
      unreadCount: 7,
      lastNotificationId: 7,
    },
  ],
  nextCursor: null,
  totalUnread: 7,
};

type PlaywrightLocator = {
  boundingBox: () => Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>;
  click: () => Promise<void>;
  check: () => Promise<void>;
  count: () => Promise<number>;
  fill: (value: string) => Promise<void>;
  hover: () => Promise<void>;
  inputValue: () => Promise<string>;
  setInputFiles: (files: string) => Promise<void>;
  selectOption: (option: { label: string }) => Promise<string[]>;
  getAttribute: (name: string) => Promise<string | null>;
  textContent: () => Promise<string | null>;
  allTextContents: () => Promise<string[]>;
  locator: (selector: string) => PlaywrightLocator;
  evaluate: {
    <T>(pageFunction: (element: Element) => T): Promise<T>;
    <T, Arg>(
      pageFunction: (element: Element, arg: Arg) => T,
      arg: Arg,
    ): Promise<T>;
  };
  evaluateAll: <T>(pageFunction: (elements: Element[]) => T) => Promise<T>;
  nth: (index: number) => PlaywrightLocator;
  isEnabled: () => Promise<boolean>;
  press: (key: string) => Promise<void>;
  screenshot: () => Promise<Buffer>;
  getByRole: (
    role: string,
    options?: {
      name?: string | RegExp;
      exact?: boolean;
      level?: number;
    },
  ) => PlaywrightLocator;
  getByLabel: (text: string | RegExp) => PlaywrightLocator;
  getByText: (
    text: string | RegExp,
    options?: { exact?: boolean },
  ) => PlaywrightLocator;
  waitFor: (options?: {
    state?: "attached" | "detached" | "visible" | "hidden";
    timeout?: number;
  }) => Promise<void>;
};

type ProductTableBodyTypography = {
  color: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
};

type ProductDropdownSurfaceContract = {
  padding: string[];
  borderWidths: string[];
  borderRadius: string;
  backgroundColor: string;
  boxShadow: string;
  backdropFilter: string;
  edgeInsets: { start: number; end: number };
  dividerBorderTopWidths: string[];
  separatorCount: number;
};

async function assertCanonicalProductDropdownSurface(
  surface: PlaywrightLocator,
  label: string,
) {
  const contract = await surface.evaluate<ProductDropdownSurfaceContract>(
    (element) => {
      const panel = element as HTMLElement;
      const panelStyle = getComputedStyle(panel);
      const panelRect = panel.getBoundingClientRect();
      const edgeProbe = Array.from(
        panel.querySelectorAll<HTMLElement>(
          ".action-menu-item, .nav-dropdown-item, .product-select-option, .teaching-date-popover-heading",
        ),
      ).find((candidate) => candidate.offsetParent !== null);
      if (!edgeProbe) {
        throw new Error("Dropdown edge probe is missing");
      }
      const probeRect = edgeProbe.getBoundingClientRect();
      const dividers = Array.from(
        panel.querySelectorAll<HTMLElement>(
          ".nav-dropdown-items, .teaching-date-popover-footer",
        ),
      );
      return {
        padding: [
          panelStyle.paddingTop,
          panelStyle.paddingRight,
          panelStyle.paddingBottom,
          panelStyle.paddingLeft,
        ],
        borderWidths: [
          panelStyle.borderTopWidth,
          panelStyle.borderRightWidth,
          panelStyle.borderBottomWidth,
          panelStyle.borderLeftWidth,
        ],
        borderRadius: panelStyle.borderRadius,
        backgroundColor: panelStyle.backgroundColor,
        boxShadow: panelStyle.boxShadow,
        backdropFilter: panelStyle.backdropFilter,
        edgeInsets: {
          start: Number((probeRect.left - panelRect.left).toFixed(3)),
          end: Number((panelRect.right - probeRect.right).toFixed(3)),
        },
        dividerBorderTopWidths: dividers.map(
          (divider) => getComputedStyle(divider).borderTopWidth,
        ),
        separatorCount: panel.querySelectorAll(
          '[role="separator"], .action-menu-separator',
        ).length,
      };
    },
  );

  assert.deepEqual(
    {
      ...contract,
      dividerBorderTopWidthsAreZero: contract.dividerBorderTopWidths.every(
        (width) => width === "0px",
      ),
    },
    {
      padding: ["6px", "6px", "6px", "6px"],
      borderWidths: ["0px", "0px", "0px", "0px"],
      borderRadius: "12px",
      backgroundColor: "rgb(255, 255, 255)",
      boxShadow: E2E_DROPDOWN_SHADOW,
      backdropFilter: "none",
      edgeInsets: { start: 6, end: 6 },
      dividerBorderTopWidths: contract.dividerBorderTopWidths,
      separatorCount: 0,
      dividerBorderTopWidthsAreZero: true,
    },
    `${label} must use the canonical 6px borderless dropdown surface`,
  );
}

async function assertCanonicalFirstBodyRowTypography(
  table: PlaywrightLocator,
  label: string,
) {
  const typography = await table
    .locator("tbody tr:first-child")
    .evaluate<ProductTableBodyTypography[]>((element) => {
      const row = element as HTMLTableRowElement;
      const dataCells = Array.from(row.cells).filter(
        (cell) =>
          !cell.matches(
            ".course-index-table-action-cell, .teaching-run-table-action-cell, .student-directory-action-cell, .product-table-action-cell",
          ),
      );
      const hasDirectText = (candidate: HTMLElement) =>
        candidate.getAttribute("aria-hidden") !== "true" &&
        Array.from(candidate.childNodes).some(
          (node) =>
            node.nodeType === Node.TEXT_NODE &&
            Boolean(node.textContent?.trim()),
        );
      const textElements = dataCells.flatMap((cell) => {
        const descendants = Array.from(
          cell.querySelectorAll<HTMLElement>("a, button, span, strong, time"),
        ).filter(hasDirectText);
        return hasDirectText(cell) ? [cell, ...descendants] : descendants;
      });

      return textElements.map((textElement) => {
        const style = getComputedStyle(textElement);
        return {
          color: style.color,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
        };
      });
    });

  assert.ok(typography.length > 0, `${label}: body typography is missing`);
  assert.ok(
    typography.every(
      ({ color, fontSize, fontWeight, lineHeight }) =>
        color === "rgb(20, 20, 20)" &&
        Math.abs(Number.parseFloat(fontSize) - 14.08) < 0.02 &&
        fontWeight === "400" &&
        Math.abs(Number.parseFloat(lineHeight) - 18.304) < 0.02,
    ),
    `${label}: first body row must use the canonical Schedule typography`,
  );
}

async function assertCourseTableFitsAndTruncates(
  table: PlaywrightLocator,
  label: string,
) {
  const contract = await table.evaluate((element) => {
    const courseTable = element as HTMLTableElement;
    const wrapper = courseTable.closest<HTMLElement>(".product-table-wrap");
    const firstRow = courseTable.tBodies[0]?.rows[0];
    const titleTarget = firstRow?.cells[0]?.querySelector<HTMLElement>(
      ".course-index-table-link > span",
    );
    if (!wrapper || !firstRow || !titleTarget) {
      throw new Error("Course table truncation contract is missing");
    }

    const originalTitle = titleTarget.textContent;
    titleTarget.textContent = "ОченьДлинноеНазваниеКурсаБезПробелов".repeat(12);
    const tableRect = courseTable.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const titleStyle = getComputedStyle(titleTarget);
    const result = {
      tableLayout: getComputedStyle(courseTable).tableLayout,
      tableInsideWrapper: tableRect.right <= wrapperRect.right + 0.5,
      headerLabels: Array.from(courseTable.tHead?.rows[0]?.cells ?? []).map(
        (cell) => cell.textContent?.trim() ?? "",
      ),
      columnCount: firstRow.cells.length,
      titleOverflow: titleStyle.overflow,
      titleTextOverflow: titleStyle.textOverflow,
      titleWhiteSpace: titleStyle.whiteSpace,
      titleIsTruncated: titleTarget.scrollWidth > titleTarget.clientWidth,
    };
    titleTarget.textContent = originalTitle;
    return result;
  });

  assert.equal(contract.tableLayout, "fixed", `${label}: fixed layout`);
  assert.equal(contract.tableInsideWrapper, true, `${label}: fits wrapper`);
  assert.equal(contract.headerLabels.includes("Уровень"), false);
  assert.equal(contract.columnCount, 6);
  assert.deepEqual(
    {
      overflow: contract.titleOverflow,
      textOverflow: contract.titleTextOverflow,
      whiteSpace: contract.titleWhiteSpace,
      truncated: contract.titleIsTruncated,
    },
    {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      truncated: true,
    },
  );
}

type PlaywrightRoute = {
  request: () => {
    postDataJSON: () => unknown;
    url: () => string;
  };
  continue: () => Promise<void>;
  fulfill: (options: {
    status: number;
    contentType: string;
    body: string;
  }) => Promise<void>;
};

type PlaywrightChromium = {
  launch: (options?: { args?: string[] }) => Promise<{
    close: () => Promise<void>;
    newContext: (options?: {
      baseURL?: string;
      viewport?: { width: number; height: number };
      extraHTTPHeaders?: Record<string, string>;
      ignoreHTTPSErrors?: boolean;
      isMobile?: boolean;
      hasTouch?: boolean;
      deviceScaleFactor?: number;
    }) => Promise<{
      addCookies: (
        cookies: Array<{
          name: string;
          value: string;
          url: string;
        }>,
      ) => Promise<void>;
      newPage: () => Promise<{
        clock: {
          setFixedTime: (time: string | Date | number) => Promise<void>;
        };
        mouse: {
          down: () => Promise<void>;
          move: (x: number, y: number) => Promise<void>;
          up: () => Promise<void>;
        };
        keyboard: {
          press: (key: string) => Promise<void>;
        };
        screenshot: (options: {
          animations?: "allow" | "disabled";
          caret?: "hide" | "initial";
          clip?: { x: number; y: number; width: number; height: number };
          scale?: "css" | "device";
          type?: "png" | "jpeg";
        }) => Promise<Buffer>;
        setViewportSize: (viewport: {
          width: number;
          height: number;
        }) => Promise<void>;
        emulateMedia: (options: {
          reducedMotion?: "reduce" | "no-preference";
          forcedColors?: "active" | "none";
        }) => Promise<void>;
        waitForTimeout: (timeout: number) => Promise<void>;
        waitForFunction: (pageFunction: () => boolean) => Promise<void>;
        goto: (
          url: string,
          options?: { waitUntil?: "domcontentloaded" | "networkidle" },
        ) => Promise<{
          status: () => number;
          json: () => Promise<unknown>;
        } | null>;
        content: () => Promise<string>;
        evaluate: <T>(pageFunction: () => T) => Promise<T>;
        getByRole: (
          role: string,
          options?: {
            name?: string | RegExp;
            exact?: boolean;
            level?: number;
          },
        ) => PlaywrightLocator;
        getByLabel: (text: string | RegExp) => PlaywrightLocator;
        getByText: (
          text: string | RegExp,
          options?: { exact?: boolean },
        ) => PlaywrightLocator;
        locator: (selector: string) => PlaywrightLocator;
        route: (
          url: string,
          handler: (route: PlaywrightRoute) => Promise<void> | void,
        ) => Promise<void>;
        url: () => string;
        waitForResponse: (
          predicate: (response: { url: () => string }) => boolean,
        ) => Promise<{ url: () => string; status: () => number }>;
        waitForURL: (
          url: string | RegExp,
          options?: {
            timeout?: number;
            waitUntil?: "domcontentloaded" | "networkidle";
          },
        ) => Promise<void>;
      }>;
      close: () => Promise<void>;
    }>;
  }>;
};

let appPort = 0;
let mockPort = 0;
let browserProxyPort = 0;
let appServerProcess: ChildProcess | null = null;
let mockServer: ReturnType<typeof createServer> | null = null;
let browserProxyServer: ReturnType<typeof createHttpsServer> | null = null;
let browserProxyTempDir: string | null = null;
let chromium: PlaywrightChromium | null = null;
let browserSmokeUnavailableReason: string | null = null;

const strictBrowserSmoke =
  process.env.REQUIRE_BROWSER_SMOKE === "1" || process.env.CI === "true";
const requestedServerMode = process.env.BROWSER_SMOKE_SERVER_MODE;
const browserSmokeServerMode =
  requestedServerMode === "prod" ||
  (strictBrowserSmoke && requestedServerMode !== "dev")
    ? "prod"
    : "dev";

function assertBrowserSmokeRequirement(reason: string) {
  if (strictBrowserSmoke) {
    throw new Error(`Browser smoke is required in strict mode: ${reason}`);
  }

  browserSmokeUnavailableReason = reason;
}

function resolveBrowserInstallHint(error: unknown) {
  const message =
    error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
  const normalized = message.toLowerCase();

  if (
    normalized.includes("executable doesn't exist") ||
    normalized.includes("browserType.launch") ||
    normalized.includes("playwright install")
  ) {
    return "Playwright package is installed, but Chromium binaries are missing. Run `npx playwright install chromium` (or `npx playwright install`) to enable browser smoke tests.";
  }

  return `Playwright Chromium is unavailable in this environment: ${message}`;
}

function buildSessionCookieValue(input: {
  uid: string;
  email: string;
  fullName: string;
}) {
  const issuedAt = Date.now();
  const previousSecret = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET = APP_SESSION_SECRET;

  try {
    const supabaseSession = buildAppSessionSupabaseTokens(
      {
        accessToken: E2E_SUPABASE_ACCESS_TOKEN,
        refreshToken: "e2e-supabase-user-refresh-token",
        expiresInSeconds: 3600,
      },
      issuedAt,
    );
    assert.ok(supabaseSession?.accessToken);

    return sealAppSession(
      createAppSessionPayload(
        {
          ...input,
          recoveryVerifiedAt: null,
          supabaseSession,
        },
        issuedAt,
      ),
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.APP_SESSION_SECRET;
    } else {
      process.env.APP_SESSION_SECRET = previousSecret;
    }
  }
}

function authenticatedCookieValue() {
  return buildSessionCookieValue({
    uid: E2E_ADULT_USER_ID,
    email: "adult-e2e@example.test",
    fullName: "E2E Adult",
  });
}

async function allocatePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  assert.ok(address && typeof address === "object", "port allocation failed");
  const { port } = address;
  server.close();
  await once(server, "close");
  return port;
}

function json(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function exactCountHead(response: ServerResponse, count: number) {
  response.writeHead(200, {
    "Content-Range": count === 0 ? "*/0" : `0-${count - 1}/${count}`,
    "Range-Unit": "items",
  });
  response.end();
}

function readUserId(requestUrl: URL) {
  return readEqFilter(requestUrl, "user_id");
}

function readEqFilter(requestUrl: URL, key: string) {
  const raw = requestUrl.searchParams.get(key);
  if (!raw) return null;

  const match = /^eq\.(.+)$/.exec(raw);
  return match?.[1] ?? null;
}

function readInFilter(requestUrl: URL, key: string) {
  const raw = requestUrl.searchParams.get(key);
  if (!raw) return null;

  const match = /^in\.\((.*)\)$/.exec(raw);
  if (!match) return null;
  return match[1] ? match[1].split(",").map((value) => value.trim()) : [];
}

function readComparisonFilter(
  requestUrl: URL,
  key: string,
  operator: "gte" | "lt",
) {
  for (const raw of requestUrl.searchParams.getAll(key)) {
    const match = new RegExp(`^${operator}\\.(.+)$`).exec(raw);
    if (match) return match[1] ?? null;
  }
  return null;
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {} as Record<string, unknown>;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
    string,
    unknown
  >;
}

function e2eDirectoryItem(
  learnerProfileId: string,
  displayName: string,
  identityState: "offline" | "pending" | "claimed" | "merged",
  archivedAt: string | null = null,
) {
  return {
    learner_profile_id: learnerProfileId,
    teacher_account_id: E2E_ACCOUNT_ID,
    display_name: displayName,
    archived_at: archivedAt,
    identity_state: identityState,
    pending_request_count: identityState === "pending" ? 1 : 0,
    can_invite: identityState === "offline",
    can_permanently_delete: identityState === "offline" && archivedAt !== null,
    created_at: "2026-08-05T10:00:00.000Z",
    updated_at: "2026-08-07T10:00:00.000Z",
  };
}

function e2eConnectionRequests() {
  return [
    {
      id: E2E_CONNECTION_ID,
      direction: "outgoing",
      status: "pending",
      method: "share_code",
      counterparty_label: "Ученик с аккаунтом",
      local_display_name: "Новый по QR",
      learner_profile_id: null,
      expires_at: "2026-08-14T10:00:00.000Z",
      created_at: "2026-08-07T10:00:00.000Z",
      accepted_at: null,
    },
    {
      id: "88888888-8888-4888-8888-888888888896",
      direction: "incoming",
      status: "pending",
      method: "share_code",
      counterparty_label: "Преподаватель Ирина",
      local_display_name: "E2E Adult",
      learner_profile_id: E2E_SELF_LEARNER_ID,
      expires_at: "2026-08-14T10:00:00.000Z",
      created_at: "2026-08-07T10:00:00.000Z",
      accepted_at: null,
    },
  ];
}

function e2eAiConsent() {
  return {
    id: E2E_AI_CONSENT_ID,
    learner_profile_id: E2E_SELF_LEARNER_ID,
    course_id: E2E_COURSE_ID,
    course_title: E2E_COURSE_TITLE,
    owner_label: "Преподаватель Ирина",
    purpose: "Персонализировать следующий урок",
    status: e2eAiConsentStatus,
    revision:
      e2eAiConsentStatus === "pending"
        ? 1
        : e2eAiConsentStatus === "active"
          ? 2
          : 3,
    expires_at: "2026-11-07T10:00:00.000Z",
    created_at: "2026-08-07T10:00:00.000Z",
    granted_at:
      e2eAiConsentStatus === "active" ? "2026-08-07T11:00:00.000Z" : null,
    revoked_at:
      e2eAiConsentStatus === "revoked" ? "2026-08-07T12:00:00.000Z" : null,
  };
}

function e2eObserverOverview() {
  return {
    grants: !e2eObserverGrantRevoked
      ? [
          {
            id: E2E_OBSERVER_GRANT_ID,
            learner_profile_id: E2E_SELF_LEARNER_ID,
            subject_label: "E2E Adult",
            observer_label: "Доверенный наблюдатель",
            relationship_label: "тренер",
            direction: "observed_by",
            created_at: "2026-08-06T10:00:00.000Z",
          },
        ]
      : [],
    invitations: [
      {
        id: E2E_OBSERVER_INVITATION_ID,
        direction: "incoming",
        status: e2eObserverInvitationAccepted ? "accepted" : "pending",
        subject_label: "Мария Соколова",
        observer_label: "E2E Adult",
        relationship_label: "наставник",
        expires_at: "2026-08-14T10:00:00.000Z",
        created_at: "2026-08-07T10:00:00.000Z",
      },
      {
        id: E2E_OUTGOING_OBSERVER_INVITATION_ID,
        direction: "outgoing",
        status: "pending",
        subject_label: "E2E Adult",
        observer_label: "Новый наблюдатель",
        relationship_label: "бабушка",
        expires_at: "2026-08-14T10:00:00.000Z",
        created_at: "2026-08-07T10:00:00.000Z",
      },
    ],
  };
}

function e2eProfileInvitation(
  invitationId: string,
  kind: "claim" | "child_activation",
) {
  return {
    id: invitationId,
    kind,
    status: "bound",
    learner_profile_id:
      kind === "child_activation" ? E2E_LEARNER_BORIS_ID : E2E_LEARNER_ANNA_ID,
    learner_label: kind === "child_activation" ? "Борис" : "Анна",
    inviter_label: "Преподаватель Ирина",
    expires_at: "2026-08-14T10:00:00.000Z",
    created_at: "2026-08-07T10:00:00.000Z",
    accepted_at: null,
  };
}

function e2eInvitationAcceptance(
  invitationId: string,
  kind: "claim" | "child_activation",
) {
  return {
    invitation: e2eProfileInvitation(invitationId, kind),
    merge_preview: null,
    completed: false,
    child_account_login: null,
    observer_invitation_id: null,
  };
}

async function handleMockSupabase(
  request: IncomingMessage,
  response: ServerResponse,
) {
  if (!request.url) {
    json(response, 400, { message: "missing request url" });
    return;
  }

  const requestUrl = new URL(request.url, `http://127.0.0.1:${mockPort}`);
  if (typeof request.headers.referer === "string") {
    e2eSupabaseReferers.push(request.headers.referer);
  }

  if (requestUrl.pathname === "/auth/v1/verify") {
    json(response, 200, {
      access_token: E2E_SUPABASE_ACCESS_TOKEN,
      refresh_token: "e2e-supabase-user-refresh-token",
      expires_in: 3600,
      user: {
        id: E2E_ADULT_USER_ID,
        email: "adult-e2e@example.test",
        user_metadata: { full_name: "E2E Adult" },
      },
    });
    return;
  }

  if (
    requestUrl.pathname === "/auth/v1/token" &&
    requestUrl.searchParams.get("grant_type") === "password"
  ) {
    const body = await readJsonBody(request);
    if (
      body.email !== "adult-e2e@example.test" ||
      body.password !== "adult-secret"
    ) {
      json(response, 400, { message: "invalid credentials" });
      return;
    }
    json(response, 200, {
      access_token: E2E_SUPABASE_ACCESS_TOKEN,
      refresh_token: "e2e-supabase-user-refresh-token",
      expires_in: 3600,
      user: {
        id: E2E_ADULT_USER_ID,
        email: "adult-e2e@example.test",
        user_metadata: { full_name: "E2E Adult" },
      },
    });
    return;
  }

  if (
    requestUrl.pathname === "/auth/v1/admin/users" &&
    request.method === "POST"
  ) {
    const body = await readJsonBody(request);
    json(response, 200, {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: body.email,
      app_metadata: body.app_metadata,
      user_metadata: body.user_metadata,
    });
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/current_account_auth_context") {
    json(response, 200, [
      {
        account_id: E2E_ACCOUNT_ID,
        auth_user_id: E2E_ADULT_USER_ID,
        verified_email: "adult-e2e@example.test",
        display_name: "E2E Adult",
        locale: "ru",
        timezone: "Asia/Chita",
        has_pin: true,
        can_author_educator_courses: true,
        sessions_invalid_before: null,
        avatar_kind: "preset",
        avatar_preset_key: "sd-avatar-v1-01",
        avatar_storage_path: null,
        avatar_revision: 1,
        avatar_updated_at: "2026-08-14T00:00:00.000Z",
      },
    ]);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/list_my_communication_inbox") {
    const body = await readJsonBody(request);
    e2eCommunicationInboxRpcPayloads.push(body);
    if (e2eCommunicationInboxRpcUnavailable) {
      json(response, 503, {
        code: "communication_network_error",
        message: "Сервис сообщений временно недоступен.",
      });
      return;
    }
    json(response, 200, E2E_COMMUNICATION_INBOX_PAGE);
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/resolve_teacher_learner_profile_alias"
  ) {
    const body = await readJsonBody(request);
    json(response, 200, body.p_learner_profile_id ?? E2E_LEARNER_ANNA_ID);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/list_teacher_learner_directory") {
    const body = await readJsonBody(request);
    if (body.p_status === "active" && e2eStudentDirectoryRpcGate) {
      e2eStudentDirectoryRpcObserved?.();
      e2eStudentDirectoryRpcObserved = null;
      await e2eStudentDirectoryRpcGate;
    }
    if (body.p_status === "active" && e2eStudentDirectoryRpcDelayMs > 0) {
      if (e2eStudentDirectoryRpcReleaseAt === 0) {
        e2eStudentDirectoryRpcReleaseAt =
          Date.now() + e2eStudentDirectoryRpcDelayMs;
      }
      const remainingDelay = e2eStudentDirectoryRpcReleaseAt - Date.now();
      if (remainingDelay > 0) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, remainingDelay),
        );
      }
    }
    if (body.p_status === "archived") {
      json(
        response,
        200,
        e2eArchivedLearnerRestored
          ? []
          : [
              e2eDirectoryItem(
                E2E_ARCHIVED_LEARNER_ID,
                "Архивная Ольга",
                "offline",
                "2026-08-07T09:00:00.000Z",
              ),
            ],
      );
      return;
    }
    json(response, 200, [
      e2eDirectoryItem(E2E_LEARNER_ANNA_ID, "Анна Петрова", "claimed"),
      e2eDirectoryItem(E2E_LEARNER_BORIS_ID, "Борис Волков", "offline"),
      e2eDirectoryItem(E2E_LEARNER_CLARA_ID, "Клара Смирнова", "pending"),
      ...(e2eArchivedLearnerRestored
        ? [
            e2eDirectoryItem(
              E2E_ARCHIVED_LEARNER_ID,
              "Архивная Ольга",
              "offline",
            ),
          ]
        : []),
      ...(e2eOfflineProfileCreated
        ? [
            e2eDirectoryItem(
              E2E_PROFILE_INVITATION_ID,
              "Ева без аккаунта",
              "offline",
            ),
          ]
        : []),
    ]);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/restore_teacher_learner") {
    e2eArchivedLearnerRestored = true;
    json(
      response,
      200,
      e2eDirectoryItem(E2E_ARCHIVED_LEARNER_ID, "Архивная Ольга", "offline"),
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/list_learner_connection_requests") {
    json(response, 200, e2eConnectionRequests());
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/create_learner_connection_request"
  ) {
    const body = await readJsonBody(request);
    json(response, 200, {
      ...e2eConnectionRequests()[0],
      method: body.p_method,
      local_display_name: body.p_local_display_name,
    });
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/act_on_learner_connection_request"
  ) {
    const body = await readJsonBody(request);
    json(response, 200, {
      ...e2eConnectionRequests()[0],
      status:
        body.p_action === "accept"
          ? "accepted"
          : body.p_action === "reject"
            ? "rejected"
            : "cancelled",
    });
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/get_my_learning_profile") {
    json(response, 200, {
      learner_profile_id: E2E_SELF_LEARNER_ID,
      display_name: "E2E Adult",
      created_at: "2026-08-01T10:00:00.000Z",
      merged_lineage_count: 2,
      can_safe_unlink: false,
      pending_connections: e2eConnectionRequests().filter(
        (item) => item.direction === "incoming",
      ),
    });
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/get_my_learning_history") {
    json(
      response,
      200,
      e2eCompletionPhase === null
        ? E2E_SAFE_HISTORY
        : e2eCompletionSafeHistory(E2E_SELF_LEARNER_ID),
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/get_my_learning_progress") {
    json(response, 200, E2E_PROGRESS);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/list_my_learner_ai_consents") {
    json(response, 200, [e2eAiConsent()]);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/act_on_learner_ai_consent") {
    const body = await readJsonBody(request);
    e2eAiConsentStatus = body.p_action === "grant" ? "active" : "revoked";
    json(response, 200, e2eAiConsent());
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/request_learner_ai_consent") {
    const body = await readJsonBody(request);
    e2eAiConsentRequested =
      body.p_course_id === E2E_COURSE_ID &&
      body.p_learner_profile_id === E2E_LEARNER_ANNA_ID &&
      typeof body.p_purpose === "string" &&
      body.p_purpose.length > 0;
    e2eAiConsentStatus = "pending";
    json(response, 200, {
      ...e2eAiConsent(),
      learner_profile_id: E2E_LEARNER_ANNA_ID,
    });
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/rotate_my_learner_share_code") {
    json(response, 200, {
      expires_at: "2026-08-07T12:15:00.000Z",
      created_at: "2026-08-07T12:00:00.000Z",
    });
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/list_my_observed_learner_profiles"
  ) {
    json(
      response,
      200,
      e2eObservedGrantLeft
        ? []
        : [
            {
              id: E2E_OBSERVER_GRANT_ID,
              learner_profile_id: E2E_LEARNER_BORIS_ID,
              subject_label: "Борис Волков",
              observer_label: "E2E Adult",
              relationship_label: "наставник",
              direction: "observing",
              created_at: "2026-08-06T10:00:00.000Z",
            },
          ],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/get_observed_learner_history") {
    json(
      response,
      200,
      e2eCompletionPhase === null
        ? E2E_SAFE_HISTORY
        : e2eCompletionSafeHistory(E2E_LEARNER_BORIS_ID),
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/get_observed_learner_progress") {
    json(response, 200, E2E_PROGRESS);
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/list_my_learner_observer_overview"
  ) {
    json(response, 200, e2eObserverOverview());
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/create_learner_observer_invitation"
  ) {
    const body = await readJsonBody(request);
    e2eObserverInviteCreated =
      typeof body.p_recipient_email_digest === "string" &&
      typeof body.p_token_digest === "string" &&
      body.p_relationship_label === "бабушка";
    json(response, 200, {
      created_invitation_id: E2E_OUTGOING_OBSERVER_INVITATION_ID,
      overview: e2eObserverOverview(),
    });
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/act_on_learner_observer_relationship"
  ) {
    const body = await readJsonBody(request);
    if (body.p_relationship_id === E2E_OBSERVER_INVITATION_ID) {
      e2eObserverInvitationAccepted = body.p_action === "accept";
    }
    if (
      body.p_relationship_id === E2E_OBSERVER_GRANT_ID &&
      body.p_action === "revoke"
    ) {
      e2eObserverGrantRevoked = true;
    }
    if (
      body.p_relationship_id === E2E_OBSERVER_GRANT_ID &&
      body.p_action === "leave"
    ) {
      e2eObservedGrantLeft = true;
    }
    json(response, 200, e2eObserverOverview());
    return;
  }

  if (
    requestUrl.pathname ===
    "/rest/v1/rpc/list_my_learner_credential_recovery_delegates"
  ) {
    json(
      response,
      200,
      e2eRecoveryDelegateRevoked
        ? [
            {
              grant_id: E2E_RECOVERY_GRANT_ID,
              delegate_label: "Доверенный взрослый Пётр",
              status: "revoked",
              granted_at: "2026-08-07T10:00:00.000Z",
              revoked_at: "2026-08-07T12:30:00.000Z",
            },
          ]
        : [
            {
              grant_id: E2E_RECOVERY_GRANT_ID,
              delegate_label: "Доверенный взрослый Пётр",
              status: "active",
              granted_at: "2026-08-07T10:00:00.000Z",
              revoked_at: null,
            },
          ],
    );
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/list_recoverable_learner_credentials"
  ) {
    json(response, 200, [
      {
        grant_id: E2E_RECOVERY_GRANT_ID,
        learner_label: "Борис Волков",
        child_account_login: e2eRecoveryResetCompleted
          ? "boris-new-login"
          : "boris-child",
        can_reset: true,
        granted_at: "2026-08-07T10:00:00.000Z",
      },
    ]);
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/reset_recoverable_learner_credentials"
  ) {
    const body = await readJsonBody(request);
    e2eRecoveryResetCompleted =
      body.p_grant_id === E2E_RECOVERY_GRANT_ID &&
      body.p_new_child_login === "boris-new-login" &&
      body.p_raw_pin === "1357" &&
      typeof body.p_reauthenticated_at === "string" &&
      typeof body.p_idempotency_key === "string";
    json(response, 200, {
      grant_id: E2E_RECOVERY_GRANT_ID,
      learner_label: "Борис Волков",
      child_account_login: "boris-new-login",
      completed: true,
    });
    return;
  }

  if (
    requestUrl.pathname ===
    "/rest/v1/rpc/revoke_my_learner_credential_recovery_delegate"
  ) {
    e2eRecoveryDelegateRevoked = true;
    json(response, 200, {
      grant_id: E2E_RECOVERY_GRANT_ID,
      status: "revoked",
      revoked_at: "2026-08-07T12:30:00.000Z",
    });
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/list_learner_profile_invitations") {
    json(response, 200, []);
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/preview_learner_profile_invitation" ||
    requestUrl.pathname ===
      "/rest/v1/rpc/preview_verified_learner_profile_invitation"
  ) {
    const body = await readJsonBody(request);
    const invitationId = String(body.p_invitation_id);
    const kind =
      invitationId === E2E_CHILD_INVITATION_ID
        ? ("child_activation" as const)
        : ("claim" as const);
    json(response, 200, e2eInvitationAcceptance(invitationId, kind));
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/act_on_learner_profile_invitation" ||
    requestUrl.pathname ===
      "/rest/v1/rpc/act_on_verified_learner_profile_invitation"
  ) {
    const body = await readJsonBody(request);
    const invitationId = String(body.p_invitation_id);
    const acceptance = e2eInvitationAcceptance(invitationId, "claim");
    if (body.p_action === "reject") {
      json(response, 200, {
        ...acceptance,
        invitation: { ...acceptance.invitation, status: "rejected" },
        completed: true,
      });
      return;
    }
    json(response, 200, {
      ...acceptance,
      invitation: { ...acceptance.invitation, status: "accepted" },
      merge_preview: {
        operation_id: E2E_MERGE_OPERATION_ID,
        source_learner_profile_id: E2E_LEARNER_ANNA_ID,
        target_learner_profile_id: E2E_SELF_LEARNER_ID,
        preview_fingerprint: "a".repeat(64),
        finalized_record_count: 3,
        teacher_relation_count: 1,
        group_membership_count: 2,
        course_audience_count: 1,
        conflicts: [],
        blockers: [],
        can_confirm: true,
        expires_at: "2026-08-07T12:15:00.000Z",
      },
    });
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/preview_learner_profile_merge") {
    json(response, 200, {
      operation_id: E2E_MERGE_OPERATION_ID,
      source_learner_profile_id: E2E_LEARNER_ANNA_ID,
      target_learner_profile_id: E2E_SELF_LEARNER_ID,
      preview_fingerprint: "a".repeat(64),
      finalized_record_count: 3,
      teacher_relation_count: 1,
      group_membership_count: 2,
      course_audience_count: 1,
      conflicts: [],
      blockers: [],
      can_confirm: true,
      expires_at: "2026-08-07T12:15:00.000Z",
    });
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/cancel_learner_profile_merge") {
    e2eMergeStatus = "cancelled";
    json(response, 200, null);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/confirm_learner_profile_merge") {
    e2eMergeStatus = "completed";
    json(response, 200, {
      operation_id: E2E_MERGE_OPERATION_ID,
      target_learner_profile_id: E2E_SELF_LEARNER_ID,
      completed: true,
    });
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/activate_offline_learner_account" ||
    requestUrl.pathname ===
      "/rest/v1/rpc/activate_verified_offline_learner_account"
  ) {
    const body = await readJsonBody(request);
    e2eChildActivationAcknowledged =
      body.p_acknowledge_recovery_delegate === true;
    if (!e2eChildActivationAcknowledged) {
      json(response, 400, {
        code: "55000",
        message: "learner_activation_recovery_acknowledgement_required",
      });
      return;
    }
    json(response, 200, {
      ...e2eInvitationAcceptance(E2E_CHILD_INVITATION_ID, "child_activation"),
      invitation: {
        ...e2eProfileInvitation(E2E_CHILD_INVITATION_ID, "child_activation"),
        status: "accepted",
      },
      completed: true,
      child_account_login: body.p_learner_login ?? body.p_child_login,
      observer_invitation_id: body.p_request_observer_invitation
        ? E2E_OBSERVER_INVITATION_ID
        : null,
      provisional_auth_user_consumed: true,
      recovery_delegate_id: "88888888-8888-4888-8888-888888888898",
      recovery_delegate_active: true,
    });
    return;
  }

  if (requestUrl.pathname.startsWith("/auth/v1/admin/users/")) {
    const userId = requestUrl.pathname.split("/").at(-1);

    if (userId !== E2E_ADULT_USER_ID) {
      json(response, 404, { message: "user not found" });
      return;
    }

    json(response, 200, {
      user: {
        id: E2E_ADULT_USER_ID,
        email: "adult-e2e@example.test",
        user_metadata: { full_name: "E2E Adult" },
      },
    });
    return;
  }

  if (requestUrl.pathname === "/auth/v1/otp") {
    json(response, 200, {});
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/ensure_user_preference") {
    json(response, 200, {});
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/set_last_selected_school") {
    json(response, 200, null);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/current_session_invalid_before") {
    json(response, 200, null);
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/create_learner_profile_with_groups" ||
    requestUrl.pathname === "/rest/v1/rpc/update_learner_profile_with_groups"
  ) {
    if (requestUrl.pathname.includes("create_")) {
      e2eOfflineProfileCreated = true;
      json(response, 200, {
        teacher_account_id: E2E_ACCOUNT_ID,
        learner_profile_id: E2E_PROFILE_INVITATION_ID,
        display_name: "Ева без аккаунта",
        archived_at: null,
        created_at: "2026-08-07T12:00:00.000Z",
        updated_at: "2026-08-07T12:00:00.000Z",
      });
      return;
    }
    json(response, 200, E2E_TEACHER_LEARNER_ROWS[0]);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/archive_learner_profile") {
    json(response, 200, {
      ...E2E_TEACHER_LEARNER_ROWS[0],
      archived_at: "2026-08-07T12:00:00.000Z",
    });
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/create_learner_group" ||
    requestUrl.pathname === "/rest/v1/rpc/update_learner_group"
  ) {
    json(response, 200, E2E_LEARNER_GROUP_ROWS[0]);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/replace_course_audience") {
    const body = await readJsonBody(request);
    e2eCourseAudienceReplacement = {
      directLearnerProfileIds: Array.isArray(body.p_direct_learner_profile_ids)
        ? body.p_direct_learner_profile_ids.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      learnerGroupIds: Array.isArray(body.p_learner_group_ids)
        ? body.p_learner_group_ids.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    };
    json(response, 200, null);
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/delete_learner_group" ||
    requestUrl.pathname === "/rest/v1/rpc/replace_course_learners"
  ) {
    json(response, 200, null);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/rpc/archive_course") {
    const body = await readJsonBody(request);
    const requestedCourseId = body.p_course_id;
    const courseIsVisible =
      (requestedCourseId === E2E_COURSE_ID && !e2eCourseArchived) ||
      (requestedCourseId === E2E_SECOND_COURSE_ID &&
        e2eSecondCourseVisible &&
        !e2eSecondCourseArchived);

    if (!courseIsVisible) {
      json(response, 200, "not_found");
      return;
    }

    if (requestedCourseId === E2E_COURSE_ID) {
      e2eCourseArchived = true;
    } else {
      e2eSecondCourseArchived = true;
    }
    json(response, 200, "archived");
    return;
  }

  if (requestUrl.pathname === "/rest/v1/account") {
    const requestedAuthUserId = readEqFilter(requestUrl, "auth_user_id");
    const requestedAccountId = readEqFilter(requestUrl, "id");
    const requestedStatus = readEqFilter(requestUrl, "status");
    const matchesFixture =
      (!requestedAuthUserId || requestedAuthUserId === E2E_ADULT_USER_ID) &&
      (!requestedAccountId || requestedAccountId === E2E_ACCOUNT_ID) &&
      (!requestedStatus || requestedStatus === "active");
    json(
      response,
      200,
      matchesFixture
        ? [
            {
              id: E2E_ACCOUNT_ID,
              auth_user_id: E2E_ADULT_USER_ID,
              status: "active",
            },
          ]
        : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course") {
    const requestedCourseId = readEqFilter(requestUrl, "id");
    if (request.method === "PATCH") {
      json(
        response,
        200,
        requestedCourseId === E2E_SECOND_COURSE_ID
          ? [E2E_SECOND_COURSE_ROW]
          : [E2E_COURSE_ROW],
      );
      return;
    }
    const activeCourses = [
      ...(e2eCourseArchived ? [] : [E2E_COURSE_ROW]),
      ...(e2eSecondCourseVisible && !e2eSecondCourseArchived
        ? [E2E_SECOND_COURSE_ROW]
        : []),
    ];
    json(
      response,
      200,
      requestedCourseId
        ? activeCourses.filter((course) => course.id === requestedCourseId)
        : activeCourses,
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course_publication") {
    const requestedPublicationId = readEqFilter(requestUrl, "id");
    json(
      response,
      200,
      requestedPublicationId === E2E_EDUCATOR_PUBLICATION_ID
        ? [
            {
              id: E2E_EDUCATOR_PUBLICATION_ID,
              source_course_id: E2E_EDUCATOR_COURSE_ID,
              owner_account_id: E2E_ACCOUNT_ID,
              learning_audience: "educators",
              publisher_display_name: "E2E Adult",
              is_shidao: true,
              status: "published",
              current_revision_id: E2E_EDUCATOR_REVISION_ID,
              approved_revision_id: E2E_EDUCATOR_REVISION_ID,
              source_content_updated_at: "2026-08-12T03:10:45.000Z",
              published_at: "2026-08-12T03:10:45.000Z",
              unpublished_at: null,
              created_at: "2026-08-12T03:10:45.000Z",
              updated_at: "2026-08-12T03:10:45.000Z",
            },
          ]
        : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course_publication_revision") {
    const requestedRevisionIds = readInFilter(requestUrl, "id");
    const revision = {
      id: E2E_EDUCATOR_REVISION_ID,
      publication_id: E2E_EDUCATOR_PUBLICATION_ID,
      revision_number: 1,
      source_course_updated_at: "2026-08-12T03:10:45.000Z",
      content_sha256: "a".repeat(64),
      snapshot: {
        schemaVersion: 1,
        course: {
          title: E2E_EDUCATOR_COURSE_TITLE,
          subject: "Методика преподавания китайского языка",
          goal: "Спроектировать современный урок китайского языка.",
          level: "Профессиональное развитие педагогов",
          audienceDescription: "Преподаватели китайского языка",
          targetLessonCount: 1,
        },
        lessons: [
          {
            ref: E2E_EDUCATOR_LESSON_REF,
            position: 1,
            title: E2E_EDUCATOR_LESSON_TITLE,
            summary: E2E_EDUCATOR_PRIVATE_TEXT,
            estimatedDurationMinutes: 20,
            components: [
              {
                ref: E2E_EDUCATOR_STAFF_COMPONENT_REF,
                position: 1,
                typeKey: "heading",
                schemaVersion: 1,
                payload: { text: E2E_EDUCATOR_PRIVATE_TEXT, level: "h2" },
                placement: { width: "content", textAlign: "start" },
                visibility: "staff_only",
                studentSlideRef: null,
              },
              {
                ref: E2E_EDUCATOR_LEARNER_COMPONENT_REF,
                position: 2,
                typeKey: "rich_text",
                schemaVersion: 1,
                payload: {
                  content: E2E_EDUCATOR_LEARNER_TEXT,
                  format: "markdown",
                },
                placement: { width: "content", textAlign: "start" },
                visibility: "learner_visible",
                studentSlideRef: E2E_EDUCATOR_SLIDE_REF,
              },
            ],
            slides: [{ ref: E2E_EDUCATOR_SLIDE_REF, position: 1 }],
          },
        ],
        materials: [],
      },
      rights_confirmed_at: "2026-08-12T03:10:45.000Z",
      license_code: "shidao_official_learning_v1",
      published_at: "2026-08-12T03:10:45.000Z",
    };
    json(
      response,
      200,
      !requestedRevisionIds ||
        requestedRevisionIds.includes(E2E_EDUCATOR_REVISION_ID)
        ? [revision]
        : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/educator_course_revision_review") {
    const requestedRevisionId = readEqFilter(requestUrl, "revision_id");
    const requestedPublicationId = readEqFilter(requestUrl, "publication_id");
    const requestedStatus = readEqFilter(requestUrl, "status");
    const matchesFixture =
      (!requestedRevisionId ||
        requestedRevisionId === E2E_EDUCATOR_REVISION_ID) &&
      (!requestedPublicationId ||
        requestedPublicationId === E2E_EDUCATOR_PUBLICATION_ID) &&
      (!requestedStatus || requestedStatus === "approved");
    json(
      response,
      200,
      matchesFixture
        ? [
            {
              revision_id: E2E_EDUCATOR_REVISION_ID,
              publication_id: E2E_EDUCATOR_PUBLICATION_ID,
              status: "approved",
            },
          ]
        : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course_publication_attestation") {
    const requestedRevisionId = readEqFilter(requestUrl, "revision_id");
    const requestedPublicationId = readEqFilter(requestUrl, "publication_id");
    const matchesFixture =
      (!requestedRevisionId ||
        requestedRevisionId === E2E_EDUCATOR_REVISION_ID) &&
      (!requestedPublicationId ||
        requestedPublicationId === E2E_EDUCATOR_PUBLICATION_ID);
    json(
      response,
      200,
      matchesFixture
        ? [
            {
              revision_id: E2E_EDUCATOR_REVISION_ID,
              publication_id: E2E_EDUCATOR_PUBLICATION_ID,
            },
          ]
        : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course_publication_asset") {
    json(response, 200, []);
    return;
  }

  if (
    requestUrl.pathname ===
    "/rest/v1/rpc/list_course_publication_catalog_v2_admin"
  ) {
    const body = await readJsonBody(request);
    const educatorCatalog = body.p_learning_audience === "educators";
    json(response, 200, {
      courses: educatorCatalog
        ? [
            {
              publicationId: E2E_EDUCATOR_PUBLICATION_ID,
              sourceCourseId: E2E_EDUCATOR_COURSE_ID,
              learningAudience: "educators",
              title: E2E_EDUCATOR_COURSE_TITLE,
              subject: "Методика преподавания китайского языка",
              goal: "Спроектировать современный урок китайского языка.",
              level: "Профессиональное развитие педагогов",
              audienceDescription: "Преподаватели китайского языка",
              targetLessonCount: 6,
              lessonCount: 6,
              materialCount: 0,
              publishedAt: "2026-08-12T03:10:45.000Z",
              author: {
                displayName: "E2E Adult",
                isShiDao: true,
                isCurrentUser: true,
              },
            },
          ]
        : [],
      facets: educatorCatalog
        ? {
            subjects: ["Методика преподавания китайского языка"],
            levels: ["Профессиональное развитие педагогов"],
          }
        : { subjects: [], levels: [] },
      nextOffset: null,
    });
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/get_my_course_publication_progress" ||
    requestUrl.pathname ===
      "/rest/v1/rpc/set_my_course_publication_lesson_progress"
  ) {
    json(response, 200, {
      publicationId: E2E_EDUCATOR_PUBLICATION_ID,
      revisionId: E2E_EDUCATOR_REVISION_ID,
      lastOpenedLessonRef: E2E_EDUCATOR_LESSON_REF,
      completedLessonRefs: [E2E_EDUCATOR_LESSON_REF],
      completedLessonCount: 1,
      totalLessonCount: 1,
      percent: 100,
      complete: true,
    });
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/get_my_course_publication_attestation"
  ) {
    json(response, 200, {
      publicationId: E2E_EDUCATOR_PUBLICATION_ID,
      revisionId: E2E_EDUCATOR_REVISION_ID,
      title: "Итоговая аттестация",
      description: "Проверка методики преподавания китайского языка.",
      passingScorePercent: 80,
      version: 1,
      questions: [
        {
          id: "goal",
          prompt: "Какая цель урока наблюдаема?",
          options: [
            { id: "action", label: "Действие ученика" },
            { id: "topic", label: "Название темы" },
          ],
          selectedOptionId: "action",
          correctOptionId: "action",
          explanation: "Цель описывает наблюдаемое действие ученика.",
        },
      ],
      attempt: {
        id: E2E_EDUCATOR_ATTESTATION_ATTEMPT_ID,
        scorePercent: 100,
        passed: true,
        completedAt: "2026-08-12T03:10:45.000Z",
        selectedOptionByQuestionId: { goal: "action" },
      },
      certified: true,
    });
    return;
  }

  if (
    requestUrl.pathname ===
    "/rest/v1/rpc/list_my_course_publication_attestations"
  ) {
    json(response, 200, [
      {
        publicationId: E2E_EDUCATOR_PUBLICATION_ID,
        revisionId: E2E_EDUCATOR_REVISION_ID,
        courseTitle: E2E_EDUCATOR_COURSE_TITLE,
        courseSubject: "Методика преподавания китайского языка",
        assessmentTitle: "Итоговая аттестация",
        publisherDisplayName: "E2E Adult",
        scorePercent: 90,
        passingScorePercent: 80,
        completedAt: "2026-08-12T03:10:45.000Z",
        assessmentVersion: 1,
        isCurrentRevision: true,
        publicationAvailable: true,
      },
    ]);
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/lesson_component" &&
    request.method === "GET"
  ) {
    const requestedComponentId = readEqFilter(requestUrl, "id");
    const components = [
      e2eLessonComponentRow(),
      ...(e2eAuthoredExerciseVisible
        ? [e2eAuthoredExerciseComponentRow()]
        : []),
    ];
    json(
      response,
      200,
      requestedComponentId
        ? components.filter(
            (component) => component.id === requestedComponentId,
          )
        : components,
    );
    return;
  }

  if (
    requestUrl.pathname ===
      "/rest/v1/rpc/set_lesson_component_student_screen" &&
    request.method === "POST"
  ) {
    const payload = (await readJsonBody(request)) as E2EStudentScreenRpcPayload;
    if (
      payload.p_component_id !== E2E_COMPONENT_ID ||
      !["hide", "existing", "new"].includes(payload.p_mode) ||
      (payload.p_mode === "existing" &&
        payload.p_slide_id !== E2E_STUDENT_SLIDE_ID) ||
      (payload.p_mode !== "existing" && payload.p_slide_id !== null)
    ) {
      json(response, 400, { message: "unexpected Student Screen payload" });
      return;
    }

    e2eStudentScreenRpcPayloads.push(payload);
    e2eComponentLearnerVisible = payload.p_mode !== "hide";
    json(response, 200, [e2eLessonComponentRow()]);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/lesson") {
    const courseFilter = requestUrl.searchParams.get("course_id");
    const lessonFilter = readEqFilter(requestUrl, "id");
    if (courseFilter && !courseFilter.includes(E2E_COURSE_ID)) {
      json(response, 200, []);
      return;
    }

    const select = requestUrl.searchParams.get("select") ?? "";
    const lessonRows = [
      ...(e2eSecondLessonVisible ? [E2E_SECOND_LESSON_ROW] : []),
      e2eLessonRow(),
    ].filter((lesson) => !lessonFilter || lesson.id === lessonFilter);
    json(
      response,
      200,
      select.includes("components:lesson_component")
        ? lessonRows
        : lessonRows.map((lesson) => ({
            id: lesson.id,
            course_id: lesson.course_id,
            title: lesson.title,
          })),
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course_attachment") {
    json(response, 200, [
      {
        id: "77777777-7777-4777-8777-777777777773",
        course_id: E2E_COURSE_ID,
        stored_file_id: E2E_STORED_FILE_ID,
        created_at: "2026-08-05T08:35:00.000Z",
      },
    ]);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/stored_file") {
    json(response, 200, [
      {
        id: E2E_STORED_FILE_ID,
        owner_account_id: E2E_ACCOUNT_ID,
        storage_bucket: "course-assets",
        storage_path: `${E2E_ACCOUNT_ID}/${E2E_COURSE_ID}/experience-card.pdf`,
        original_filename: "experience-card.pdf",
        mime_type: "application/pdf",
        size_bytes: 2048,
        checksum_sha256: "a".repeat(64),
        status: "ready",
        metadata: {},
        created_at: "2026-08-05T08:35:00.000Z",
        updated_at: "2026-08-05T08:35:00.000Z",
      },
    ]);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/teacher_learner") {
    const requestedTeacherId = readEqFilter(requestUrl, "teacher_account_id");
    const requestedId = readEqFilter(requestUrl, "learner_profile_id");
    const requestedIds = readInFilter(requestUrl, "learner_profile_id");
    const archivedFilter = requestUrl.searchParams.get("archived_at");
    const rows = E2E_TEACHER_LEARNER_ROWS.filter(
      (row) =>
        (!requestedTeacherId ||
          row.teacher_account_id === requestedTeacherId) &&
        (!requestedId || row.learner_profile_id === requestedId) &&
        (!requestedIds || requestedIds.includes(row.learner_profile_id)) &&
        (archivedFilter !== "is.null" || row.archived_at === null) &&
        (archivedFilter !== "not.is.null" || row.archived_at !== null),
    );
    if (request.method === "HEAD") {
      exactCountHead(response, rows.length);
      return;
    }
    json(response, 200, rows);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/learner_group") {
    const requestedId = readEqFilter(requestUrl, "id");
    const requestedIds = readInFilter(requestUrl, "id");
    json(
      response,
      200,
      E2E_LEARNER_GROUP_ROWS.filter(
        (row) =>
          (!requestedId || row.id === requestedId) &&
          (!requestedIds || requestedIds.includes(row.id)),
      ),
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/learner_group_member") {
    const requestedGroupIds = readInFilter(requestUrl, "learner_group_id");
    json(
      response,
      200,
      E2E_LEARNER_GROUP_MEMBER_ROWS.filter(
        (row) =>
          !requestedGroupIds ||
          requestedGroupIds.includes(row.learner_group_id),
      ).map(({ learner_group_id, learner_profile_id }) => ({
        learner_group_id,
        learner_profile_id,
      })),
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course_learner") {
    const requestedCourseId = readEqFilter(requestUrl, "course_id");
    json(
      response,
      200,
      !requestedCourseId || requestedCourseId === E2E_COURSE_ID
        ? [
            {
              course_id: E2E_COURSE_ID,
              learner_profile_id: E2E_LEARNER_BORIS_ID,
            },
          ]
        : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course_learner_group") {
    const requestedCourseId = readEqFilter(requestUrl, "course_id");
    json(
      response,
      200,
      !requestedCourseId || requestedCourseId === E2E_COURSE_ID
        ? [
            {
              course_id: E2E_COURSE_ID,
              learner_group_id: E2E_GROUP_TEEN_ID,
            },
          ]
        : [],
    );
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/complete_lesson_run_v2" &&
    request.method === "POST"
  ) {
    const payload = (await readJsonBody(
      request,
    )) as unknown as E2ECompletionPayload;
    if (e2eCompletionPhase !== 0 && e2eCompletionPhase !== 1) {
      json(response, 409, { message: "completion flow is not active" });
      return;
    }
    const index = e2eCompletionPhase;
    const expectedRunId =
      index === 0
        ? E2E_COMPLETION_PRIVATE_RUN_ID
        : E2E_COMPLETION_PUBLISHED_RUN_ID;
    if (
      payload.p_lesson_run_id !== expectedRunId ||
      !Array.isArray(payload.p_records)
    ) {
      json(response, 400, { message: "unexpected completion payload" });
      return;
    }

    e2eCompletionPayloads.push(payload);
    const completedRun = e2eCompletionRunRow(index, true);
    const completedAt = completedRun.ended_at!;
    const learnerIds = [E2E_SELF_LEARNER_ID, E2E_LEARNER_BORIS_ID];
    for (const [learnerIndex, learnerProfileId] of learnerIds.entries()) {
      const result = payload.p_records.find(
        (record) => record.learnerProfileId === learnerProfileId,
      );
      if (!result) {
        json(response, 400, { message: "missing learner result" });
        return;
      }
      e2eCompletedLearningRecordRows.push({
        id: E2E_COMPLETION_RECORD_IDS[index][learnerIndex]!,
        learner_profile_id: learnerProfileId,
        recorded_by_account_id: E2E_ACCOUNT_ID,
        lesson_run_id: expectedRunId,
        source_course_id: E2E_COURSE_ID,
        source_lesson_id: E2E_LESSON_ID,
        occurred_at: completedAt,
        was_present: result.wasPresent,
        needs_repeat: result.needsRepeat,
        teacher_comment: result.teacherComment,
        shared_with_learner_at: result.shareWithLearner ? completedAt : null,
        actual_duration_minutes_at_time:
          payload.p_actual_duration_minutes ?? 45,
        superseded_by_record_id: null,
        course_title_at_time: E2E_COURSE_TITLE,
        lesson_title_at_time: E2E_LESSON_TITLE,
        subject_at_time: "Английский язык",
        created_at: completedAt,
        updated_at: completedAt,
      });
    }
    e2eCompletionPhase = index === 0 ? 1 : 2;
    json(response, 200, completedRun);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/lesson_run") {
    const requestedId = readEqFilter(requestUrl, "id");
    const requestedLessonId = readEqFilter(requestUrl, "lesson_id");
    const requestedLessonIds = readInFilter(requestUrl, "lesson_id");
    const scheduledFrom = readComparisonFilter(
      requestUrl,
      "scheduled_at",
      "gte",
    );
    const scheduledTo = readComparisonFilter(requestUrl, "scheduled_at", "lt");
    const endedFilter = requestUrl.searchParams.get("ended_at");
    const cancelledFilter = requestUrl.searchParams.get("cancelled_at");
    const rows = e2eCompletionRunRows().filter(
      (row) =>
        (!requestedId || row.id === requestedId) &&
        (!requestedLessonId || row.lesson_id === requestedLessonId) &&
        (!requestedLessonIds || requestedLessonIds.includes(row.lesson_id)) &&
        (!scheduledFrom || row.scheduled_at >= scheduledFrom) &&
        (!scheduledTo || row.scheduled_at < scheduledTo) &&
        (endedFilter !== "is.null" || row.ended_at === null) &&
        (endedFilter !== "not.is.null" || row.ended_at !== null) &&
        (cancelledFilter !== "is.null" || row.cancelled_at === null) &&
        (cancelledFilter !== "not.is.null" || row.cancelled_at !== null),
    );
    if (request.method === "HEAD") {
      exactCountHead(response, rows.length);
      return;
    }
    json(response, 200, rows);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/learning_record") {
    const requestedRecorderId = readEqFilter(
      requestUrl,
      "recorded_by_account_id",
    );
    const requestedLearnerId = readEqFilter(requestUrl, "learner_profile_id");
    const requestedLearnerIds = readInFilter(requestUrl, "learner_profile_id");
    const requestedRunId = readEqFilter(requestUrl, "lesson_run_id");
    const requestedRunIds = readInFilter(requestUrl, "lesson_run_id");
    const requestedCourseId = readEqFilter(requestUrl, "source_course_id");
    const occurredFilter = requestUrl.searchParams.get("occurred_at");
    const supersededFilter = requestUrl.searchParams.get(
      "superseded_by_record_id",
    );
    json(
      response,
      200,
      e2eAllLearningRecordRows().filter(
        (row) =>
          (!requestedRecorderId ||
            row.recorded_by_account_id === requestedRecorderId) &&
          (!requestedLearnerId ||
            row.learner_profile_id === requestedLearnerId) &&
          (!requestedLearnerIds ||
            requestedLearnerIds.includes(row.learner_profile_id)) &&
          (!requestedRunId || row.lesson_run_id === requestedRunId) &&
          (!requestedRunIds ||
            (row.lesson_run_id !== null &&
              requestedRunIds.includes(row.lesson_run_id))) &&
          (!requestedCourseId || row.source_course_id === requestedCourseId) &&
          (occurredFilter !== "is.null" || row.occurred_at === null) &&
          (occurredFilter !== "not.is.null" || row.occurred_at !== null) &&
          (supersededFilter !== "is.null" ||
            (row.superseded_by_record_id ?? null) === null),
      ),
    );
    return;
  }

  const userId = readUserId(requestUrl);
  const isAdultUser = userId === E2E_ADULT_USER_ID;

  if (requestUrl.pathname === "/rest/v1/parent") {
    json(response, 200, []);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/teacher") {
    json(
      response,
      200,
      isAdultUser ? [{ id: E2E_TEACHER_ID, full_name: "E2E Adult" }] : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/student") {
    json(response, 200, []);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/user_preference") {
    json(
      response,
      200,
      isAdultUser
        ? [
            {
              last_active_profile: "teacher",
              last_selected_school_id: null,
              theme: null,
              settings: {},
            },
          ]
        : [],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/school_teacher") {
    const select = requestUrl.searchParams.get("select") ?? "";
    if (select === "teacher_id") {
      json(response, 200, [{ teacher_id: E2E_TEACHER_ID }]);
      return;
    }

    json(response, 200, [
      {
        id: "77777777-7777-4777-8777-777777777777",
        school_id: E2E_SCHOOL_ID,
        teacher_id: E2E_TEACHER_ID,
        role: "owner",
        school: {
          id: E2E_SCHOOL_ID,
          name: "Личное пространство E2E",
          kind: "personal",
          teacher_limit: 1,
        },
      },
    ]);
    return;
  }

  if (requestUrl.pathname === "/rest/v1/user_security") {
    json(response, 200, isAdultUser ? [{ pin_hash: "hash" }] : []);
    return;
  }

  json(response, 404, { message: `Unhandled path: ${requestUrl.pathname}` });
}

async function waitForAppReady(baseUrl: string) {
  const timeoutAt = Date.now() + 60_000;
  let lastError: unknown = null;

  while (Date.now() < timeoutAt) {
    try {
      const response = await requestLocalApp(new URL(baseUrl).pathname, {
        timeoutMs: 5_000,
      });

      if (response.status >= 200 && response.status < 400) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`app did not start in time: ${String(lastError)}`);
}

type LocalAppResponse = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

function requestLocalApp(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer | null;
    timeoutMs?: number;
  } = {},
): Promise<LocalAppResponse> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      ...options.headers,
      host: "v2.shidao.ru",
      "x-forwarded-host": "v2.shidao.ru",
      "x-forwarded-proto": "https",
      "accept-encoding": "identity",
    };
    delete headers.connection;

    const request = httpRequest(
      {
        hostname: "127.0.0.1",
        port: appPort,
        path,
        method: options.method ?? "GET",
        headers,
        timeout: options.timeoutMs ?? 30_000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.once("end", () => {
          const responseHeaders: Record<string, string> = {};
          for (const [name, value] of Object.entries(response.headers)) {
            if (value === undefined) continue;
            responseHeaders[name] = Array.isArray(value)
              ? value.join(name === "set-cookie" ? "\n" : ", ")
              : value;
          }
          delete responseHeaders.connection;
          delete responseHeaders["keep-alive"];
          delete responseHeaders["transfer-encoding"];
          resolve({
            status: response.statusCode ?? 500,
            headers: responseHeaders,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    request.once("timeout", () =>
      request.destroy(new Error("local app request timed out")),
    );
    request.once("error", reject);
    request.end(options.body ?? undefined);
  });
}

async function startBrowserProxy() {
  browserProxyTempDir = await mkdtemp(join(tmpdir(), "shidao-browser-smoke-"));
  const keyPath = join(browserProxyTempDir, "key.pem");
  const certPath = join(browserProxyTempDir, "cert.pem");
  const openssl = spawn(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-sha256",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "1",
      "-subj",
      "/CN=v2.shidao.ru",
    ],
    { stdio: "ignore" },
  );
  await new Promise<void>((resolve, reject) => {
    openssl.once("error", reject);
    openssl.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`openssl exited with code ${String(code)}`));
    });
  });

  const [key, cert] = await Promise.all([
    readFile(keyPath),
    readFile(certPath),
  ]);
  browserProxyServer = createHttpsServer({ key, cert }, (request, response) => {
    const headers: Record<string, string | string[] | undefined> = {
      ...request.headers,
      host: "v2.shidao.ru",
      "x-forwarded-host": "v2.shidao.ru",
      "x-forwarded-proto": "https",
    };
    if (headers.origin && browserSmokeServerMode === "prod") {
      headers.origin = "https://v2.shidao.ru";
    }
    delete headers.connection;

    const upstream = httpRequest(
      {
        hostname: "127.0.0.1",
        port: appPort,
        path: request.url,
        method: request.method,
        headers,
      },
      (upstreamResponse) => {
        response.writeHead(
          upstreamResponse.statusCode ?? 502,
          upstreamResponse.headers,
        );
        upstreamResponse.pipe(response);
      },
    );
    upstream.once("error", (error) => {
      if (!response.headersSent) response.writeHead(502);
      response.end(String(error));
    });
    request.pipe(upstream);
  });
  browserProxyServer.listen(browserProxyPort, "127.0.0.1");
  await once(browserProxyServer, "listening");
}

async function buildProductionApp(env: NodeJS.ProcessEnv) {
  const build = spawn("npm", ["run", "build"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const collect = (chunk: Buffer) => {
    output = `${output}${chunk.toString("utf8")}`.slice(-12_000);
  };
  build.stdout?.on("data", collect);
  build.stderr?.on("data", collect);

  const [code, signal] = (await once(build, "exit")) as [
    number | null,
    NodeJS.Signals | null,
  ];
  if (code !== 0) {
    throw new Error(
      `Production browser-smoke build failed (code=${String(code)}, signal=${String(signal)}).\n${output}`,
    );
  }
}

async function openPage(options?: {
  cookie?: string;
  viewport?: { width: number; height: number };
  mobile?: boolean;
}) {
  if (!chromium || !appPort) {
    throw new Error("browser smoke is not ready");
  }

  const browser = await chromium.launch({
    args: [
      "--host-resolver-rules=MAP v2.shidao.ru 127.0.0.1",
      "--no-proxy-server",
    ],
  });
  const baseURL = `https://v2.shidao.ru:${browserProxyPort}`;
  const context = await browser.newContext({
    baseURL,
    viewport: options?.viewport,
    ignoreHTTPSErrors: true,
    isMobile: options?.mobile,
    hasTouch: options?.mobile,
    deviceScaleFactor: options?.mobile ? 3 : undefined,
  });
  if (options?.cookie) {
    await context.addCookies([
      {
        name: "shidao_session",
        value: options.cookie,
        url: baseURL,
      },
    ]);
  }
  const page = await context.newPage();

  return {
    page,
    async close() {
      await context.close();
      await browser.close();
    },
  };
}

type BrowserSmokePage = Awaited<ReturnType<typeof openPage>>["page"];

type SegmentedEnableFrame = {
  groupReady: string | null;
  indicatorReady: string | null;
  motionReady: string | null;
  selectedDisabled: boolean;
  selectedBackground: string;
  selectedShadow: string;
  indicatorBackground: string;
  indicatorOpacity: string;
  transitionProperty: string;
  transitionDuration: string;
  maxAlignmentDelta: number;
};

type SegmentedEnableProbe = {
  frames: SegmentedEnableFrame[];
  observer: MutationObserver;
};

async function settleSegmentedIndicator(
  page: BrowserSmokePage,
  groupName: string,
) {
  const group = page.getByRole("group", { name: groupName, exact: true });
  const indicator = group.locator(
    '.product-segmented-control-indicator[data-ready="true"]',
  );
  await indicator.waitFor({ state: "attached" });
  await indicator.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve()),
    );
  });
}

async function readSegmentedIndicatorAlignment(
  page: BrowserSmokePage,
  groupName: string,
) {
  await settleSegmentedIndicator(page, groupName);
  return page
    .getByRole("group", { name: groupName, exact: true })
    .evaluate((group) => {
      const indicator = group.querySelector<HTMLElement>(
        ".product-segmented-control-indicator",
      );
      const selected = group.querySelector<HTMLButtonElement>(
        'button[aria-pressed="true"]',
      );
      if (!indicator || !selected) {
        throw new Error(`Segmented indicator alignment is missing`);
      }
      const indicatorRect = indicator.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      const selectedStyle = getComputedStyle(selected);
      return {
        indicatorCount: group.querySelectorAll(
          ".product-segmented-control-indicator",
        ).length,
        groupReady: group.getAttribute("data-indicator-ready"),
        indicatorReady: indicator.getAttribute("data-ready"),
        indicatorMotionReady: indicator.getAttribute("data-motion-ready"),
        indicatorAriaHidden: indicator.getAttribute("aria-hidden"),
        selectedName:
          selected.getAttribute("aria-label") ??
          selected.textContent?.replace(/\s+/g, " ").trim() ??
          "",
        pressedCount: group.querySelectorAll('button[aria-pressed="true"]')
          .length,
        startDelta: Math.abs(indicatorRect.left - selectedRect.left),
        topDelta: Math.abs(indicatorRect.top - selectedRect.top),
        widthDelta: Math.abs(indicatorRect.width - selectedRect.width),
        heightDelta: Math.abs(indicatorRect.height - selectedRect.height),
        selectedBackgroundColor: selectedStyle.backgroundColor,
        selectedBoxShadow: selectedStyle.boxShadow,
      };
    });
}

async function assertSegmentedIndicatorAligned(
  page: BrowserSmokePage,
  groupName: string,
  label: string,
) {
  const contract = await readSegmentedIndicatorAlignment(page, groupName);
  assert.deepEqual(
    {
      indicatorCount: contract.indicatorCount,
      groupReady: contract.groupReady,
      indicatorReady: contract.indicatorReady,
      indicatorMotionReady: contract.indicatorMotionReady,
      indicatorAriaHidden: contract.indicatorAriaHidden,
      pressedCount: contract.pressedCount,
      selectedBackgroundColor: contract.selectedBackgroundColor,
      selectedBoxShadow: contract.selectedBoxShadow,
    },
    {
      indicatorCount: 1,
      groupReady: "true",
      indicatorReady: "true",
      indicatorMotionReady: "true",
      indicatorAriaHidden: "true",
      pressedCount: 1,
      selectedBackgroundColor: "rgba(0, 0, 0, 0)",
      selectedBoxShadow: "none",
    },
    `${label}: one ready indicator and one transparent pressed option`,
  );
  for (const [axis, delta] of Object.entries({
    start: contract.startDelta,
    top: contract.topDelta,
    width: contract.widthDelta,
    height: contract.heightDelta,
  })) {
    assert.ok(
      delta < 0.5,
      `${label}: indicator ${axis} must align to selected option; got ${delta}`,
    );
  }
  return contract;
}

async function assertSegmentedIndicatorPaintsOuterShadow(
  page: BrowserSmokePage,
  groupName: string,
  label: string,
) {
  await settleSegmentedIndicator(page, groupName);
  const group = page.getByRole("group", { name: groupName, exact: true });
  const indicator = group.locator(".product-segmented-control-indicator");
  const computedShadow = await indicator.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  assertSegmentedSurfaceShadow(
    computedShadow,
    E2E_RAISED_CONTROL_SHADOW,
    `${label}: computed shadow`,
  );

  const geometry = await group.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const padding = 8;
    const pageLeft = rect.left + window.scrollX;
    const pageTop = rect.top + window.scrollY;
    const pageRight = rect.right + window.scrollX;
    const pageBottom = rect.bottom + window.scrollY;
    const viewportLeft = window.scrollX;
    const viewportTop = window.scrollY;
    const viewportRight = viewportLeft + window.innerWidth;
    const viewportBottom = viewportTop + window.innerHeight;
    const clipLeft = Math.max(viewportLeft, pageLeft - padding);
    const clipTop = Math.max(viewportTop, pageTop - padding);
    const clipRight = Math.min(viewportRight, pageRight + padding);
    const clipBottom = Math.min(viewportBottom, pageBottom + padding);

    return {
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      group: {
        left: pageLeft,
        top: pageTop,
        right: pageRight,
        bottom: pageBottom,
      },
      clip: {
        x: clipLeft,
        y: clipTop,
        width: clipRight - clipLeft,
        height: clipBottom - clipTop,
      },
    };
  });
  assert.deepEqual(
    { overflowX: geometry.overflowX, overflowY: geometry.overflowY },
    { overflowX: "visible", overflowY: "visible" },
    `${label}: group must not clip the indicator elevation`,
  );
  assert.ok(
    geometry.clip.x <= geometry.group.left - 7.5 &&
      geometry.clip.y <= geometry.group.top - 7.5 &&
      geometry.clip.x + geometry.clip.width >= geometry.group.right + 7.5 &&
      geometry.clip.y + geometry.clip.height >= geometry.group.bottom + 7.5,
    `${label}: screenshot clip must include the full outer shadow`,
  );

  const originalInlineShadow = await indicator.evaluate((element) => {
    const indicatorElement = element as HTMLElement;
    return {
      value: indicatorElement.style.getPropertyValue("box-shadow"),
      priority: indicatorElement.style.getPropertyPriority("box-shadow"),
    };
  });
  const screenshotOptions = {
    animations: "disabled" as const,
    caret: "hide" as const,
    clip: geometry.clip,
    scale: "css" as const,
    type: "png" as const,
  };
  const withOuterShadow = await page.screenshot(screenshotOptions);
  let withoutOuterShadow: Buffer;

  try {
    await indicator.evaluate(async (element) => {
      const indicatorElement = element as HTMLElement;
      indicatorElement.style.setProperty("box-shadow", "none", "important");
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    withoutOuterShadow = await page.screenshot(screenshotOptions);
  } finally {
    await indicator.evaluate(async (element, original) => {
      const indicatorElement = element as HTMLElement;
      if (original.value) {
        indicatorElement.style.setProperty(
          "box-shadow",
          original.value,
          original.priority,
        );
      } else {
        indicatorElement.style.removeProperty("box-shadow");
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    }, originalInlineShadow);
  }

  const [painted, shadowless] = await Promise.all(
    [withOuterShadow, withoutOuterShadow].map((png) =>
      sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    ),
  );
  assert.deepEqual(
    {
      width: painted.info.width,
      height: painted.info.height,
      channels: painted.info.channels,
    },
    {
      width: shadowless.info.width,
      height: shadowless.info.height,
      channels: shadowless.info.channels,
    },
    `${label}: screenshots use identical geometry`,
  );

  let exteriorChangedPixelCount = 0;
  let exteriorTotalChannelDelta = 0;
  let maximumChannelDelta = 0;
  let farthestChangedExteriorDistance = 0;
  const channels = painted.info.channels;
  const scaleX = painted.info.width / geometry.clip.width;
  const scaleY = painted.info.height / geometry.clip.height;
  for (let pixelY = 0; pixelY < painted.info.height; pixelY += 1) {
    const cssY = geometry.clip.y + (pixelY + 0.5) / scaleY;
    for (let pixelX = 0; pixelX < painted.info.width; pixelX += 1) {
      const cssX = geometry.clip.x + (pixelX + 0.5) / scaleX;
      const exteriorDistance = Math.max(
        geometry.group.left - cssX,
        cssX - geometry.group.right,
        geometry.group.top - cssY,
        cssY - geometry.group.bottom,
        0,
      );
      if (exteriorDistance < 1) continue;

      const offset = (pixelY * painted.info.width + pixelX) * channels;
      let pixelDelta = 0;
      for (let channel = 0; channel < Math.min(3, channels); channel += 1) {
        const delta = Math.abs(
          painted.data[offset + channel]! - shadowless.data[offset + channel]!,
        );
        pixelDelta += delta;
        maximumChannelDelta = Math.max(maximumChannelDelta, delta);
      }
      exteriorTotalChannelDelta += pixelDelta;
      if (pixelDelta >= 3) {
        exteriorChangedPixelCount += 1;
        farthestChangedExteriorDistance = Math.max(
          farthestChangedExteriorDistance,
          exteriorDistance,
        );
      }
    }
  }

  const devicePixelArea = scaleX * scaleY;
  const normalizedChangedArea = exteriorChangedPixelCount / devicePixelArea;
  const normalizedChannelDelta = exteriorTotalChannelDelta / devicePixelArea;
  assert.ok(
    normalizedChangedArea >= 8 &&
      normalizedChannelDelta >= 48 &&
      maximumChannelDelta >= 1 &&
      farthestChangedExteriorDistance >= 1.5,
    `${label}: the elevation must paint beyond the group border; got ${JSON.stringify({ normalizedChangedArea, normalizedChannelDelta, maximumChannelDelta, farthestChangedExteriorDistance })}`,
  );
}

async function activateSegmentedOptionWithMotion(
  page: BrowserSmokePage,
  options: {
    groupName: string;
    optionName: string;
    label: string;
    expectWidthTransition?: boolean;
  },
) {
  const group = page.getByRole("group", {
    name: options.groupName,
    exact: true,
  });
  await group
    .locator(
      '.product-segmented-control-indicator[data-ready="true"][data-motion-ready="true"]',
    )
    .waitFor({ state: "attached" });
  const marker = `${options.groupName}-${options.optionName}-${Date.now()}`;
  const motion = await group.evaluate(
    async (element, { optionName, marker: identity }) => {
      const indicator = element.querySelector<HTMLElement>(
        ".product-segmented-control-indicator",
      );
      const buttons = Array.from(
        element.querySelectorAll<HTMLButtonElement>("button"),
      );
      const buttonName = (button: HTMLButtonElement) =>
        button.getAttribute("aria-label") ??
        button.textContent?.replace(/\s+/g, " ").trim() ??
        "";
      const selectedBefore = buttons.find(
        (button) => button.getAttribute("aria-pressed") === "true",
      );
      const target = buttons.find(
        (button) => buttonName(button) === optionName,
      );
      if (!indicator || !selectedBefore || !target) {
        throw new Error(`Segmented motion elements are missing`);
      }
      if (selectedBefore === target) {
        throw new Error(`Segmented motion target is already selected`);
      }

      indicator.dataset.browserSmokeIdentity = identity;
      const initialIndicatorRect = indicator.getBoundingClientRect();
      const initialSelectedRect = selectedBefore.getBoundingClientRect();
      const targetRectBefore = target.getBoundingClientRect();
      target.click();

      let runningAnimations: Animation[] = [];
      for (let frame = 0; frame < 30; frame += 1) {
        await new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => resolve()),
        );
        runningAnimations = indicator
          .getAnimations()
          .filter((animation) => animation.playState === "running");
        if (
          target.getAttribute("aria-pressed") === "true" &&
          runningAnimations.length > 0
        ) {
          break;
        }
      }

      const running = runningAnimations.map((animation) => {
        const transition = animation as CSSTransition;
        const timing = animation.effect?.getComputedTiming();
        return {
          property: transition.transitionProperty ?? "",
          duration:
            typeof timing?.duration === "number" ? timing.duration : null,
          playState: animation.playState,
        };
      });
      const indicatorStyleDuringMotion = getComputedStyle(indicator);
      await Promise.all(
        indicator
          .getAnimations()
          .map((animation) => animation.finished.catch(() => undefined)),
      );
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );

      const finalIndicator = element.querySelector<HTMLElement>(
        ".product-segmented-control-indicator",
      );
      const selectedAfter = element.querySelector<HTMLButtonElement>(
        'button[aria-pressed="true"]',
      );
      if (!finalIndicator || !selectedAfter) {
        throw new Error(`Segmented motion final state is missing`);
      }
      const finalIndicatorRect = finalIndicator.getBoundingClientRect();
      const finalSelectedRect = selectedAfter.getBoundingClientRect();
      return {
        selectedBefore: buttonName(selectedBefore),
        selectedAfter: buttonName(selectedAfter),
        initialIndicatorWidth: initialIndicatorRect.width,
        initialSelectedWidth: initialSelectedRect.width,
        targetWidth: targetRectBefore.width,
        running,
        transitionProperty: indicatorStyleDuringMotion.transitionProperty,
        transitionDuration: indicatorStyleDuringMotion.transitionDuration,
        transitionTimingFunction:
          indicatorStyleDuringMotion.transitionTimingFunction,
        sameIndicator:
          finalIndicator === indicator &&
          finalIndicator.dataset.browserSmokeIdentity === identity,
        indicatorCount: element.querySelectorAll(
          ".product-segmented-control-indicator",
        ).length,
        pressedCount: element.querySelectorAll('button[aria-pressed="true"]')
          .length,
        startDelta: Math.abs(finalIndicatorRect.left - finalSelectedRect.left),
        topDelta: Math.abs(finalIndicatorRect.top - finalSelectedRect.top),
        widthDelta: Math.abs(
          finalIndicatorRect.width - finalSelectedRect.width,
        ),
        heightDelta: Math.abs(
          finalIndicatorRect.height - finalSelectedRect.height,
        ),
      };
    },
    { optionName: options.optionName, marker },
  );

  assert.equal(motion.selectedAfter, options.optionName);
  assert.notEqual(motion.selectedBefore, options.optionName);
  assert.equal(motion.sameIndicator, true, `${options.label}: same indicator`);
  assert.equal(motion.indicatorCount, 1, `${options.label}: one indicator`);
  assert.equal(motion.pressedCount, 1, `${options.label}: one pressed option`);
  assert.equal(
    motion.transitionProperty,
    "width, transform, opacity",
    `${options.label}: shared motion properties`,
  );
  assert.equal(
    motion.transitionDuration,
    "0.36s, 0.36s, 0.12s",
    `${options.label}: shared motion duration`,
  );
  assert.equal(
    motion.transitionTimingFunction,
    "cubic-bezier(0.22, 1, 0.36, 1), cubic-bezier(0.22, 1, 0.36, 1), ease",
    `${options.label}: shared motion easing`,
  );
  assert.ok(
    motion.running.some(
      ({ property, duration, playState }) =>
        property === "transform" && duration === 360 && playState === "running",
    ),
    `${options.label}: real 360ms transform transition must run: ${JSON.stringify(motion.running)}`,
  );
  if (options.expectWidthTransition) {
    assert.notEqual(
      motion.initialIndicatorWidth,
      motion.targetWidth,
      `${options.label}: selected text widths must differ`,
    );
    assert.ok(
      motion.running.some(
        ({ property, duration, playState }) =>
          property === "width" && duration === 360 && playState === "running",
      ),
      `${options.label}: real 360ms width transition must run: ${JSON.stringify(motion.running)}`,
    );
  } else {
    assert.ok(
      Math.abs(motion.initialIndicatorWidth - motion.initialSelectedWidth) <
        0.5,
    );
  }
  for (const [axis, delta] of Object.entries({
    start: motion.startDelta,
    top: motion.topDelta,
    width: motion.widthDelta,
    height: motion.heightDelta,
  })) {
    assert.ok(
      delta < 0.5,
      `${options.label}: final ${axis} alignment failed with ${delta}`,
    );
  }
  return motion;
}

async function assertRapidSegmentedRetarget(
  page: BrowserSmokePage,
  options: {
    groupName: string;
    firstOptionName: string;
    finalOptionName: string;
    label: string;
  },
) {
  const group = page.getByRole("group", {
    name: options.groupName,
    exact: true,
  });
  await settleSegmentedIndicator(page, options.groupName);
  const marker = `${options.groupName}-rapid-${Date.now()}`;
  const result = await group.evaluate(
    async (element, payload) => {
      const root = element as HTMLElement;
      const indicator = root.querySelector<HTMLElement>(
        ".product-segmented-control-indicator",
      );
      const buttons = Array.from(
        root.querySelectorAll<HTMLButtonElement>("button"),
      );
      const buttonName = (button: HTMLButtonElement) =>
        button.getAttribute("aria-label") ??
        button.textContent?.replace(/\s+/g, " ").trim() ??
        "";
      const first = buttons.find(
        (button) => buttonName(button) === payload.firstOptionName,
      );
      const final = buttons.find(
        (button) => buttonName(button) === payload.finalOptionName,
      );
      if (!indicator || !first || !final || first === final) {
        throw new Error("Rapid segmented retarget elements are missing");
      }

      indicator.dataset.browserSmokeIdentity = payload.marker;
      const initialIndicatorRect = indicator.getBoundingClientRect();
      first.click();
      let firstRunning: Animation[] = [];
      let firstMoved = false;
      for (let frame = 0; frame < 30; frame += 1) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        firstRunning = indicator
          .getAnimations()
          .filter((animation) => animation.playState === "running");
        firstMoved =
          Math.abs(
            indicator.getBoundingClientRect().left - initialIndicatorRect.left,
          ) > 0.5;
        if (
          first.getAttribute("aria-pressed") === "true" &&
          firstRunning.length > 0 &&
          firstMoved
        ) {
          break;
        }
      }
      const firstProperties = firstRunning.map(
        (animation) => (animation as CSSTransition).transitionProperty ?? "",
      );

      final.click();
      let secondRunning: Animation[] = [];
      for (let frame = 0; frame < 30; frame += 1) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        secondRunning = indicator
          .getAnimations()
          .filter((animation) => animation.playState === "running");
        if (
          final.getAttribute("aria-pressed") === "true" &&
          secondRunning.length > 0
        ) {
          break;
        }
      }
      const secondProperties = secondRunning.map(
        (animation) => (animation as CSSTransition).transitionProperty ?? "",
      );
      await Promise.all(
        indicator
          .getAnimations()
          .map((animation) => animation.finished.catch(() => undefined)),
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );

      const selected = root.querySelector<HTMLButtonElement>(
        'button[aria-pressed="true"]',
      );
      if (!selected) throw new Error("Rapid retarget selection is missing");
      const indicatorRect = indicator.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      await new Promise<void>((resolve) => setTimeout(resolve, 420));
      const stableRect = indicator.getBoundingClientRect();
      return {
        firstProperties,
        firstMoved,
        secondProperties,
        sameIndicator:
          root.querySelector(".product-segmented-control-indicator") ===
            indicator &&
          indicator.dataset.browserSmokeIdentity === payload.marker,
        indicatorCount: root.querySelectorAll(
          ".product-segmented-control-indicator",
        ).length,
        finalName: buttonName(selected),
        pressedCount: root.querySelectorAll('button[aria-pressed="true"]')
          .length,
        startDelta: Math.abs(indicatorRect.left - selectedRect.left),
        topDelta: Math.abs(indicatorRect.top - selectedRect.top),
        widthDelta: Math.abs(indicatorRect.width - selectedRect.width),
        heightDelta: Math.abs(indicatorRect.height - selectedRect.height),
        stableStartDelta: Math.abs(stableRect.left - indicatorRect.left),
        stableWidthDelta: Math.abs(stableRect.width - indicatorRect.width),
      };
    },
    {
      firstOptionName: options.firstOptionName,
      finalOptionName: options.finalOptionName,
      marker,
    },
  );

  assert.ok(
    result.firstProperties.includes("transform"),
    `${options.label}: first retarget must start a transform transition`,
  );
  assert.equal(
    result.firstMoved,
    true,
    `${options.label}: first transition must visibly advance before retargeting`,
  );
  assert.ok(
    result.secondProperties.includes("transform"),
    `${options.label}: second retarget must replace it with a running transform transition`,
  );
  assert.equal(result.sameIndicator, true, `${options.label}: same indicator`);
  assert.equal(result.indicatorCount, 1, `${options.label}: one indicator`);
  assert.equal(result.finalName, options.finalOptionName);
  assert.equal(result.pressedCount, 1, `${options.label}: one pressed option`);
  for (const [axis, delta] of Object.entries({
    start: result.startDelta,
    top: result.topDelta,
    width: result.widthDelta,
    height: result.heightDelta,
    stableStart: result.stableStartDelta,
    stableWidth: result.stableWidthDelta,
  })) {
    assert.ok(
      delta < 0.5,
      `${options.label}: final ${axis} alignment failed with ${delta}`,
    );
  }
}

async function readMobileEditableContract(page: BrowserSmokePage) {
  return page.evaluate(() => {
    const nonTextInputTypes = new Set([
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "image",
      "radio",
      "range",
      "reset",
      "submit",
    ]);
    const controls = Array.from(
      document.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input, select, textarea"),
    ).filter((control) => {
      if (
        control instanceof HTMLInputElement &&
        nonTextInputTypes.has(control.type.toLowerCase())
      ) {
        return false;
      }
      const style = getComputedStyle(control);
      return (
        control.getClientRects().length > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });

    return {
      clientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      controls: controls.map((control) => {
        const ordinaryProductEditable = control.matches(
          ".product-control, .field-input, .teaching-hub-search input, .student-directory-picker-search input",
        );
        return {
          tag: control.tagName.toLowerCase(),
          type:
            control instanceof HTMLInputElement
              ? control.type.toLowerCase()
              : "",
          name:
            control.getAttribute("aria-label") ??
            control.getAttribute("name") ??
            control.id,
          fontSize: Number.parseFloat(getComputedStyle(control).fontSize),
          height: control.getBoundingClientRect().height,
          ordinaryProductEditable,
          rawAuthoredExercise:
            !ordinaryProductEditable &&
            Boolean(control.closest("[data-course-component-type]")),
          canonicalSingleLine: control.matches(
            "input.product-control-input, input.product-control-search, input.field-input, select.product-control, select.field-input",
          ),
        };
      }),
    };
  });
}

function assertMobileEditableContract(
  contract: Awaited<ReturnType<typeof readMobileEditableContract>>,
  expectedWidth: number,
  label: string,
) {
  assert.equal(contract.clientWidth, expectedWidth, `${label}: viewport width`);
  assert.equal(
    contract.documentScrollWidth,
    contract.clientWidth,
    `${label}: document must not overflow horizontally`,
  );
  assert.ok(
    contract.bodyScrollWidth <= contract.clientWidth,
    `${label}: body must not overflow horizontally`,
  );
  assert.ok(
    contract.controls.every((control) => control.fontSize >= 16),
    `${label}: every visible editable control must remain at least 16px and avoid iOS focus zoom: ${JSON.stringify(contract.controls)}`,
  );
  assert.ok(
    contract.controls
      .filter((control) => control.ordinaryProductEditable)
      .every((control) => Math.abs(control.fontSize - 16) < 0.02),
    `${label}: ordinary product editables must stay at the 16px Safari anti-zoom floor: ${JSON.stringify(contract.controls)}`,
  );
  assert.ok(
    contract.controls
      .filter((control) => control.rawAuthoredExercise)
      .every((control) => Math.abs(control.fontSize - 16) < 0.02),
    `${label}: raw authored exercise editables must stay at the 16px anti-zoom floor instead of inheriting product typography: ${JSON.stringify(contract.controls)}`,
  );
  assert.ok(
    contract.controls
      .filter((control) => control.canonicalSingleLine)
      .every(
        (control) =>
          Math.abs(control.height - 40) < 0.5 &&
          Math.abs(control.fontSize - 16) < 0.02,
      ),
    `${label}: canonical single-line controls must be exactly 40px with a 16px anti-zoom font: ${JSON.stringify(contract.controls)}`,
  );
}

before(async () => {
  try {
    const loadPlaywright = new Function(
      "return import('playwright')",
    ) as () => Promise<{
      chromium?: PlaywrightChromium;
    }>;
    const playwrightModule = await loadPlaywright();
    chromium = playwrightModule.chromium ?? null;
  } catch {
    assertBrowserSmokeRequirement(
      "Install 'playwright' to enable real browser smoke tests.",
    );
    return;
  }

  if (!chromium) {
    assertBrowserSmokeRequirement(
      "Install 'playwright' to enable real browser smoke tests.",
    );
    return;
  }

  try {
    const browser = await chromium.launch();
    await browser.close();
  } catch (error) {
    assertBrowserSmokeRequirement(resolveBrowserInstallHint(error));
    chromium = null;
    return;
  }

  mockPort = await allocatePort();
  appPort = await allocatePort();
  browserProxyPort = await allocatePort();

  mockServer = createServer(handleMockSupabase);
  mockServer.listen(mockPort, "127.0.0.1");
  await once(mockServer, "listening");

  const serverEnv = {
    ...process.env,
    APP_SESSION_SECRET,
    LEARNER_IDENTITY_DIGEST_KEY:
      "e2e-learner-identity-digest-key-with-minimum-32-chars",
    NEXT_PUBLIC_APP_URL: `https://v2.shidao.ru:${browserProxyPort}`,
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-key",
  };

  if (browserSmokeServerMode === "prod") {
    await buildProductionApp(serverEnv);
  }

  appServerProcess = spawn(
    "npm",
    [
      "run",
      browserSmokeServerMode === "prod" ? "start" : "dev",
      "--",
      "--port",
      String(appPort),
    ],
    {
      cwd: process.cwd(),
      env: serverEnv,
      stdio: "ignore",
      detached: true,
    },
  );
  appServerProcess.unref();

  await waitForAppReady(`http://127.0.0.1:${appPort}`);
  await startBrowserProxy();
});

after(async () => {
  if (browserProxyServer) {
    browserProxyServer.closeAllConnections?.();
    browserProxyServer.close();
    await Promise.race([
      once(browserProxyServer, "close"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }

  if (appServerProcess?.pid) {
    try {
      process.kill(-appServerProcess.pid, "SIGTERM");
    } catch {
      // process already exited
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      process.kill(-appServerProcess.pid, "SIGKILL");
    } catch {
      // process already exited
    }
  }

  if (mockServer) {
    mockServer.closeAllConnections?.();
    mockServer.close();
    await Promise.race([
      once(mockServer, "close"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }

  if (browserProxyTempDir) {
    await rm(browserProxyTempDir, { recursive: true, force: true });
  }
});

test("browser smoke: guest opens / and sees guest header CTA", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  {
    const runtime = await openPage();

    try {
      await runtime.page.goto("/", { waitUntil: "networkidle" });
      const html = await runtime.page.content();

      assert.match(html, /Войти/);
      assert.match(html, /Создать аккаунт/);
    } finally {
      await runtime.close();
    }
  }
});

test("browser smoke: restored standalone demo navigates across its local views", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage();

  try {
    await runtime.page.goto("/demo?view=schedule", {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByRole("heading", { name: "Добрый день, Агата", level: 1 })
      .waitFor();

    const scheduleContract = await runtime.page.evaluate(() => {
      const root = document.querySelector<HTMLElement>(".demo-v2-root");
      const navLabels = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          ".demo-main-nav .demo-nav-item",
        ),
      ).map((button) => button.textContent?.trim() ?? "");

      if (!root) throw new Error("Standalone demo root is missing");

      return {
        backgroundColor: getComputedStyle(root).backgroundColor,
        navLabels,
      };
    });

    assert.equal(scheduleContract.backgroundColor, "rgb(245, 241, 232)");
    assert.deepEqual(scheduleContract.navLabels, [
      "Расписание",
      "Ученики",
      "Курсы",
    ]);

    await runtime.page
      .getByRole("button", { name: "Курсы", exact: true })
      .click();
    await runtime.page.waitForURL(/\/demo\?view=courses$/);
    await runtime.page
      .getByRole("heading", { name: "Курсы", exact: true, level: 1 })
      .waitFor();

    const html = await runtime.page.content();
    assert.match(html, /English B1 · подростки/);
    assert.match(html, /Открыть курс/);
  } finally {
    await runtime.close();
  }
});

test("browser smoke: authenticated landing avatar links directly to Profile", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    const sessionResponse = await runtime.page.goto("/api/auth/session", {
      waitUntil: "networkidle",
    });
    assert.ok(sessionResponse);
    assert.equal(sessionResponse.status(), 200);
    const sessionPayload = (await sessionResponse.json()) as Record<
      string,
      unknown
    >;
    assert.equal(sessionPayload.fullName, "E2E Adult");
    assert.equal(sessionPayload.email, "adult-e2e@example.test");
    assert.deepEqual(sessionPayload.avatar, {
      kind: "preset",
      presetKey: "sd-avatar-v1-01",
      revision: 1,
    });
    assert.doesNotMatch(
      JSON.stringify(sessionPayload),
      /avatar_storage_path|storagePath|profile-avatars/,
    );

    await runtime.page.goto("/", { waitUntil: "networkidle" });
    const html = await runtime.page.content();

    assert.match(html, /E2E Adult/);
    const profileLink = runtime.page.getByRole("link", {
      name: "Открыть профиль",
      exact: true,
    });
    await profileLink.waitFor();
    assert.equal(await profileLink.getAttribute("href"), "/profile");
    assert.equal(await profileLink.getAttribute("aria-haspopup"), null);
    assert.equal(
      await runtime.page
        .getByRole("button", { name: /Открыть меню пользователя/ })
        .count(),
      0,
    );
    assert.equal(
      await runtime.page
        .getByRole("menu", { name: /Меню пользователя/ })
        .count(),
      0,
    );

    await Promise.all([
      runtime.page.waitForURL(/\/profile$/),
      profileLink.click(),
    ]);
    await runtime.page
      .getByRole("heading", { name: "E2E Adult", exact: true, level: 1 })
      .waitFor();
  } finally {
    await runtime.close();
  }
});

test("browser smoke: guest on protected routes is redirected to /login", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  for (const protectedPath of [
    "/courses",
    "/schedule",
    "/students",
    "/store",
  ]) {
    const runtime = await openPage();
    try {
      await runtime.page.goto(protectedPath, { waitUntil: "domcontentloaded" });
      assert.equal(new URL(runtime.page.url()).pathname, "/login");
    } finally {
      await runtime.close();
    }
  }
});

test("browser smoke: Store cart and checkout remain an explicit local demo", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({
    cookie: authenticatedCookieValue(),
    viewport: { width: 1280, height: 720 },
  });

  try {
    await runtime.page.goto(
      "/store?product=propisi-pervye-kitaiskie-ieroglify",
      { waitUntil: "networkidle" },
    );
    await runtime.page
      .getByRole("heading", { name: "Магазин", exact: true, level: 1 })
      .waitFor();
    assert.equal(
      await runtime.page
        .getByText("Демо · без оплаты", { exact: true })
        .count(),
      0,
    );
    const workbookTab = runtime.page.getByRole("tab", {
      name: /Прописи и тетради/,
    });
    await workbookTab.waitFor();
    assert.equal(await workbookTab.getAttribute("aria-selected"), "true");
    assert.equal(
      await runtime.page.evaluate(() => document.activeElement?.id),
      "store-product-store-product-001",
    );
    assert.equal(
      await runtime.page.getByText("В наличии", { exact: true }).count(),
      0,
    );
    assert.equal(
      await runtime.page.getByText("Нет в наличии", { exact: true }).count(),
      0,
    );
    assert.equal(await runtime.page.locator(".store-product-table").count(), 0);

    const firstProduct = runtime.page.locator(
      "#store-product-store-product-001",
    );
    const firstCarousel = firstProduct.getByRole("group", {
      name: "Фотографии товара: Прописи «Первые китайские иероглифы»",
      exact: true,
    });
    const firstProductImage = firstCarousel.locator("img");
    await firstProductImage.waitFor();
    await runtime.page.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>(
        "#store-product-store-product-001 .store-product-carousel img",
      );
      return Boolean(image?.complete && image.naturalWidth > 0);
    });
    const firstImageState = await firstProductImage.evaluate((node) => {
      const image = node as HTMLImageElement;
      const rect = image.getBoundingClientRect();
      return {
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        currentSrc: image.currentSrc,
        srcset: image.getAttribute("srcset") ?? "",
        width: rect.width,
        height: rect.height,
      };
    });
    assert.equal(firstImageState.complete, true);
    assert.ok(firstImageState.naturalWidth > 0);
    assert.ok(firstImageState.naturalWidth <= 1254);
    assert.match(firstImageState.currentSrc, /\/_next\/image\?/);
    assert.match(firstImageState.srcset, /\/_next\/image\?/);
    assert.ok(Math.abs(firstImageState.width - firstImageState.height) < 1);
    assert.equal(await firstCarousel.getAttribute("data-image-index"), "0");

    const secondCarousel = runtime.page
      .locator("#store-product-store-product-002")
      .getByRole("group", {
        name: "Фотографии товара: Тетрадь мицзыгэ для каллиграфии",
        exact: true,
      });
    assert.equal(await secondCarousel.getAttribute("data-image-index"), "0");
    await firstCarousel
      .getByRole("button", {
        name: "Следующее фото товара: Прописи «Первые китайские иероглифы»",
        exact: true,
      })
      .click();
    assert.equal(await firstCarousel.getAttribute("data-image-index"), "1");
    assert.equal(await secondCarousel.getAttribute("data-image-index"), "0");
    assert.equal(await runtime.page.getByRole("dialog").count(), 0);
    await firstCarousel
      .getByRole("button", {
        name: "Предыдущее фото товара: Прописи «Первые китайские иероглифы»",
        exact: true,
      })
      .click();
    assert.equal(await firstCarousel.getAttribute("data-image-index"), "0");

    const productImageOpener = firstCarousel.getByRole("button", {
      name: "Открыть товар: Прописи «Первые китайские иероглифы»",
      exact: true,
    });
    await productImageOpener.click();
    let productDialog = runtime.page.getByRole("dialog", {
      name: "Прописи «Первые китайские иероглифы»",
      exact: true,
    });
    await productDialog.waitFor();
    await runtime.page.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>(
        ".store-product-dialog .store-product-image",
      );
      return Boolean(image?.complete && image.naturalWidth > 0);
    });
    assert.equal((await productDialog.getByRole("img").count()) >= 1, true);
    assert.equal(
      await productDialog
        .getByRole("button", { name: /Показать фото/ })
        .count(),
      3,
    );
    await productDialog
      .getByRole("button", { name: /^Показать фото 3:/ })
      .click();
    assert.equal(
      await productDialog
        .getByRole("group", {
          name: "Фотографии товара: Прописи «Первые китайские иероглифы»",
          exact: true,
        })
        .getAttribute("data-image-index"),
      "2",
    );
    const productDialogRect = await productDialog.evaluate((dialog) => {
      const rect = dialog.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    assert.ok(productDialogRect.width >= 800);
    assert.ok(productDialogRect.height >= 600);
    await productDialog
      .getByRole("button", { name: "В корзину", exact: true })
      .click();
    await productDialog
      .getByRole("button", { name: "Добавить ещё · 1", exact: true })
      .waitFor();
    await productDialog
      .getByRole("button", { name: "Закрыть товар", exact: true })
      .click();
    await productDialog.waitFor({ state: "detached" });
    assert.equal(await firstCarousel.getAttribute("data-image-index"), "2");
    assert.equal(
      await productImageOpener.evaluate(
        (button) => document.activeElement === button,
      ),
      true,
    );

    const productTitleOpener = firstProduct.getByRole("button", {
      name: "Прописи «Первые китайские иероглифы»",
      exact: true,
    });
    await productTitleOpener.click();
    productDialog = runtime.page.getByRole("dialog", {
      name: "Прописи «Первые китайские иероглифы»",
      exact: true,
    });
    await productDialog.waitFor();
    await runtime.page.keyboard.press("Escape");
    await productDialog.waitFor({ state: "detached" });
    assert.equal(
      await productTitleOpener.evaluate(
        (button) => document.activeElement === button,
      ),
      true,
    );

    const comfortableView = runtime.page.getByRole("button", {
      name: "Показать крупные карточки товаров",
      exact: true,
    });
    const compactView = runtime.page.getByRole("button", {
      name: "Показать компактные карточки товаров",
      exact: true,
    });
    assert.equal(await comfortableView.getAttribute("aria-pressed"), "true");
    await assertSegmentedIndicatorAligned(
      runtime.page,
      "Вид товаров",
      "Store desktop view",
    );
    await assertRapidSegmentedRetarget(runtime.page, {
      groupName: "Вид товаров",
      firstOptionName: "Показать компактные карточки товаров",
      finalOptionName: "Показать крупные карточки товаров",
      label: "Store rapid view retarget",
    });
    const comfortableGrid = runtime.page.locator(
      '.store-product-grid[data-density="comfortable"]',
    );
    const productTitles = await comfortableGrid
      .locator(".store-product-card h2")
      .allTextContents();
    assert.equal(
      await comfortableGrid.evaluate(
        (grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      ),
      3,
    );
    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Вид товаров",
      optionName: "Показать компактные карточки товаров",
      label: "Store comfortable-to-compact",
    });
    const compactGrid = runtime.page.locator(
      '.store-product-grid[data-density="compact"]',
    );
    await compactGrid.waitFor();
    assert.deepEqual(
      await compactGrid.locator(".store-product-card h2").allTextContents(),
      productTitles,
    );
    assert.equal(
      await compactGrid.evaluate(
        (grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      ),
      6,
    );
    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Вид товаров",
      optionName: "Показать крупные карточки товаров",
      label: "Store compact-to-comfortable",
    });

    const stationeryTab = runtime.page.getByRole("tab", {
      name: /Канцелярия/,
    });
    await stationeryTab.click();
    const markerAddButton = runtime.page.getByRole("button", {
      name: "Добавить в корзину: Маркеры-кисточки для каллиграфии",
      exact: true,
    });
    await markerAddButton.waitFor();
    assert.equal(await markerAddButton.isEnabled(), true);
    await workbookTab.click();
    assert.equal(
      await runtime.page.locator(".store-toolbar .store-filter-menu").count(),
      0,
    );
    assert.equal(
      await runtime.page.locator(".store-toolbar select").count(),
      0,
    );
    assert.equal(
      await runtime.page
        .getByRole("button", { name: "Очистить поиск", exact: true })
        .count(),
      0,
    );

    const storeSearch = runtime.page.getByRole("searchbox", {
      name: "Поиск товаров",
      exact: true,
    });
    await storeSearch.click();
    assert.deepEqual(
      await storeSearch.evaluate((input) => {
        const style = getComputedStyle(input);
        return {
          outlineColor: style.outlineColor,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineOffset: style.outlineOffset,
        };
      }),
      {
        outlineColor: E2E_FOCUS_HALO_COLOR,
        outlineStyle: "solid",
        outlineWidth: "2px",
        outlineOffset: "0px",
      },
    );

    const storeSort = runtime.page.getByRole("combobox", {
      name: "Сортировка товаров: Сначала популярные",
      exact: true,
    });
    assert.equal(await storeSort.getAttribute("aria-haspopup"), "listbox");
    assert.equal(await storeSort.getAttribute("aria-expanded"), "false");
    const storeSortPanelId = await storeSort.getAttribute("aria-controls");
    assert.ok(storeSortPanelId);
    await storeSort.click();
    assert.equal(await storeSort.getAttribute("aria-expanded"), "true");
    assert.deepEqual(
      await storeSort.evaluate((trigger) => {
        const style = getComputedStyle(trigger);
        return {
          outlineStyle: style.outlineStyle,
        };
      }),
      { outlineStyle: "none" },
    );
    const storeSortListbox = runtime.page.getByRole("listbox", {
      name: "Сортировка товаров",
      exact: true,
    });
    await storeSortListbox.waitFor();
    assert.equal(await storeSortListbox.getAttribute("id"), storeSortPanelId);
    await assertCanonicalProductDropdownSurface(
      storeSortListbox,
      "Store sort listbox",
    );
    assert.equal(await storeSortListbox.getByRole("option").count(), 4);
    assert.equal(
      await storeSortListbox
        .getByRole("option", { name: "Сначала популярные", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await storeSort.press("Escape");
    await storeSortListbox.waitFor({ state: "detached" });
    assert.equal(await storeSort.getAttribute("aria-expanded"), "false");
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.getAttribute("role"),
      ),
      "combobox",
    );
    assert.deepEqual(
      await storeSort.evaluate((trigger) => {
        const style = getComputedStyle(trigger);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineOffset: style.outlineOffset,
        };
      }),
      {
        outlineStyle: "solid",
        outlineWidth: "2px",
        outlineOffset: "-2px",
      },
    );
    await storeSort.press("ArrowDown");
    await storeSort.press("ArrowDown");
    assert.match(
      (await storeSort.getAttribute("aria-activedescendant")) ?? "",
      /price-asc$/,
    );
    await storeSort.press("Enter");
    await runtime.page
      .getByRole("combobox", {
        name: "Сортировка товаров: Сначала дешевле",
        exact: true,
      })
      .waitFor();
    assert.equal(
      (
        await runtime.page
          .locator(".store-product-grid .store-product-card h2")
          .nth(0)
          .textContent()
      )?.trim(),
      "Тетрадь мицзыгэ для каллиграфии",
    );
    assert.equal(
      await runtime.page
        .getByRole("button", { name: "Очистить поиск", exact: true })
        .count(),
      0,
    );
    const updatedStoreSort = runtime.page.getByRole("combobox", {
      name: "Сортировка товаров: Сначала дешевле",
      exact: true,
    });
    await updatedStoreSort.click();
    await runtime.page.getByRole("listbox").waitFor();
    await runtime.page
      .getByRole("heading", { name: "Магазин", exact: true, level: 1 })
      .click();
    await runtime.page.getByRole("listbox").waitFor({ state: "detached" });
    assert.equal(await updatedStoreSort.getAttribute("aria-expanded"), "false");
    await storeSearch.fill("каллиграфии");
    const clearStoreSearch = runtime.page.getByRole("button", {
      name: "Очистить поиск",
      exact: true,
    });
    await clearStoreSearch.waitFor();
    await clearStoreSearch.click();
    assert.equal(await storeSearch.inputValue(), "");
    assert.equal(await workbookTab.getAttribute("aria-selected"), "true");
    await updatedStoreSort.waitFor();
    assert.equal(await clearStoreSearch.count(), 0);

    const storeProductSurface = runtime.page.locator(
      "#store-product-store-product-001 .surface-card.store-product-card-surface",
    );
    await storeProductSurface.waitFor();
    assert.deepEqual(
      await storeProductSurface.evaluate((surface) => {
        const style = getComputedStyle(surface);
        return {
          borderColor: style.borderTopColor,
          borderStyle: style.borderTopStyle,
          borderWidth: style.borderTopWidth,
          backgroundClip: style.backgroundClip,
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      {
        borderColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
        borderStyle: "solid",
        borderWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
        backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
        boxShadow: E2E_RAISED_SURFACE_SHADOW,
        transform: "none",
      },
    );
    await storeProductSurface.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await storeProductSurface.evaluate((surface) => {
        const style = getComputedStyle(surface);
        return {
          borderTopWidth: style.borderTopWidth,
          backgroundClip: style.backgroundClip,
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      {
        borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
        backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
        boxShadow: E2E_RAISED_SURFACE_SHADOW,
        transform: "none",
      },
    );

    await runtime.page
      .getByRole("button", {
        name: "Добавить в корзину: Прописи «Первые китайские иероглифы»",
        exact: true,
      })
      .waitFor();
    await runtime.page
      .getByRole("button", {
        name: "Прописи «Первые китайские иероглифы»",
        exact: true,
      })
      .click();
    productDialog = runtime.page.getByRole("dialog", {
      name: "Прописи «Первые китайские иероглифы»",
      exact: true,
    });
    await productDialog.waitFor();
    await productDialog
      .getByRole("button", { name: "Оформить сразу", exact: true })
      .click();
    const directDeliveryDialog = runtime.page.getByRole("dialog", {
      name: "Куда доставить",
      exact: true,
    });
    await directDeliveryDialog.waitFor();
    assert.equal(await runtime.page.getByRole("dialog").count(), 1);
    assert.equal(
      await runtime.page
        .getByRole("button", {
          name: "Открыть корзину, товаров: 1",
          exact: true,
        })
        .count(),
      1,
    );
    await runtime.page.keyboard.press("Escape");
    await directDeliveryDialog.waitFor({ state: "detached" });
    await runtime.page
      .getByRole("button", {
        name: "Открыть корзину, товаров: 1",
        exact: true,
      })
      .click();

    let dialog = runtime.page.getByRole("dialog", {
      name: "Корзина",
      exact: true,
    });
    await dialog.waitFor();
    await dialog
      .getByRole("button", {
        name: "Увеличить количество: Прописи «Первые китайские иероглифы»",
        exact: true,
      })
      .click();
    await dialog.getByText("2 товара", { exact: true }).waitFor();
    await dialog
      .getByRole("button", { name: "Оформить заказ", exact: true })
      .click();

    dialog = runtime.page.getByRole("dialog", {
      name: "Куда доставить",
      exact: true,
    });
    await dialog.waitFor();
    await dialog.getByLabel("Получатель").fill("E2E Adult");
    await dialog.getByLabel("Телефон").fill("+7 900 000-00-00");
    await dialog.getByLabel("Email").fill("adult-e2e@example.test");
    await dialog.getByLabel("Адрес доставки").fill("Чита, улица Ленина, дом 1");
    await dialog
      .getByRole("button", { name: "Продолжить", exact: true })
      .click();

    dialog = runtime.page.getByRole("dialog", {
      name: "Проверка заказа",
      exact: true,
    });
    await dialog.waitFor();
    await dialog.getByText(/Платёжная система пока не подключена/).waitFor();
    assert.equal(await dialog.locator('[autocomplete^="cc-"]').count(), 0);
    await dialog
      .getByRole("button", { name: "Завершить демо-заказ", exact: true })
      .click();

    dialog = runtime.page.getByRole("dialog", {
      name: "Демо завершено",
      exact: true,
    });
    await dialog.waitFor();
    await dialog
      .getByRole("heading", {
        name: "Заказ не создан — это была демонстрация",
        exact: true,
      })
      .waitFor();
    await dialog
      .getByRole("button", { name: "Вернуться в магазин", exact: true })
      .click();
    await runtime.page
      .getByRole("button", { name: "Открыть корзину", exact: true })
      .waitFor();
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      ),
      "Открыть корзину",
    );

    await runtime.page.setViewportSize({ width: 900, height: 812 });
    assert.deepEqual(
      await runtime.page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
      { clientWidth: 900, scrollWidth: 900 },
    );

    await compactView.click();
    await runtime.page.setViewportSize({ width: 375, height: 812 });
    assert.deepEqual(
      await runtime.page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
      { clientWidth: 375, scrollWidth: 375 },
    );
    await runtime.page
      .getByRole("button", {
        name: "Прописи «Первые китайские иероглифы»",
        exact: true,
      })
      .click();
    const mobileProductDialog = runtime.page.getByRole("dialog", {
      name: "Прописи «Первые китайские иероглифы»",
      exact: true,
    });
    await mobileProductDialog.waitFor();
    assert.deepEqual(
      await runtime.page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
      { clientWidth: 375, scrollWidth: 375 },
    );
    assert.equal(
      await mobileProductDialog.evaluate((dialog) => {
        const rect = dialog.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
      }),
      true,
    );
    await mobileProductDialog
      .getByRole("button", { name: "Закрыть товар", exact: true })
      .click();
  } finally {
    await runtime.close();
  }
});

test("browser smoke: protected pages expose the unified messages center with keyboard focus recovery", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eCommunicationInboxRpcPayloads.length = 0;
  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.route(
      "**/api/v2/system-notifications*",
      async (route) => {
        if (new URL(route.request().url()).pathname.endsWith("/read")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              receipt: { markedThroughId: 7, unreadCount: 0 },
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            notifications: {
              items: [
                {
                  id: 7,
                  eventType: "lesson_run.scheduled",
                  severity: "success",
                  title: "**Урок назначен**",
                  body: [
                    "Урок **подтверждён**.",
                    "",
                    "1. Завтра",
                    "   - В 15:00",
                    "   - Код: `lesson-1`",
                    "",
                    "<script>window.markdownXss = true</script>",
                    "![tracking](https://example.test/pixel.png)",
                    "[опасная ссылка](javascript:alert(1))",
                  ].join("\n"),
                  payload: {},
                  occurredAt: "2026-08-16T08:00:00.000Z",
                  readAt: null,
                },
              ],
              nextCursor: null,
            },
          }),
        });
      },
    );
    await runtime.page.setViewportSize({ width: 375, height: 812 });
    const inboxResponsePromise = runtime.page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/v2/inbox",
    );
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    const inboxResponse = await inboxResponsePromise;
    const inboxUrl = new URL(inboxResponse.url());
    assert.equal(inboxUrl.search, "");
    assert.equal(inboxResponse.status(), 200);
    assert.deepEqual(e2eCommunicationInboxRpcPayloads.at(-1), {
      p_cursor_activity_at: null,
      p_cursor_kind: null,
      p_cursor_id: null,
      p_limit: 30,
    });

    const launcher = runtime.page.getByRole("button", {
      name: "Открыть сообщения",
      exact: true,
    });
    await launcher.waitFor();
    const launcherPresentation = await launcher.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const icon = element.querySelector<SVGElement>("svg");
      if (!icon) throw new Error("Communication launcher icon is missing");
      const iconRect = icon.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        iconWidth: Math.round(iconRect.width),
        iconHeight: Math.round(iconRect.height),
        rightInset: Math.round(window.innerWidth - rect.right),
        bottomInset: Math.round(window.innerHeight - rect.bottom),
        borderRadius: style.borderRadius,
        borderTopWidth: style.borderTopWidth,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        color: style.color,
      };
    });
    assert.deepEqual(
      {
        rightInset: launcherPresentation.rightInset,
        bottomInset: launcherPresentation.bottomInset,
        borderTopWidth: launcherPresentation.borderTopWidth,
      },
      {
        rightInset: 12,
        bottomInset: 12,
        borderTopWidth: "0px",
      },
    );
    assert.ok(launcherPresentation.width >= 56);
    assert.ok(launcherPresentation.height >= 56);
    assert.ok(launcherPresentation.iconWidth >= 24);
    assert.ok(launcherPresentation.iconHeight >= 24);
    assert.equal(launcherPresentation.backgroundColor, "rgb(20, 20, 20)");
    assert.equal(launcherPresentation.backgroundImage, "none");
    assert.equal(launcherPresentation.color, "rgb(255, 255, 255)");

    const badge = runtime.page.locator(".communication-center-badge");
    await badge.waitFor();
    assert.equal(await badge.textContent(), "7");
    assert.equal(
      await badge.getAttribute("aria-label"),
      "Непрочитанных сообщений: 7",
    );
    const launcherBox = await launcher.boundingBox();
    const badgeBox = await badge.boundingBox();
    assert.ok(launcherBox);
    assert.ok(badgeBox);
    const launcherRight = launcherBox.x + launcherBox.width;
    assert.ok(badgeBox.x < launcherRight);
    assert.ok(badgeBox.x + badgeBox.width > launcherRight);
    assert.ok(badgeBox.y < launcherBox.y);
    assert.ok(badgeBox.y + badgeBox.height > launcherBox.y);
    assert.deepEqual(
      await badge.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
          borderTopWidth: style.borderTopWidth,
          pointerEvents: style.pointerEvents,
        };
      }),
      {
        backgroundColor: "rgb(255, 59, 48)",
        color: "rgb(255, 255, 255)",
        borderTopWidth: "2px",
        pointerEvents: "none",
      },
    );
    await launcher.press("Enter");

    const panel = runtime.page.getByRole("dialog", {
      name: "Сообщения",
      exact: true,
    });
    await panel.waitFor();
    await panel
      .getByText("Новое системное сообщение", { exact: true })
      .waitFor();
    assert.equal(await panel.getByRole("alert").count(), 0);
    assert.equal(
      await panel
        .getByText("Все диалоги в одном месте", { exact: true })
        .count(),
      0,
    );
    assert.equal(
      await panel.getByText("7 непрочитанных", { exact: true }).count(),
      0,
    );
    assert.equal(
      await panel
        .getByRole("button", {
          name: /Развернуть сообщения|Свернуть сообщения/,
        })
        .count(),
      0,
    );
    const headerPresentation = await panel
      .locator(".communication-center-header")
      .evaluate((element) => {
        const header = element as HTMLElement;
        const title = header.querySelector("h2");
        const plus = header.querySelector<HTMLElement>(
          '[aria-label="Новый диалог"]',
        );
        const close = header.querySelector<HTMLElement>(
          '[aria-label="Закрыть сообщения"]',
        );
        if (!title || !plus || !close) {
          throw new Error("Communication header contract is incomplete");
        }
        const headerRect = header.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        return {
          height: Math.round(headerRect.height),
          titleCenterDelta: Math.round(
            titleRect.top +
              titleRect.height / 2 -
              (headerRect.top + headerRect.height / 2),
          ),
          plusColor: getComputedStyle(plus).color,
          closeColor: getComputedStyle(close).color,
        };
      });
    assert.equal(headerPresentation.height, 64);
    assert.ok(Math.abs(headerPresentation.titleCenterDelta) <= 1);
    assert.equal(headerPresentation.plusColor, "rgb(20, 20, 20)");
    assert.equal(headerPresentation.closeColor, "rgb(20, 20, 20)");
    await panel.evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      );
    });
    assert.deepEqual(
      await runtime.page.evaluate(() => {
        const panelElement = document.querySelector(
          ".communication-center-panel",
        );
        if (!panelElement) return null;
        const panelRect = panelElement.getBoundingClientRect();
        return {
          width: Math.round(panelRect.width),
          height: Math.round(panelRect.height),
          top: Math.round(panelRect.top),
          left: Math.round(panelRect.left),
        };
      }),
      { width: 375, height: 812, top: 0, left: 0 },
    );
    assert.equal(
      await runtime.page.evaluate(
        () => document.activeElement?.id === "communication-center-panel",
      ),
      true,
    );
    await runtime.page.setViewportSize({ width: 900, height: 812 });
    const search = panel.getByLabel("Найти диалог");
    await search.waitFor();
    await runtime.page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    assert.equal(
      await runtime.page.evaluate(
        () => document.activeElement?.id === "communication-center-panel",
      ),
      true,
    );
    assert.deepEqual(
      await search.evaluate((element) => {
        const field = element.closest(".communication-search");
        if (!field) throw new Error("Communication search shell is missing");
        const style = getComputedStyle(field);
        return {
          active: document.activeElement === element,
          outlineStyle: style.outlineStyle,
        };
      }),
      { active: false, outlineStyle: "none" },
    );
    const desktopPanelWidth = await panel.evaluate((element) =>
      Math.round(element.getBoundingClientRect().width),
    );
    assert.ok(desktopPanelWidth >= 400 && desktopPanelWidth <= 416);
    assert.deepEqual(
      await runtime.page
        .locator(".communication-center-launcher")
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const icon = element.querySelector<SVGElement>("svg");
          if (!icon) throw new Error("Desktop launcher icon is missing");
          const iconRect = icon.getBoundingClientRect();
          return {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            iconWidth: Math.round(iconRect.width),
            iconHeight: Math.round(iconRect.height),
            rightInset: Math.round(window.innerWidth - rect.right),
            bottomInset: Math.round(window.innerHeight - rect.bottom),
            borderRadius: style.borderRadius,
            color: style.color,
          };
        }),
      {
        width: 40,
        height: 40,
        iconWidth: 19,
        iconHeight: 19,
        rightInset: 12,
        bottomInset: 12,
        borderRadius: "12px",
        color: "rgb(255, 255, 255)",
      },
    );

    const systemRow = panel.locator(
      '.communication-inbox-item:has-text("Новое системное сообщение")',
    );
    const systemAvatar = systemRow.locator(".communication-avatar.is-system");
    await systemAvatar.waitFor();
    assert.deepEqual(
      await systemAvatar.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          text: element.textContent,
          svgCount: element.querySelectorAll("svg").length,
          backgroundColor: style.backgroundColor,
          color: style.color,
        };
      }),
      {
        text: "S",
        svgCount: 0,
        backgroundColor: "rgb(20, 20, 20)",
        color: "rgb(255, 255, 255)",
      },
    );
    await systemRow.click();
    const systemCard = panel.locator(".communication-system-card");
    await systemCard.getByText("подтверждён", { exact: true }).waitFor();
    assert.equal(
      await systemCard.locator("header > strong").textContent(),
      "**Урок назначен**",
    );
    assert.equal(await systemCard.locator("header strong strong").count(), 0);
    assert.equal(
      await systemCard.locator(".communication-markdown strong").textContent(),
      "подтверждён",
    );
    assert.deepEqual(
      await systemCard.evaluate((element) => {
        const markdown = element.querySelector(".communication-markdown");
        const paragraph = element.querySelector(".communication-markdown p");
        const ordered = element.querySelector("ol");
        const unordered = element.querySelector("ul");
        if (!markdown || !paragraph || !ordered || !unordered) {
          throw new Error("System Markdown structure is incomplete");
        }
        return {
          whiteSpace: getComputedStyle(markdown).whiteSpace,
          paragraphWhiteSpace: getComputedStyle(paragraph).whiteSpace,
          orderedStyle: getComputedStyle(ordered).listStyleType,
          unorderedStyle: getComputedStyle(unordered).listStyleType,
          scripts: element.querySelectorAll("script").length,
          images: element.querySelectorAll("img").length,
          links: element.querySelectorAll("a").length,
          rawScriptText: element.textContent?.includes("window.markdownXss"),
          scriptSideEffect: "markdownXss" in window,
        };
      }),
      {
        whiteSpace: "normal",
        paragraphWhiteSpace: "normal",
        orderedStyle: "decimal",
        unorderedStyle: "disc",
        scripts: 0,
        images: 0,
        links: 0,
        rawScriptText: false,
        scriptSideEffect: false,
      },
    );
    const systemInfo = panel.getByRole("button", {
      name: "О ленте ShiDao",
      exact: true,
    });
    await systemInfo.waitFor();
    assert.equal(await systemInfo.getAttribute("aria-expanded"), "false");
    assert.equal(await panel.getByRole("note").count(), 0);
    await systemInfo.click();
    const systemNote = panel.getByRole("note");
    await systemNote.waitFor();
    assert.equal(await systemInfo.getAttribute("aria-expanded"), "true");
    assert.equal(
      await systemInfo.getAttribute("aria-controls"),
      await systemNote.getAttribute("id"),
    );
    assert.equal(
      (await systemNote.textContent())?.trim(),
      "ShiDao сообщает здесь только о подтверждённых событиях и результатах.",
    );
    await systemInfo.press("Escape");
    await systemNote.waitFor({ state: "detached" });
    assert.equal(await systemInfo.getAttribute("aria-expanded"), "false");
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      ),
      "О ленте ShiDao",
    );
    assert.equal(await panel.count(), 1);
    await panel
      .getByRole("button", { name: "Назад к сообщениям", exact: true })
      .click();
    await panel.getByLabel("Найти диалог").waitFor();

    const newDialog = panel.getByRole("button", {
      name: "Новый диалог",
      exact: true,
    });
    await newDialog.press("Enter");
    await panel.getByText("Новый диалог", { exact: true }).waitFor();
    await runtime.page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    assert.equal(
      await runtime.page.evaluate(
        () => document.activeElement?.id === "communication-center-panel",
      ),
      true,
    );
    await panel
      .getByRole("button", { name: "Назад к сообщениям", exact: true })
      .press("Enter");
    await panel.getByLabel("Найти диалог").waitFor();
    await runtime.page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    assert.equal(
      await runtime.page.evaluate(
        () => document.activeElement?.id === "communication-center-panel",
      ),
      true,
    );

    await search.fill("Черновик поиска");
    await Promise.all([
      runtime.page.waitForURL(/\/students$/),
      runtime.page.getByRole("link", { name: "Ученики", exact: true }).click(),
    ]);
    await runtime.page
      .getByRole("heading", { name: "Ученики", exact: true, level: 1 })
      .waitFor();
    assert.match((await panel.textContent()) ?? "", /Сообщения/);
    assert.equal(await search.inputValue(), "Черновик поиска");

    await search.press("Escape");
    await panel.waitFor({ state: "hidden" });
    await runtime.page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.classList.contains(
          "communication-center-launcher",
        ),
      ),
      true,
    );
  } finally {
    await runtime.close();
  }
});

test("browser smoke: messages retry uses the canonical raised product button", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eCommunicationInboxRpcUnavailable = true;
  let runtime: Awaited<ReturnType<typeof openPage>> | null = null;

  try {
    runtime = await openPage({ cookie: authenticatedCookieValue() });
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("button", { name: "Открыть сообщения", exact: true })
      .click();
    const panel = runtime.page.getByRole("dialog", {
      name: "Сообщения",
      exact: true,
    });
    const alert = panel.getByRole("alert");
    await alert.waitFor();
    const retry = alert.getByRole("button", {
      name: "Повторить",
      exact: true,
    });
    await retry.waitFor();
    assert.match((await retry.getAttribute("class")) ?? "", /\bproduct-btn\b/);
    assert.match(
      (await retry.getAttribute("class")) ?? "",
      /\bproduct-btn-secondary\b/,
    );
    assert.deepEqual(
      await retry.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          height: style.height,
          backgroundColor: style.backgroundColor,
          borderTopWidth: style.borderTopWidth,
          boxShadow: style.boxShadow,
          fontWeight: style.fontWeight,
        };
      }),
      {
        height: "40px",
        backgroundColor: "rgb(255, 255, 255)",
        borderTopWidth: "1px",
        boxShadow: E2E_RAISED_CONTROL_SHADOW,
        fontWeight: "600",
      },
    );
  } finally {
    e2eCommunicationInboxRpcUnavailable = false;
    await runtime?.close();
  }
});

test("browser smoke: persisted AI quick reply is one-time and sends one atomic turn", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });
  const requestBodies: Array<{
    body?: string;
    localDate?: string;
    utcOffsetMinutes?: number;
  }> = [];
  let observeSecondRequest: (() => void) | undefined;
  let releaseSecondRequest: (() => void) | undefined;
  const secondRequestObserved = new Promise<void>((resolve) => {
    observeSecondRequest = resolve;
  });
  const secondRequestReleased = new Promise<void>((resolve) => {
    releaseSecondRequest = resolve;
  });

  try {
    const conversation = {
      id: "10000000-0000-4000-8000-000000000001",
      title: "Новый диалог",
      contextCourseId: null,
      contextLessonId: null,
      lastTurnId: null,
      lastActivityAt: "2026-08-16T08:00:00.000Z",
      unreadCount: 0,
      archivedAt: null,
      createdAt: "2026-08-16T08:00:00.000Z",
      updatedAt: "2026-08-16T08:00:00.000Z",
    };
    const usage = {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      cachedInputTokens: 0,
      reasoningTokens: 0,
    };
    const quota = {
      periodStartedAt: "2026-08-01T00:00:00.000Z",
      resetsAt: "2026-09-01T00:00:00.000Z",
      limitTokens: 2_000_000,
      usedTokens: 500_000,
      remainingTokens: 1_500_000,
    };

    await runtime.page.route("**/api/v2/inbox*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          inbox: { items: [], nextCursor: null, totalUnread: 0 },
        }),
      });
    });
    await runtime.page.route("**/api/v2/message-targets*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ targets: { direct: [], courses: [] } }),
      });
    });
    await runtime.page.route("**/api/v2/assistant/quota", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ quota }),
      });
    });
    await runtime.page.route(
      "**/api/v2/assistant/conversations",
      async (route) => {
        const requestBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            requestBody ? { conversation } : { conversations: [conversation] },
          ),
        });
      },
    );
    await runtime.page.route(
      "**/api/v2/assistant/conversations/*/read",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            receipt: { markedThroughId: 4, unreadCount: 0 },
          }),
        });
      },
    );
    await runtime.page.route(
      "**/api/v2/assistant/conversations/*/turns*",
      async (route) => {
        const requestBody = route.request().postDataJSON();
        if (!requestBody) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              conversation,
              turns: { items: [], nextCursor: null },
            }),
          });
          return;
        }
        requestBodies.push(
          (route.request().postDataJSON() ?? {}) as {
            body?: string;
            localDate?: string;
            utcOffsetMinutes?: number;
          },
        );
        const requestNumber = requestBodies.length;
        if (requestNumber === 2) {
          observeSecondRequest?.();
          await secondRequestReleased;
        }
        const userTurnId = requestNumber * 2 - 1;
        const assistantTurnId = requestNumber * 2;
        const quickReplies =
          requestNumber === 1
            ? [
                { label: "Пустой урок", message: "Пустой урок" },
                { label: "Готовый урок", message: "Готовый урок" },
              ]
            : [];
        const assistantBody =
          requestNumber === 1
            ? [
                "У вас **6 курсов**:",
                "",
                "1. **ShiDao V2**",
                "   - Предмет: _китайский_",
                "   - Код: `course-1`",
                "",
                "<script>window.markdownXss = true</script>",
                "![tracking](https://example.test/pixel.png)",
                "[опасная ссылка](javascript:alert(1))",
              ].join("\n")
            : "Хорошо, подготовлю пустой урок.";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            exchange: {
              userTurn: {
                id: userTurnId,
                role: "user",
                deliveryKind: "interactive",
                body: requestBodies.at(-1)?.body,
                payload: {},
                createdAt: `2026-08-16T08:0${userTurnId}:00.000Z`,
              },
              assistantTurn: {
                id: assistantTurnId,
                role: "assistant",
                deliveryKind: "interactive",
                body: assistantBody,
                payload: {
                  replyToTurnId: userTurnId,
                  reply: {
                    requestId: `assistant-browser-${requestNumber}`,
                    model: "test-model",
                    provider: "test-provider",
                    usage,
                    proposedAction: null,
                    quickReplies,
                    sharedHistoryUsed: false,
                  },
                },
                createdAt: `2026-08-16T08:0${assistantTurnId}:00.000Z`,
              },
              proposedAction: null,
              quickReplies,
              sharedHistoryUsed: false,
              usage,
            },
          }),
        });
      },
    );

    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("button", { name: "Открыть сообщения", exact: true })
      .click();
    const panel = runtime.page.getByRole("dialog", {
      name: "Сообщения",
      exact: true,
    });
    await panel
      .locator(".communication-center-header")
      .getByRole("button", { name: "Новый диалог", exact: true })
      .click();
    await panel.getByRole("button", { name: /Новый диалог с ИИ/ }).click();
    const capabilities = panel.getByRole("heading", {
      name: "Что может делать ИИ",
      exact: true,
      level: 3,
    });
    await capabilities.waitFor();
    assert.equal(
      await panel
        .locator(".communication-assistant-empty .communication-avatar")
        .count(),
      0,
    );
    assert.equal(
      await panel.getByText(/Контекст закреплён|разрешённый контекст/).count(),
      0,
    );
    const assistantAvatars = panel.locator(
      ".communication-avatar.is-assistant",
    );
    assert.equal(await assistantAvatars.count(), 1);
    assert.deepEqual(
      await assistantAvatars.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
        };
      }),
      {
        backgroundColor: "rgb(20, 20, 20)",
        color: "rgb(255, 255, 255)",
      },
    );
    const capabilityGroup = panel.getByRole("group", {
      name: "Что можно попросить ИИ",
      exact: true,
    });
    assert.deepEqual(
      await capabilityGroup.getByRole("button").allTextContents(),
      [
        "Расскажи о моих курсах",
        "Сравни мои курсы",
        "Создай новый курс",
        "Добавь пустой урок в курс",
        "Создай готовый урок в курсе",
      ],
    );
    const firstCapability = capabilityGroup.getByRole("button").nth(0);
    const capabilityPresentation = await firstCapability.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        height: Math.round(rect.height),
        borderRadius: style.borderRadius,
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      };
    });
    assert.ok(capabilityPresentation.height >= 44);
    assert.equal(capabilityPresentation.borderRadius, "999px");
    assert.equal(capabilityPresentation.color, "rgb(20, 20, 20)");
    assert.equal(capabilityPresentation.fontSize, "14.08px");
    assert.equal(capabilityPresentation.fontWeight, "400");
    const composer = panel.getByLabel("Сообщение ИИ");
    await composer.fill("**Сделай четвёртый урок**");
    await composer.press("Enter");

    const emptyLesson = panel.getByRole("button", {
      name: "Пустой урок",
      exact: true,
    });
    const readyLesson = panel.getByRole("button", {
      name: "Готовый урок",
      exact: true,
    });
    await emptyLesson.waitFor();
    await readyLesson.waitFor();
    const ownBubble = panel.locator(
      ".communication-message.is-own .communication-message-bubble",
    );
    assert.equal(await ownBubble.textContent(), "**Сделай четвёртый урок**");
    assert.equal(await ownBubble.locator("strong").count(), 0);
    const assistantBubble = panel
      .locator(
        ".communication-message:not(.is-own) .communication-message-bubble",
      )
      .nth(0);
    const bubblePresentation = await Promise.all([
      ownBubble.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          tail: style.borderBottomRightRadius,
          opposite: style.borderBottomLeftRadius,
        };
      }),
      assistantBubble.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          tail: style.borderBottomLeftRadius,
          opposite: style.borderBottomRightRadius,
        };
      }),
    ]);
    assert.deepEqual(bubblePresentation, [
      { tail: "1px", opposite: "15.2px" },
      { tail: "1px", opposite: "15.2px" },
    ]);

    const assistantTime = panel
      .locator(
        ".communication-message:not(.is-own) .communication-message-time",
      )
      .nth(0);
    await runtime.page.mouse.move(0, 0);
    await runtime.page.waitForTimeout(300);
    const timePresentation = await assistantTime.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        opacity: style.opacity,
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
        height: element.getBoundingClientRect().height,
      };
    });
    assert.equal(timePresentation.opacity, "0");
    assert.equal(timePresentation.transitionProperty, "opacity");
    assert.equal(timePresentation.transitionDuration, "0.25s");
    assert.ok(timePresentation.height > 0);
    await assistantBubble.hover();
    await runtime.page.waitForTimeout(300);
    assert.equal(
      await assistantTime.evaluate(
        (element) => getComputedStyle(element).opacity,
      ),
      "1",
    );

    const footerPresentation = await panel.evaluate((element) => {
      const panelRect = element.getBoundingClientRect();
      const header = element.querySelector<HTMLElement>(
        ".communication-conversation-header",
      );
      const footer = element.querySelector<HTMLElement>(
        ".communication-composer-footer",
      );
      const quotaTrack = element.querySelector<HTMLElement>(
        ".communication-assistant-quota",
      );
      const quotaFill = quotaTrack?.firstElementChild as HTMLElement | null;
      if (!header || !footer || !quotaTrack || !quotaFill) {
        throw new Error("Communication footer geometry is missing");
      }
      const headerRect = header.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const quotaRect = quotaTrack.getBoundingClientRect();
      const fillRect = quotaFill.getBoundingClientRect();
      const panelStyle = getComputedStyle(element);
      const footerStyle = getComputedStyle(footer);
      return {
        panelBackground: panelStyle.backgroundColor,
        panelBackgroundImage: panelStyle.backgroundImage,
        panelOpacity: panelStyle.opacity,
        panelBorder: panelStyle.borderTopWidth,
        headerLeftDelta: Math.abs(headerRect.left - panelRect.left),
        headerRightDelta: Math.abs(headerRect.right - panelRect.right),
        footerLeftDelta: Math.abs(footerRect.left - panelRect.left),
        footerRightDelta: Math.abs(footerRect.right - panelRect.right),
        footerBorder: footerStyle.borderTopWidth,
        footerPaddingTop: footerStyle.paddingTop,
        quotaHeight: quotaRect.height,
        quotaRatio: fillRect.width / quotaRect.width,
        quotaMax: quotaTrack.getAttribute("aria-valuemax"),
        quotaNow: quotaTrack.getAttribute("aria-valuenow"),
      };
    });
    assert.ok(Math.abs(footerPresentation.quotaRatio - 0.75) < 0.001);
    assert.deepEqual(
      { ...footerPresentation, quotaRatio: 0.75 },
      {
        panelBackground: "rgb(255, 255, 255)",
        panelBackgroundImage: "none",
        panelOpacity: "1",
        panelBorder: "0px",
        headerLeftDelta: 0,
        headerRightDelta: 0,
        footerLeftDelta: 0,
        footerRightDelta: 0,
        footerBorder: "1px",
        footerPaddingTop: "12px",
        quotaHeight: 4,
        quotaRatio: 0.75,
        quotaMax: "2000000",
        quotaNow: "1500000",
      },
    );
    const assistantMarkdown = panel
      .locator(".communication-message:not(.is-own) .communication-markdown")
      .nth(0);
    await assistantMarkdown.getByText("6 курсов", { exact: true }).waitFor();
    assert.equal(
      await assistantMarkdown.locator("strong").nth(0).textContent(),
      "6 курсов",
    );
    assert.equal(
      await assistantMarkdown.locator("code").textContent(),
      "course-1",
    );
    assert.equal(
      await assistantMarkdown.locator("em").textContent(),
      "китайский",
    );
    assert.deepEqual(
      await assistantMarkdown.evaluate((element) => {
        const paragraph = element.querySelector("p");
        const ordered = element.querySelector("ol");
        const unordered = element.querySelector("ul");
        if (!paragraph || !ordered || !unordered) {
          throw new Error("Assistant Markdown lists are missing");
        }
        return {
          whiteSpace: getComputedStyle(element).whiteSpace,
          paragraphWhiteSpace: getComputedStyle(paragraph).whiteSpace,
          orderedStyle: getComputedStyle(ordered).listStyleType,
          unorderedStyle: getComputedStyle(unordered).listStyleType,
          scripts: element.querySelectorAll("script").length,
          images: element.querySelectorAll("img").length,
          links: element.querySelectorAll("a").length,
          rawScriptText: element.textContent?.includes("window.markdownXss"),
          scriptSideEffect: "markdownXss" in window,
        };
      }),
      {
        whiteSpace: "normal",
        paragraphWhiteSpace: "normal",
        orderedStyle: "decimal",
        unorderedStyle: "disc",
        scripts: 0,
        images: 0,
        links: 0,
        rawScriptText: false,
        scriptSideEffect: false,
      },
    );
    assert.equal(
      await panel.getByText("Пустой урок", { exact: true }).count(),
      1,
    );
    assert.equal(
      await panel.getByText("Готовый урок", { exact: true }).count(),
      1,
    );

    await emptyLesson.click();
    await secondRequestObserved;
    assert.equal(await emptyLesson.count(), 0);
    assert.equal(await readyLesson.count(), 0);
    assert.equal(requestBodies.length, 2);
    assert.equal(requestBodies[1]?.body, "Пустой урок");
    assert.match(requestBodies[1]?.localDate ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof requestBodies[1]?.utcOffsetMinutes, "number");

    releaseSecondRequest?.();
    await runtime.page
      .locator(".communication-message-bubble")
      .getByText("Хорошо, подготовлю пустой урок.", { exact: true })
      .waitFor();
  } finally {
    releaseSecondRequest?.();
    await runtime.close();
  }
});

test("browser smoke: authenticated /login redirects by access policy", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.goto("/login", { waitUntil: "domcontentloaded" });
    await runtime.page.waitForURL(/\/courses$/, {
      timeout: 10_000,
      waitUntil: "domcontentloaded",
    });
    assert.equal(new URL(runtime.page.url()).pathname, "/courses");
  } finally {
    await runtime.close();
  }
});

test("browser smoke: primary navigation uses one fast local pill while route navigation is pending", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({
    cookie: authenticatedCookieValue(),
    viewport: { width: 1056, height: 720 },
  });
  let resolveStudentsRscGate: (() => void) | null = null;
  let markStudentsRscObserved: (() => void) | null = null;
  const studentsRscGate = new Promise<void>((resolve) => {
    resolveStudentsRscGate = resolve;
  });
  const studentsRscObserved = new Promise<void>((resolve) => {
    markStudentsRscObserved = resolve;
  });
  const releaseStudentsRsc = () => {
    resolveStudentsRscGate?.();
    resolveStudentsRscGate = null;
  };

  try {
    await runtime.page.route("**/students*", async (route) => {
      const requestUrl = new URL(route.request().url());
      const isStudentsRsc =
        requestUrl.pathname === "/students" &&
        requestUrl.searchParams.has("_rsc");
      if (!isStudentsRsc) {
        await route.continue();
        return;
      }

      markStudentsRscObserved?.();
      markStudentsRscObserved = null;
      await studentsRscGate;
      try {
        await route.continue();
      } catch {
        // The browser may cancel a prefetch when the context is closing.
      }
    });

    await runtime.page.clock.setFixedTime("2026-08-11T00:00:00.000Z");
    await runtime.page.goto("/schedule", { waitUntil: "domcontentloaded" });
    await runtime.page
      .getByRole("heading", { name: "Расписание", exact: true, level: 1 })
      .waitFor();
    await runtime.page
      .locator(
        '.site-header-nav-active-pill[data-ready="true"][data-motion-ready="true"]',
      )
      .waitFor();

    const headerGeometry = await runtime.page.evaluate(() => {
      const topNav = document.querySelector<HTMLElement>(".course-top-nav");
      const shell = document.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );
      const row = shell?.querySelector<HTMLElement>(
        ":scope > .site-header-content-row",
      );
      const brand = row?.querySelector<HTMLElement>(".site-header-brand");
      const navScroll = row?.querySelector<HTMLElement>(
        ".site-header-nav-scroll",
      );
      const navTrack = navScroll?.querySelector<HTMLElement>(
        ".site-header-nav-track",
      );
      const navList = navTrack?.querySelector<HTMLElement>(
        ".site-header-nav-list",
      );
      const navItems = Array.from(
        navList?.querySelectorAll<HTMLElement>(":scope > li") ?? [],
      );
      const navPills = Array.from(
        navList?.querySelectorAll<HTMLElement>(".site-header-nav-pill") ?? [],
      );
      const activePill = navTrack?.querySelector<HTMLElement>(
        ".site-header-nav-active-pill",
      );
      const actions = row?.querySelector<HTMLElement>(".site-header-actions");
      const actionsWrapper = actions?.firstElementChild as HTMLElement | null;
      const profileTrigger =
        actions?.querySelector<HTMLElement>(".nav-profile-link");
      const avatar = profileTrigger?.querySelector<HTMLElement>(
        ".nav-user-trigger-avatar",
      );

      if (
        !topNav ||
        !shell ||
        !row ||
        !brand ||
        !navScroll ||
        !navTrack ||
        !navList ||
        navItems.length === 0 ||
        navPills.length === 0 ||
        !activePill ||
        !actions ||
        !actionsWrapper ||
        !profileTrigger ||
        !avatar
      ) {
        throw new Error("Product header geometry elements are missing");
      }

      const shellRect = shell.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const rowCenter = rowRect.top + rowRect.height / 2;
      const measuredElements: Array<[string, HTMLElement]> = [
        ["brand", brand],
        ["nav-scroll", navScroll],
        ["nav-track", navTrack],
        ["nav-list", navList],
        ...navItems.map(
          (item, index) => [`nav-item-${index}`, item] as [string, HTMLElement],
        ),
        ...navPills.map(
          (pill, index) => [`nav-pill-${index}`, pill] as [string, HTMLElement],
        ),
        ["active-pill", activePill],
        ["actions", actions],
        ["actions-wrapper", actionsWrapper],
        ["profile-trigger", profileTrigger],
        ["avatar", avatar],
      ];

      return {
        topNavPosition: getComputedStyle(topNav).position,
        ownsPrimarySections:
          row.parentElement === shell &&
          brand.parentElement === row &&
          navScroll.parentElement === row &&
          actions.parentElement === row,
        shellHeight: shellRect.height,
        rowHeight: rowRect.height,
        rowTopInset: rowRect.top - shellRect.top,
        rowBottomInset: shellRect.bottom - rowRect.bottom,
        rowCenterDelta: Math.abs(
          rowCenter - (shellRect.top + shellRect.height / 2),
        ),
        elements: measuredElements.map(([name, element]) => {
          const rect = element.getBoundingClientRect();
          return {
            name,
            height: rect.height,
            centerDelta: Math.abs(rect.top + rect.height / 2 - rowCenter),
          };
        }),
      };
    });

    assert.equal(headerGeometry.topNavPosition, "relative");
    assert.equal(headerGeometry.ownsPrimarySections, true);
    assert.ok(Math.abs(headerGeometry.shellHeight - 64) < 0.5);
    assert.ok(Math.abs(headerGeometry.rowHeight - 40) < 0.5);
    assert.ok(Math.abs(headerGeometry.rowTopInset - 12) < 0.5);
    assert.ok(Math.abs(headerGeometry.rowBottomInset - 12) < 0.5);
    assert.ok(headerGeometry.rowCenterDelta < 0.5);
    for (const element of headerGeometry.elements) {
      assert.ok(
        element.height <= 40.5,
        `${element.name} must not exceed the 40px product-header row; received ${element.height}px`,
      );
      assert.ok(
        element.centerDelta < 0.5,
        `${element.name} must share the product-header row center; delta was ${element.centerDelta}px`,
      );
    }

    const inactiveStudentsPng = await runtime.page
      .locator('.site-header-nav-pill[href="/students"] .nav-pill-content')
      .screenshot();
    const inactiveStudentsPixels = await sharp(inactiveStudentsPng)
      .removeAlpha()
      .raw()
      .toBuffer();
    let inactiveDarkPixelCount = 0;
    for (let index = 0; index < inactiveStudentsPixels.length; index += 3) {
      if (
        inactiveStudentsPixels[index] < 128 &&
        inactiveStudentsPixels[index + 1] < 128 &&
        inactiveStudentsPixels[index + 2] < 128
      ) {
        inactiveDarkPixelCount += 1;
      }
    }
    assert.ok(
      inactiveDarkPixelCount >= 20,
      "Inactive primary-nav glyphs must visibly render black on the white track",
    );

    const studentsLink = runtime.page.getByRole("link", {
      name: "Ученики",
      exact: true,
    });
    await studentsLink.hover();
    await runtime.page.waitForTimeout(220);
    assert.equal(
      await studentsLink.evaluate(
        (link) => getComputedStyle(link).backgroundColor,
      ),
      "rgba(0, 0, 0, 0.05)",
    );

    const start = await runtime.page.evaluate(() => {
      const track = document.querySelector<HTMLElement>(
        ".site-header-nav-track",
      );
      const pill = track?.querySelector<HTMLElement>(
        ".site-header-nav-active-pill",
      );
      const target = track?.querySelector<HTMLAnchorElement>(
        '.site-header-nav-pill[href="/students"]',
      );
      if (!track || !pill || !target) {
        throw new Error("Primary navigation start geometry is missing");
      }
      return {
        pillLeft: pill.getBoundingClientRect().left,
        targetLeft: target.getBoundingClientRect().left,
      };
    });

    await studentsLink.click();
    await runtime.page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => resolve()),
          ),
        ),
    );

    const handoff = await runtime.page.evaluate(() => {
      const track = document.querySelector<HTMLElement>(
        ".site-header-nav-track",
      );
      const list = track?.querySelector<HTMLElement>(".site-header-nav-list");
      const pill = track?.querySelector<HTMLElement>(
        ".site-header-nav-active-pill",
      );
      const targetLink = track?.querySelector<HTMLAnchorElement>(
        '.site-header-nav-pill[href="/students"]',
      );
      const targetContent =
        targetLink?.querySelector<HTMLElement>(".nav-pill-content");
      const targetIcon = targetLink?.querySelector<SVGElement>("svg");
      if (
        !track ||
        !list ||
        !pill ||
        !targetLink ||
        !targetContent ||
        !targetIcon
      ) {
        throw new Error("Primary navigation handoff contract is missing");
      }
      const pillStyle = getComputedStyle(pill);
      const targetLinkStyle = getComputedStyle(targetLink);
      const targetContentStyle = getComputedStyle(targetContent);
      return {
        pillCount: track.querySelectorAll(".site-header-nav-active-pill")
          .length,
        pillLeft: pill.getBoundingClientRect().left,
        pillBackgroundColor: pillStyle.backgroundColor,
        pillViewTransitionName: pillStyle.viewTransitionName,
        pillZIndex: pillStyle.zIndex,
        listZIndex: getComputedStyle(list).zIndex,
        trackIsolation: getComputedStyle(track).isolation,
        trackBackgroundColor: getComputedStyle(track).backgroundColor,
        targetBackgroundColor: targetLinkStyle.backgroundColor,
        targetLinkColor: targetLinkStyle.color,
        targetContentColor: targetContentStyle.color,
        targetContentMixBlendMode: targetContentStyle.mixBlendMode,
        targetIconOpacity: getComputedStyle(targetIcon).opacity,
        transitionProperties: pill
          .getAnimations()
          .filter(
            (animation): animation is CSSTransition =>
              animation instanceof CSSTransition,
          )
          .map((animation) => animation.transitionProperty)
          .sort(),
        transitionDurations: pill
          .getAnimations()
          .map((animation) => animation.effect?.getComputedTiming().duration)
          .filter(
            (duration): duration is number => typeof duration === "number",
          )
          .sort((left, right) => left - right),
      };
    });

    assert.deepEqual(
      {
        pillCount: handoff.pillCount,
        pillBackgroundColor: handoff.pillBackgroundColor,
        pillViewTransitionName: handoff.pillViewTransitionName,
        pillZIndex: handoff.pillZIndex,
        listZIndex: handoff.listZIndex,
        trackIsolation: handoff.trackIsolation,
        trackBackgroundColor: handoff.trackBackgroundColor,
        targetBackgroundColor: handoff.targetBackgroundColor,
        targetLinkColor: handoff.targetLinkColor,
        targetContentColor: handoff.targetContentColor,
        targetContentMixBlendMode: handoff.targetContentMixBlendMode,
        targetIconOpacity: handoff.targetIconOpacity,
        transitionProperties: handoff.transitionProperties,
        transitionDurations: handoff.transitionDurations,
      },
      {
        pillCount: 1,
        pillBackgroundColor: "rgb(0, 0, 0)",
        pillViewTransitionName: "none",
        pillZIndex: "0",
        listZIndex: "auto",
        trackIsolation: "isolate",
        trackBackgroundColor: "rgb(255, 255, 255)",
        targetBackgroundColor: "rgba(0, 0, 0, 0.05)",
        targetLinkColor: "rgb(0, 0, 0)",
        targetContentColor: "rgb(255, 255, 255)",
        targetContentMixBlendMode: "difference",
        targetIconOpacity: "1",
        transitionProperties: ["transform", "width"],
        transitionDurations: [180, 180],
      },
    );
    assert.ok(
      handoff.pillLeft > start.pillLeft + 0.5,
      "The one local pill must leave Schedule immediately when Students is chosen",
    );
    assert.ok(
      handoff.pillLeft < start.targetLeft - 0.5,
      "The handoff sample must capture the pill before it reaches Students",
    );

    let observedTimeout: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        studentsRscObserved,
        new Promise<void>((_, reject) => {
          observedTimeout = setTimeout(
            () =>
              reject(
                new Error(
                  "Students navigation did not reach the gated Next RSC request",
                ),
              ),
            5_000,
          );
        }),
      ]);
    } finally {
      if (observedTimeout) clearTimeout(observedTimeout);
    }
    releaseStudentsRsc();

    await runtime.page.waitForURL(/\/students$/);
    await runtime.page
      .getByRole("heading", { name: "Ученики", exact: true, level: 1 })
      .waitFor();
    assert.equal(
      await runtime.page
        .locator('.site-header-nav-pill[aria-current="page"]')
        .evaluate((link) => link.getAttribute("href")),
      "/students",
    );
  } finally {
    releaseStudentsRsc();
    await runtime.close();
  }
});

test("browser smoke: latest primary navigation click wins while the first destination is pending", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });
  let resolveStudentDirectoryRpc: (() => void) | null = null;
  const releaseStudentDirectoryRpc = () => {
    resolveStudentDirectoryRpc?.();
    resolveStudentDirectoryRpc = null;
  };

  try {
    await runtime.page.clock.setFixedTime("2026-08-11T00:00:00.000Z");
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .locator(
        '.site-header-nav-active-pill[data-ready="true"][data-motion-ready="true"]',
      )
      .waitFor();

    const studentDirectoryRpcObserved = new Promise<void>((resolve) => {
      e2eStudentDirectoryRpcObserved = resolve;
    });
    e2eStudentDirectoryRpcGate = new Promise<void>((resolve) => {
      resolveStudentDirectoryRpc = resolve;
    });

    await runtime.page.evaluate(() => {
      const testWindow = window as typeof window & {
        __e2ePrimaryNavTrustedClicks?: Array<{
          href: string | null;
          trusted: boolean;
        }>;
      };
      testWindow.__e2ePrimaryNavTrustedClicks = [];
      document.addEventListener(
        "click",
        (event) => {
          if (!(event.target instanceof Element)) return;
          const link = event.target.closest<HTMLAnchorElement>(
            ".site-header-nav-pill",
          );
          if (!link) return;
          testWindow.__e2ePrimaryNavTrustedClicks?.push({
            href: link.getAttribute("href"),
            trusted: event.isTrusted,
          });
        },
        true,
      );
    });

    const storeLink = runtime.page.locator(
      '.site-header-nav-pill[href="/store"]',
    );
    const storeBox = await storeLink.boundingBox();
    assert.ok(storeBox, "Store must have a clickable primary-nav box");
    const storePoint = {
      x: storeBox.x + storeBox.width / 2,
      y: storeBox.y + storeBox.height / 2,
    };

    await runtime.page
      .getByRole("link", { name: "Ученики", exact: true })
      .click();

    let observedTimeout: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        studentDirectoryRpcObserved,
        new Promise<void>((_, reject) => {
          observedTimeout = setTimeout(
            () =>
              reject(
                new Error(
                  "Students navigation did not reach the gated directory request",
                ),
              ),
            5_000,
          );
        }),
      ]);
    } finally {
      if (observedTimeout) clearTimeout(observedTimeout);
    }

    const hitContract = await storeLink.evaluate((element) => {
      const store = element as HTMLAnchorElement;
      const rect = store.getBoundingClientRect();
      const hitTarget = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      const hitLink =
        hitTarget instanceof Element
          ? hitTarget.closest<HTMLAnchorElement>(".site-header-nav-pill")
          : null;
      const style = hitLink ? getComputedStyle(hitLink) : null;
      return {
        href: hitLink?.getAttribute("href") ?? null,
        cursor: style?.cursor ?? null,
        pointerEvents: style?.pointerEvents ?? null,
        ariaDisabled: hitLink?.getAttribute("aria-disabled") ?? null,
        disabled: hitLink?.hasAttribute("disabled") ?? null,
      };
    });

    await runtime.page.mouse.move(storePoint.x, storePoint.y);
    await runtime.page.mouse.down();
    await runtime.page.mouse.up();

    const trustedClick = await runtime.page.evaluate(() => {
      const clicks = (
        window as typeof window & {
          __e2ePrimaryNavTrustedClicks?: Array<{
            href: string | null;
            trusted: boolean;
          }>;
        }
      ).__e2ePrimaryNavTrustedClicks;
      return clicks?.[clicks.length - 1] ?? null;
    });

    assert.deepEqual(
      { ...hitContract, trustedClick },
      {
        href: "/store",
        cursor: "pointer",
        pointerEvents: "auto",
        ariaDisabled: null,
        disabled: false,
        trustedClick: { href: "/store", trusted: true },
      },
      "Primary navigation must remain hit-testable while the first destination is unresolved",
    );

    await runtime.page.waitForURL(/\/store$/, { timeout: 5_000 });
    await runtime.page
      .getByRole("heading", { name: "Магазин", exact: true, level: 1 })
      .waitFor();

    releaseStudentDirectoryRpc();
    await runtime.page.waitForTimeout(250);

    assert.equal(new URL(runtime.page.url()).pathname, "/store");
    assert.equal(
      await runtime.page
        .locator('.site-header-nav-pill[aria-current="page"]')
        .evaluate((link) => link.getAttribute("href")),
      "/store",
      "The released stale Students request must not replace the latest Store navigation",
    );
  } finally {
    releaseStudentDirectoryRpc();
    e2eStudentDirectoryRpcGate = null;
    e2eStudentDirectoryRpcObserved = null;
    await runtime.close();
  }
});

test("browser smoke: Store supersedes a pre-commit Courses RSC navigation", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });
  let releaseCoursesRscGate: (() => void) | null = null;
  let markCoursesRscObserved: (() => void) | null = null;
  let markAllCoursesRscSettled: (() => void) | null = null;
  let coursesRscGateReleased = false;
  let pendingCoursesRscRequests = 0;
  const coursesRscGate = new Promise<void>((resolve) => {
    releaseCoursesRscGate = resolve;
  });
  const coursesRscObserved = new Promise<void>((resolve) => {
    markCoursesRscObserved = resolve;
  });
  const allCoursesRscSettled = new Promise<void>((resolve) => {
    markAllCoursesRscSettled = resolve;
  });
  const releaseCoursesRsc = () => {
    if (coursesRscGateReleased) return;
    coursesRscGateReleased = true;
    releaseCoursesRscGate?.();
    releaseCoursesRscGate = null;
    if (pendingCoursesRscRequests === 0) {
      markAllCoursesRscSettled?.();
      markAllCoursesRscSettled = null;
    }
  };

  try {
    await runtime.page.route("**/courses*", async (route) => {
      const requestUrl = new URL(route.request().url());
      const isCoursesRsc =
        requestUrl.pathname === "/courses" &&
        requestUrl.searchParams.has("_rsc");
      if (!isCoursesRsc || coursesRscGateReleased) {
        await route.continue();
        return;
      }

      pendingCoursesRscRequests += 1;
      markCoursesRscObserved?.();
      markCoursesRscObserved = null;
      await coursesRscGate;
      try {
        await route.continue();
      } catch {
        // A superseded RSC request may already be cancelled by the browser.
      } finally {
        pendingCoursesRscRequests -= 1;
        if (coursesRscGateReleased && pendingCoursesRscRequests === 0) {
          markAllCoursesRscSettled?.();
          markAllCoursesRscSettled = null;
        }
      }
    });

    await runtime.page.clock.setFixedTime("2026-08-11T00:00:00.000Z");
    await runtime.page.goto("/students", { waitUntil: "domcontentloaded" });
    await runtime.page
      .getByRole("heading", { name: "Ученики", exact: true, level: 1 })
      .waitFor();
    await runtime.page
      .locator(
        '.site-header-nav-active-pill[data-ready="true"][data-motion-ready="true"]',
      )
      .waitFor();

    await runtime.page.evaluate(() => {
      const testWindow = window as typeof window & {
        __e2ePrimaryNavCommits?: Array<{
          activeHref: string | null;
          heading: string | null;
          pathname: string;
        }>;
      };
      const capture = () => {
        const next = {
          activeHref:
            document
              .querySelector<HTMLAnchorElement>(
                '.site-header-nav-pill[aria-current="page"]',
              )
              ?.getAttribute("href") ?? null,
          heading:
            document.querySelector<HTMLElement>("h1")?.textContent?.trim() ??
            null,
          pathname: window.location.pathname,
        };
        const previous = testWindow.__e2ePrimaryNavCommits?.at(-1);
        if (
          previous?.activeHref === next.activeHref &&
          previous.heading === next.heading &&
          previous.pathname === next.pathname
        ) {
          return;
        }
        testWindow.__e2ePrimaryNavCommits?.push(next);
      };
      testWindow.__e2ePrimaryNavCommits = [];
      capture();
      new MutationObserver(capture).observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    });

    await runtime.page
      .getByRole("link", { name: "Курсы", exact: true })
      .click();

    let observedTimeout: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.all([
        runtime.page.waitForTimeout(220),
        Promise.race([
          coursesRscObserved,
          new Promise<void>((_, reject) => {
            observedTimeout = setTimeout(
              () =>
                reject(
                  new Error(
                    "Courses navigation did not reach the gated Next RSC request",
                  ),
                ),
              5_000,
            );
          }),
        ]),
      ]);
    } finally {
      if (observedTimeout) clearTimeout(observedTimeout);
    }

    assert.deepEqual(
      await runtime.page.evaluate(() => ({
        activeHref:
          document
            .querySelector<HTMLAnchorElement>(
              '.site-header-nav-pill[aria-current="page"]',
            )
            ?.getAttribute("href") ?? null,
        heading:
          document.querySelector<HTMLElement>("h1")?.textContent?.trim() ??
          null,
        pathname: window.location.pathname,
      })),
      {
        activeHref: "/students",
        heading: "Ученики",
        pathname: "/students",
      },
      "The gated Courses RSC request must leave the committed Students tree interactive",
    );

    await runtime.page
      .getByRole("link", { name: "Магазин", exact: true })
      .click();
    await runtime.page.waitForURL(/\/store$/, { timeout: 5_000 });
    await runtime.page
      .getByRole("heading", { name: "Магазин", exact: true, level: 1 })
      .waitFor();
    assert.equal(coursesRscGateReleased, false);

    releaseCoursesRsc();
    await allCoursesRscSettled;
    await runtime.page.waitForTimeout(250);

    const finalContract = await runtime.page.evaluate(() => {
      const testWindow = window as typeof window & {
        __e2ePrimaryNavCommits?: Array<{
          activeHref: string | null;
          heading: string | null;
          pathname: string;
        }>;
      };
      return {
        activeHref:
          document
            .querySelector<HTMLAnchorElement>(
              '.site-header-nav-pill[aria-current="page"]',
            )
            ?.getAttribute("href") ?? null,
        coursesCommitSeen:
          testWindow.__e2ePrimaryNavCommits?.some(
            (entry) =>
              entry.pathname === "/courses" ||
              entry.activeHref === "/courses" ||
              entry.heading === "Курсы",
          ) ?? false,
        heading:
          document.querySelector<HTMLElement>("h1")?.textContent?.trim() ??
          null,
        pathname: window.location.pathname,
      };
    });
    assert.deepEqual(finalContract, {
      activeHref: "/store",
      coursesCommitSeen: false,
      heading: "Магазин",
      pathname: "/store",
    });
  } finally {
    releaseCoursesRsc();
    await runtime.close();
  }
});

test("browser smoke: warmed Students header summary survives delayed content and a revisit", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });
  let summaryRequestCount = 0;
  let releaseDelayedStudentsContent: (() => void) | null = null;

  const releaseStudentsContent = () => {
    releaseDelayedStudentsContent?.();
    releaseDelayedStudentsContent = null;
  };

  try {
    await runtime.page.route("**/api/v2/app-header-summary*", async (route) => {
      summaryRequestCount += 1;
      await route.continue();
    });
    await runtime.page.clock.setFixedTime("2026-08-11T00:00:00.000Z");
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", { name: "Расписание", exact: true, level: 1 })
      .waitFor();
    assert.ok(
      summaryRequestCount >= 1,
      "Schedule must warm the shared primary-header summary",
    );
    const warmedSummaryRequestCount = summaryRequestCount;

    const studentsContentObserved = new Promise<void>((resolve) => {
      e2eStudentDirectoryRpcObserved = resolve;
    });
    e2eStudentDirectoryRpcGate = new Promise<void>((resolve) => {
      releaseDelayedStudentsContent = resolve;
    });

    const assertCachedStudentsChrome = async (context: string) => {
      const contract = await runtime.page.evaluate(() => {
        const header = document.querySelector<HTMLElement>(".app-page-header");
        const title = header?.querySelector<HTMLElement>(".app-page-title");
        const metric = header?.querySelector<HTMLElement>(".app-page-metric");
        const actions = header?.querySelector<HTMLElement>(".app-page-actions");
        const tabLabels = Array.from(
          document.querySelectorAll<HTMLElement>(
            "#students-directory-tablist [role=tab] .workspace-tab-label",
          ),
        ).map((label) => label.textContent?.trim().replace(/\s+/g, " ") ?? "");
        if (!header || !title || !metric || !actions) {
          throw new Error("Cached Students route chrome is missing");
        }
        return {
          pathname: window.location.pathname,
          pending: header.hasAttribute("data-page-header-pending"),
          ariaBusy: header.getAttribute("aria-busy"),
          title: title.textContent?.trim() ?? "",
          metric: metric.textContent?.trim() ?? "",
          action: actions.textContent?.trim().replace(/\s+/g, " ") ?? "",
          metricPlaceholder: metric.hasAttribute(
            "data-page-header-metric-placeholder",
          ),
          titleVisibility: getComputedStyle(title).visibility,
          metricVisibility: getComputedStyle(metric).visibility,
          actionsVisibility: getComputedStyle(actions).visibility,
          staticTabLabels: tabLabels.map((label) =>
            label.replace(/\s+\d+$/u, ""),
          ),
          studentsTabLabel: tabLabels[0] ?? "",
          loadingContentPresent:
            document.body.textContent?.includes(
              "Загружаем учеников и группы…",
            ) ?? false,
          tablePresent: Boolean(
            document.querySelector(
              '[aria-label="Ученики, их статусы и группы"]',
            ),
          ),
        };
      });

      assert.deepEqual(
        contract,
        {
          pathname: "/students",
          pending: false,
          ariaBusy: null,
          title: "Ученики",
          metric: "Активных: 4 · в архиве: 0 · ожидают: 1",
          action: "Новый ученик",
          metricPlaceholder: false,
          titleVisibility: "visible",
          metricVisibility: "visible",
          actionsVisibility: "visible",
          staticTabLabels: ["Ученики", "Группы", "Наблюдение"],
          studentsTabLabel: "Ученики 5",
          loadingContentPresent: true,
          tablePresent: false,
        },
        context,
      );
    };

    await Promise.all([
      runtime.page.waitForURL(/\/students$/),
      runtime.page.getByRole("link", { name: "Ученики", exact: true }).click(),
    ]);

    let studentsContentTimeout: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        studentsContentObserved,
        new Promise<void>((_, reject) => {
          studentsContentTimeout = setTimeout(
            () =>
              reject(
                new Error(
                  "Students revisit test did not reach the gated content request",
                ),
              ),
            5_000,
          );
        }),
      ]);
    } finally {
      if (studentsContentTimeout) clearTimeout(studentsContentTimeout);
    }
    await runtime.page
      .getByText("Загружаем учеников и группы…", { exact: true })
      .waitFor();
    await assertCachedStudentsChrome(
      "First Students visit must not wait for route content",
    );

    await Promise.all([
      runtime.page.waitForURL(/\/store$/),
      runtime.page.getByRole("link", { name: "Магазин", exact: true }).click(),
    ]);
    await runtime.page
      .getByRole("heading", { name: "Магазин", exact: true, level: 1 })
      .waitFor();

    await Promise.all([
      runtime.page.waitForURL(/\/students$/),
      runtime.page.getByRole("link", { name: "Ученики", exact: true }).click(),
    ]);
    await runtime.page
      .getByText("Загружаем учеников и группы…", { exact: true })
      .waitFor();
    await assertCachedStudentsChrome(
      "Revisited Students header must use the warm summary",
    );
    assert.equal(
      summaryRequestCount,
      warmedSummaryRequestCount,
      "Primary navigation within the TTL must not request the header summary again",
    );

    releaseStudentsContent();
    e2eStudentDirectoryRpcGate = null;
    e2eStudentDirectoryRpcObserved = null;
    await runtime.page
      .getByRole("table", {
        name: "Ученики, их статусы и группы",
        exact: true,
      })
      .waitFor();
  } finally {
    releaseStudentsContent();
    e2eStudentDirectoryRpcGate = null;
    e2eStudentDirectoryRpcObserved = null;
    await runtime.close();
  }
});

test("browser smoke: Account navigates Schedule → Students with honest V2 states", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eAiConsentRequested = false;
  const teacherCookie = authenticatedCookieValue();
  const runtime = await openPage({ cookie: teacherCookie });
  let releaseDelayedStudentsContent: (() => void) | null = null;

  const releaseStudentsContent = () => {
    releaseDelayedStudentsContent?.();
    releaseDelayedStudentsContent = null;
  };

  try {
    await runtime.page.clock.setFixedTime("2026-08-11T00:00:00.000Z");
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", { name: "Расписание", exact: true, level: 1 })
      .waitFor();
    await runtime.page.evaluate(() => {
      const transitionWindow = window as typeof window & {
        __e2ePageTransitionDirections?: string[];
        __e2ePageTransitionObserver?: MutationObserver;
      };
      transitionWindow.__e2ePageTransitionObserver?.disconnect();
      transitionWindow.__e2ePageTransitionDirections = [];
      transitionWindow.__e2ePageTransitionObserver = new MutationObserver(
        () => {
          const direction =
            document.documentElement.dataset.pageTransitionDirection;
          if (
            direction &&
            transitionWindow.__e2ePageTransitionDirections?.at(-1) !== direction
          ) {
            transitionWindow.__e2ePageTransitionDirections?.push(direction);
          }
        },
      );
      transitionWindow.__e2ePageTransitionObserver.observe(
        document.documentElement,
        {
          attributes: true,
          attributeFilter: ["data-page-transition-direction"],
        },
      );
    });
    await runtime.page
      .getByRole("heading", { name: "Занятий нет", exact: true, level: 2 })
      .waitFor();

    assert.equal(
      await runtime.page.locator(".teaching-schedule-period-switch").count(),
      0,
    );

    const dateTrigger = runtime.page.locator(".teaching-date-trigger");
    assert.equal(await dateTrigger.getAttribute("aria-haspopup"), "dialog");
    assert.equal(await dateTrigger.getAttribute("aria-expanded"), "false");
    assert.equal(
      (await dateTrigger.textContent())?.trim(),
      "Неделя · 10–16 авг",
    );

    async function expectDateTriggerLabel(label: string) {
      await dateTrigger.getByText(label, { exact: true }).waitFor();
      assert.equal((await dateTrigger.textContent())?.trim(), label);
    }

    await dateTrigger.click();
    const dateDialog = runtime.page.getByRole("dialog");
    await dateDialog.waitFor();
    await assertCanonicalProductDropdownSurface(
      dateDialog,
      "Schedule calendar popover",
    );
    assert.equal(await dateTrigger.getAttribute("aria-expanded"), "true");
    const periodGroup = dateDialog.getByRole("group", {
      name: "Период расписания",
      exact: true,
    });
    const dayButton = periodGroup.getByRole("button", {
      name: "День",
      exact: true,
    });
    const weekButton = periodGroup.getByRole("button", {
      name: "Неделя",
      exact: true,
    });
    const monthButton = periodGroup.getByRole("button", {
      name: "Месяц",
      exact: true,
    });
    assert.equal(await dayButton.getAttribute("aria-pressed"), "false");
    assert.equal(await weekButton.getAttribute("aria-pressed"), "true");
    assert.equal(await monthButton.getAttribute("aria-pressed"), "false");

    const initiallyFocusedDay = runtime.page.locator(
      ".teaching-date-grid button:focus",
    );
    await initiallyFocusedDay.waitFor();
    const initialFocusedDate =
      await initiallyFocusedDay.getAttribute("data-date");
    assert.ok(initialFocusedDate);
    const nextFocusedDate = new Date(`${initialFocusedDate}T12:00:00.000Z`);
    nextFocusedDate.setUTCDate(nextFocusedDate.getUTCDate() + 1);
    const nextFocusedDateValue = nextFocusedDate.toISOString().slice(0, 10);
    await initiallyFocusedDay.press("ArrowRight");
    await runtime.page
      .locator(
        `.teaching-date-grid button[data-date="${nextFocusedDateValue}"]:focus`,
      )
      .waitFor();
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.getAttribute("data-date"),
      ),
      nextFocusedDateValue,
    );

    const currentMonthHeading =
      (
        await dateDialog.getByRole("heading", { level: 2 }).textContent()
      )?.trim() ?? "";
    await dateDialog
      .getByRole("button", {
        name: "Следующий месяц календаря",
        exact: true,
      })
      .click();
    await runtime.page.locator(".teaching-date-grid button:focus").waitFor();
    const nextMonthFocusContract = await runtime.page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>(
        ".teaching-date-popover",
      );
      const grid = dialog?.querySelector<HTMLElement>(".teaching-date-grid");
      const heading = dialog?.querySelector<HTMLHeadingElement>("h2");
      const tabStops = Array.from(
        grid?.querySelectorAll<HTMLButtonElement>('button[tabindex="0"]') ?? [],
      );
      const focusedElement = document.activeElement;
      return {
        monthHeading: heading?.textContent?.trim() ?? "",
        tabStopCount: tabStops.length,
        focusedDayIsOnlyTabStop:
          tabStops.length === 1 && focusedElement === tabStops[0],
        focusedDayIsInVisibleGrid: Boolean(
          focusedElement && grid?.contains(focusedElement),
        ),
      };
    });
    assert.notEqual(nextMonthFocusContract.monthHeading, currentMonthHeading);
    assert.deepEqual(
      {
        tabStopCount: nextMonthFocusContract.tabStopCount,
        focusedDayIsOnlyTabStop: nextMonthFocusContract.focusedDayIsOnlyTabStop,
        focusedDayIsInVisibleGrid:
          nextMonthFocusContract.focusedDayIsInVisibleGrid,
      },
      {
        tabStopCount: 1,
        focusedDayIsOnlyTabStop: true,
        focusedDayIsInVisibleGrid: true,
      },
    );

    await dateDialog.press("Escape");
    await dateDialog.waitFor({ state: "detached" });
    await runtime.page.locator(".teaching-date-trigger:focus").waitFor();
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.classList.contains("teaching-date-trigger"),
      ),
      true,
    );

    await dateTrigger.click();
    await runtime.page.getByRole("dialog").waitFor();
    await runtime.page
      .getByRole("heading", { name: "Расписание", exact: true, level: 1 })
      .click();
    await runtime.page.getByRole("dialog").waitFor({ state: "detached" });

    function readScheduleWindow(response: { url: () => string }) {
      const query = new URL(response.url()).searchParams;
      const from = query.get("from");
      const to = query.get("to");
      assert.ok(from);
      assert.ok(to);
      return {
        from: new Date(from).getTime(),
        to: new Date(to).getTime(),
      };
    }

    async function selectPeriod(label: "День" | "Неделя" | "Месяц") {
      await dateTrigger.click();
      const dialog = runtime.page.getByRole("dialog");
      await dialog.waitFor();
      const responsePromise = runtime.page.waitForResponse((response) =>
        response.url().includes("/api/v2/lesson-runs?"),
      );
      await dialog
        .getByRole("group", {
          name: "Период расписания",
          exact: true,
        })
        .getByRole("button", { name: label, exact: true })
        .click();
      const window = readScheduleWindow(await responsePromise);
      await dialog.press("Escape");
      await dialog.waitFor({ state: "detached" });
      return window;
    }

    async function shiftPeriod(buttonName: string) {
      const responsePromise = runtime.page.waitForResponse((response) =>
        response.url().includes("/api/v2/lesson-runs?"),
      );
      await runtime.page
        .getByRole("button", { name: buttonName, exact: true })
        .click();
      return readScheduleWindow(await responsePromise);
    }

    const dayWindow = await selectPeriod("День");
    assert.equal(dayWindow.to - dayWindow.from, 24 * 60 * 60 * 1_000);
    await expectDateTriggerLabel("Сегодня · 11 авг");
    const nextDayWindow = await shiftPeriod("Следующий день");
    assert.equal(nextDayWindow.from, dayWindow.to);
    await expectDateTriggerLabel("Среда · 12 авг");
    const restoredDayWindow = await shiftPeriod("Предыдущий день");
    assert.deepEqual(restoredDayWindow, dayWindow);
    await expectDateTriggerLabel("Сегодня · 11 авг");

    const weekWindow = await selectPeriod("Неделя");
    assert.equal(weekWindow.to - weekWindow.from, 7 * 24 * 60 * 60 * 1_000);
    await expectDateTriggerLabel("Неделя · 10–16 авг");
    const nextWeekWindow = await shiftPeriod("Следующая неделя");
    assert.equal(nextWeekWindow.from, weekWindow.to);
    await expectDateTriggerLabel("Неделя · 17–23 авг");
    const restoredWeekWindow = await shiftPeriod("Предыдущая неделя");
    assert.deepEqual(restoredWeekWindow, weekWindow);
    await expectDateTriggerLabel("Неделя · 10–16 авг");

    const monthWindow = await selectPeriod("Месяц");
    await expectDateTriggerLabel("Авг 2026");
    const nextMonthWindow = await shiftPeriod("Следующий месяц");
    assert.equal(nextMonthWindow.from, monthWindow.to);
    await expectDateTriggerLabel("Сент 2026");
    const restoredMonthWindow = await shiftPeriod("Предыдущий месяц");
    assert.deepEqual(restoredMonthWindow, monthWindow);
    await expectDateTriggerLabel("Авг 2026");
    await runtime.page
      .locator(".teaching-date-trigger-chevron")
      .evaluate(async (chevron) => {
        await Promise.all(
          chevron
            .getAnimations()
            .map((animation) => animation.finished.catch(() => undefined)),
        );
      });

    const scheduleContract = await runtime.page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".course-demo-shell");
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
      const titleRow = pageHeading?.querySelector<HTMLElement>(
        ".app-page-title-row",
      );
      const title = document.querySelector<HTMLElement>(".app-page-title");
      const description = document.querySelector<HTMLElement>(
        ".app-page-description",
      );
      const headerActions =
        document.querySelector<HTMLElement>(".app-page-actions");
      const toolbar = document.querySelector<HTMLElement>(
        ".teaching-hub-toolbar",
      );
      const dateNavigator = document.querySelector<HTMLElement>(
        ".teaching-date-navigator",
      );
      const datePicker = document.querySelector<HTMLElement>(
        ".teaching-date-picker",
      );
      const dateTriggerControl = dateNavigator?.querySelector<HTMLElement>(
        ".teaching-date-trigger",
      );
      const dateControlIcons = Array.from(
        dateNavigator?.querySelectorAll<SVGElement>("svg") ?? [],
      );
      const toolbarActions = document.querySelector<HTMLElement>(
        ".teaching-schedule-toolbar-actions",
      );
      const viewToggle = document.querySelector<HTMLElement>(
        ".teaching-schedule-view-toggle",
      );
      const viewOptions = Array.from(
        viewToggle?.querySelectorAll<HTMLElement>("button") ?? [],
      );
      const viewIcons = Array.from(
        viewToggle?.querySelectorAll<SVGElement>("button svg.lucide") ?? [],
      );
      const activeViewButton = viewToggle?.querySelector<HTMLElement>(
        'button[aria-pressed="true"]',
      );
      const inactiveViewButton = viewToggle?.querySelector<HTMLElement>(
        'button[aria-pressed="false"]',
      );
      const viewIndicator = viewToggle?.querySelector<HTMLElement>(
        ".product-segmented-control-indicator",
      );
      const siteHeader = document.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );
      const headerPrimaryButton = headerActions?.querySelector<HTMLElement>(
        ".product-btn-primary",
      );
      const headerPrimaryIcon =
        headerPrimaryButton?.querySelector<SVGElement>("svg");
      const activeNavPill = siteHeader?.querySelector<HTMLElement>(
        ".site-header-nav-pill.nav-pill-active",
      );
      const navPillElements = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          ".site-header-shell-demo .site-header-nav-pill",
        ),
      );
      const navLinks = navPillElements.map((link) => ({
        label: link.textContent?.trim() ?? "",
        href: link.getAttribute("href"),
        current: link.getAttribute("aria-current"),
      }));
      const navIcons = Array.from(
        siteHeader?.querySelectorAll<SVGElement>(".nav-pill-icon") ?? [],
      );
      const userTrigger =
        siteHeader?.querySelector<HTMLElement>(".nav-profile-link");
      const userAvatar = userTrigger?.querySelector<HTMLElement>(
        ".nav-user-trigger-avatar",
      );

      if (
        !shell ||
        !pageHeader ||
        !pageHeading ||
        !titleRow ||
        !title ||
        !description ||
        !headerActions ||
        !toolbar ||
        !toolbarActions ||
        !dateNavigator ||
        !datePicker ||
        !dateTriggerControl ||
        dateControlIcons.length === 0 ||
        !viewToggle ||
        viewOptions.length !== 2 ||
        viewIcons.length !== 2 ||
        !activeViewButton ||
        !inactiveViewButton ||
        !viewIndicator ||
        !siteHeader ||
        !headerPrimaryButton ||
        !headerPrimaryIcon ||
        !activeNavPill ||
        navIcons.length === 0 ||
        !userTrigger ||
        !userAvatar
      ) {
        throw new Error("Schedule shell contract is missing");
      }

      const pageHeaderStyle = getComputedStyle(pageHeader);
      const pageHeadingStyle = getComputedStyle(pageHeading);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const toolbarStyle = getComputedStyle(toolbar);
      const dateNavigatorStyle = getComputedStyle(dateNavigator);
      const dateTriggerStyle = getComputedStyle(dateTriggerControl);
      const primaryButtonStyle = getComputedStyle(headerPrimaryButton);
      const primaryIconStyle = getComputedStyle(headerPrimaryIcon);
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const pageHeadingRect = pageHeading.getBoundingClientRect();
      const titleRowRect = titleRow.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();
      const headerActionContentRect =
        headerActions.firstElementChild?.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarActionsRect = toolbarActions.getBoundingClientRect();
      const dateNavigatorRect = dateNavigator.getBoundingClientRect();
      const datePickerRect = datePicker.getBoundingClientRect();
      const viewToggleRect = viewToggle.getBoundingClientRect();
      const viewIndicatorRect = viewIndicator.getBoundingClientRect();
      const activeViewButtonRect = activeViewButton.getBoundingClientRect();
      const userTriggerRect = userTrigger.getBoundingClientRect();
      const userAvatarRect = userAvatar.getBoundingClientRect();
      const userAvatarStyle = getComputedStyle(userAvatar);
      const readGlyph = (icon: SVGElement) => {
        const rect = icon.getBoundingClientRect();
        const strokePart = icon.querySelector<SVGElement>(
          "path, line, polyline, polygon, circle, ellipse, rect",
        );
        const strokeStyle = getComputedStyle(strokePart ?? icon);
        return {
          width: rect.width,
          height: rect.height,
          strokeWidth: strokeStyle.strokeWidth,
          vectorEffect: strokeStyle.vectorEffect,
        };
      };
      const readSurface = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return {
          borderTopWidth: style.borderTopWidth,
          borderTopStyle: style.borderTopStyle,
          borderRadius: style.borderRadius,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          backgroundClip: style.backgroundClip,
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      };

      return {
        backgroundColor: getComputedStyle(shell).backgroundColor,
        backgroundImage: getComputedStyle(shell).backgroundImage,
        siteHeaderBackgroundColor: getComputedStyle(siteHeader).backgroundColor,
        siteHeaderBackdropFilter: getComputedStyle(siteHeader).backdropFilter,
        headerLayout: {
          minHeight: pageHeaderStyle.minHeight,
          height: pageHeaderRect.height,
          headingMinWidth: pageHeadingStyle.minWidth,
          headingWidth: pageHeadingRect.width,
          actionsWidth: headerActionsRect.width,
          actionContentWidth: headerActionContentRect?.width ?? 0,
          actionsFitContentDelta: Math.abs(
            headerActionsRect.width - (headerActionContentRect?.width ?? 0),
          ),
          actionsRightDelta: Math.abs(
            pageHeaderRect.right -
              Number.parseFloat(pageHeaderStyle.paddingRight) -
              headerActionsRect.right,
          ),
          actionsShareTitleRow:
            title.parentElement === titleRow &&
            headerActions.parentElement === titleRow &&
            headerActionsRect.top < titleRect.bottom &&
            headerActionsRect.bottom > titleRect.top,
          titleActionBottomDelta: Math.abs(
            headerActionsRect.bottom - titleRect.bottom,
          ),
          actionControlBottomDelta: Math.abs(
            headerPrimaryButton.getBoundingClientRect().bottom -
              titleRect.bottom,
          ),
          metricBelowTitleRow: descriptionRect.top >= titleRowRect.bottom - 0.5,
          metricGapDelta: Math.abs(
            descriptionRect.top -
              titleRowRect.bottom -
              Number.parseFloat(pageHeadingStyle.rowGap),
          ),
        },
        headerSignature: {
          titleFontFamily: titleStyle.fontFamily,
          titleFontSize: titleStyle.fontSize,
          titleFontWeight: titleStyle.fontWeight,
          titleLineHeight: titleStyle.lineHeight,
          titleLetterSpacing: titleStyle.letterSpacing,
          descriptionFontSize: descriptionStyle.fontSize,
          descriptionLineHeight: descriptionStyle.lineHeight,
          descriptionColor: descriptionStyle.color,
        },
        headerDescription: description.textContent?.trim() ?? "",
        headerActions: headerActions.textContent?.trim() ?? "",
        headerActionIconClass:
          headerActions.querySelector("svg")?.getAttribute("class") ?? "",
        headerPrimaryControl: {
          height: primaryButtonStyle.height,
          clientHeight: headerPrimaryButton.clientHeight,
          fontSize: primaryButtonStyle.fontSize,
          fontWeight: primaryButtonStyle.fontWeight,
          backgroundColor: primaryButtonStyle.backgroundColor,
          borderTopWidth: primaryButtonStyle.borderTopWidth,
          borderTopStyle: primaryButtonStyle.borderTopStyle,
          borderTopColor: primaryButtonStyle.borderTopColor,
          backgroundClip: primaryButtonStyle.backgroundClip,
          color: primaryButtonStyle.color,
          boxShadow: primaryButtonStyle.boxShadow,
          transform: primaryButtonStyle.transform,
          icon: {
            color: primaryIconStyle.color,
            opacity: primaryIconStyle.opacity,
            ...readGlyph(headerPrimaryIcon),
          },
        },
        raisedControlShadow: getComputedStyle(viewIndicator).boxShadow,
        viewToggleSurface: {
          backgroundColor: getComputedStyle(viewToggle).backgroundColor,
          borderTopWidth: getComputedStyle(viewToggle).borderTopWidth,
          boxShadow: getComputedStyle(viewToggle).boxShadow,
        },
        desktopSegmentedControl: {
          width: viewToggleRect.width,
          height: viewToggleRect.height,
          padding: getComputedStyle(viewToggle).padding,
          gap: getComputedStyle(viewToggle).gap,
          borderTopWidth: getComputedStyle(viewToggle).borderTopWidth,
          borderTopStyle: getComputedStyle(viewToggle).borderTopStyle,
          borderTopColor: getComputedStyle(viewToggle).borderTopColor,
          borderRadius: getComputedStyle(viewToggle).borderRadius,
          backgroundColor: getComputedStyle(viewToggle).backgroundColor,
          backgroundClip: getComputedStyle(viewToggle).backgroundClip,
          indicatorReady: viewToggle.getAttribute("data-indicator-ready"),
          indicatorCount: viewToggle.querySelectorAll(
            ".product-segmented-control-indicator",
          ).length,
          indicator: {
            ...readSurface(viewIndicator),
            ariaHidden: viewIndicator.getAttribute("aria-hidden"),
            ready: viewIndicator.getAttribute("data-ready"),
            motionReady: viewIndicator.getAttribute("data-motion-ready"),
            pointerEvents: getComputedStyle(viewIndicator).pointerEvents,
            opacity: getComputedStyle(viewIndicator).opacity,
            transitionProperty:
              getComputedStyle(viewIndicator).transitionProperty,
            transitionDuration:
              getComputedStyle(viewIndicator).transitionDuration,
            transitionTimingFunction:
              getComputedStyle(viewIndicator).transitionTimingFunction,
            width: viewIndicatorRect.width,
            height: viewIndicatorRect.height,
            startDelta: Math.abs(
              viewIndicatorRect.left - activeViewButtonRect.left,
            ),
            topDelta: Math.abs(
              viewIndicatorRect.top - activeViewButtonRect.top,
            ),
            widthDelta: Math.abs(
              viewIndicatorRect.width - activeViewButtonRect.width,
            ),
            heightDelta: Math.abs(
              viewIndicatorRect.height - activeViewButtonRect.height,
            ),
          },
          optionWidths: viewOptions.map(
            (option) => option.getBoundingClientRect().width,
          ),
          optionHeights: viewOptions.map(
            (option) => option.getBoundingClientRect().height,
          ),
          seamGaps: viewOptions.slice(1).map((option, index) => {
            const previousRect = viewOptions[index]!.getBoundingClientRect();
            return Number(
              (
                option.getBoundingClientRect().left - previousRect.right
              ).toFixed(3),
            );
          }),
          optionRadii: viewOptions.map(
            (option) => getComputedStyle(option).borderRadius,
          ),
          iconStyles: viewIcons.map(readGlyph),
          selected: readSurface(activeViewButton),
          inactive: readSurface(inactiveViewButton),
        },
        toolbarText: toolbar.textContent?.trim() ?? "",
        toolbarSurface: {
          backgroundColor: toolbarStyle.backgroundColor,
          borderTopWidth: toolbarStyle.borderTopWidth,
          boxShadow: toolbarStyle.boxShadow,
          paddingTop: toolbarStyle.paddingTop,
          paddingLeft: toolbarStyle.paddingLeft,
          paddingRight: toolbarStyle.paddingRight,
        },
        dateNavigator: {
          backgroundColor: dateNavigatorStyle.backgroundColor,
          height: dateNavigatorStyle.height,
          clientHeight: dateNavigator.clientHeight,
          width: dateNavigatorRect.width,
          pickerWidth: datePickerRect.width,
          borderTopWidth: dateNavigatorStyle.borderTopWidth,
          borderTopStyle: dateNavigatorStyle.borderTopStyle,
          borderTopColor: dateNavigatorStyle.borderTopColor,
          backgroundClip: dateNavigatorStyle.backgroundClip,
          boxShadow: dateNavigatorStyle.boxShadow,
          transform: dateNavigatorStyle.transform,
          triggerFontSize: dateTriggerStyle.fontSize,
          triggerFontWeight: dateTriggerStyle.fontWeight,
          triggerColor: dateTriggerStyle.color,
          icons: dateControlIcons.map((icon) => {
            const style = getComputedStyle(icon);
            return {
              color: style.color,
              opacity: style.opacity,
              ...readGlyph(icon),
            };
          }),
        },
        controlsLayout: {
          rightDelta: Math.abs(toolbarRect.right - toolbarActionsRect.right),
          insideInlineInset:
            toolbarActionsRect.left >=
              toolbarRect.left +
                Number.parseFloat(toolbarStyle.paddingLeft) -
                0.5 &&
            toolbarActionsRect.right <=
              toolbarRect.right -
                Number.parseFloat(toolbarStyle.paddingRight) +
                0.5,
          dateBeforeView: dateNavigatorRect.right <= viewToggleRect.left,
          compactDateControl: dateNavigatorRect.width <= 352,
          externalPeriodSwitchCount: document.querySelectorAll(
            ".teaching-schedule-period-switch",
          ).length,
        },
        viewButtons: Array.from(viewToggle.querySelectorAll("button")).map(
          (button) => ({
            label: button.getAttribute("aria-label"),
            pressed: button.getAttribute("aria-pressed"),
          }),
        ),
        navigationControls: {
          activePillBoxShadow: getComputedStyle(activeNavPill).boxShadow,
          pillFontWeights: navPillElements.map(
            (pill) => getComputedStyle(pill).fontWeight,
          ),
          iconStyles: navIcons.map((icon) => {
            const style = getComputedStyle(icon);
            const content = icon.closest<HTMLElement>(".nav-pill-content");
            const contentStyle = content ? getComputedStyle(content) : null;
            return {
              color: style.color,
              contentColor: contentStyle?.color ?? "",
              mixBlendMode: contentStyle?.mixBlendMode ?? "",
              opacity: style.opacity,
            };
          }),
          userControl: {
            triggerWidth: userTriggerRect.width,
            triggerHeight: userTriggerRect.height,
            avatarWidth: userAvatarRect.width,
            avatarHeight: userAvatarRect.height,
            avatarRadius: userAvatarStyle.borderRadius,
            visibleNameCount: userTrigger.querySelectorAll(
              ".nav-user-trigger-name",
            ).length,
          },
        },
        navLinks,
      };
    });

    assert.equal(scheduleContract.backgroundColor, "rgb(245, 241, 232)");
    assert.equal(scheduleContract.backgroundImage, "none");
    assert.equal(
      scheduleContract.siteHeaderBackgroundColor,
      "rgb(255, 255, 255)",
    );
    assert.equal(scheduleContract.siteHeaderBackdropFilter, "none");
    assert.ok(
      ["auto", "0px"].includes(scheduleContract.headerLayout.minHeight),
    );
    assert.ok(scheduleContract.headerLayout.height > 0);
    assert.ok(scheduleContract.headerLayout.height < 200);
    assert.equal(scheduleContract.headerLayout.headingMinWidth, "0px");
    assert.ok(
      scheduleContract.headerLayout.headingWidth >
        scheduleContract.headerLayout.actionsWidth,
    );
    assert.ok(scheduleContract.headerLayout.actionContentWidth > 0);
    assert.ok(scheduleContract.headerLayout.actionsFitContentDelta < 0.5);
    assert.ok(scheduleContract.headerLayout.actionsRightDelta < 0.5);
    assert.equal(scheduleContract.headerLayout.actionsShareTitleRow, true);
    assert.ok(scheduleContract.headerLayout.titleActionBottomDelta < 0.5);
    assert.ok(scheduleContract.headerLayout.actionControlBottomDelta < 0.5);
    assert.equal(scheduleContract.headerLayout.metricBelowTitleRow, true);
    assert.ok(scheduleContract.headerLayout.metricGapDelta < 0.5);
    assert.equal(scheduleContract.headerSignature.titleFontWeight, "400");
    assert.equal(
      scheduleContract.headerSignature.descriptionColor,
      E2E_MUTED_FOREGROUND,
    );
    assert.equal(scheduleContract.headerDescription, "Авг 2026 · занятий: 0");
    assert.equal(scheduleContract.headerActions, "Назначить урок");
    assert.match(scheduleContract.headerActionIconClass, /calendar-plus/);
    assert.deepEqual(scheduleContract.headerPrimaryControl, {
      height: "40px",
      clientHeight: 38,
      fontSize: "14.08px",
      fontWeight: "400",
      backgroundColor: "rgb(255, 255, 255)",
      borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      borderTopStyle: "solid",
      borderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
      backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      color: "rgb(20, 20, 20)",
      boxShadow: E2E_RAISED_CONTROL_SHADOW,
      transform: "none",
      icon: {
        color: "rgb(20, 20, 20)",
        opacity: "1",
        width: 16,
        height: 16,
        strokeWidth: "2px",
        vectorEffect: "none",
      },
    });
    assertSegmentedSurfaceShadow(
      scheduleContract.raisedControlShadow,
      scheduleContract.headerPrimaryControl.boxShadow,
      "Schedule desktop selected surface shadow",
    );
    assert.deepEqual(scheduleContract.viewToggleSurface, {
      backgroundColor: E2E_SEGMENTED_CONTROL_BACKGROUND,
      borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      boxShadow: "none",
    });
    assert.deepEqual(scheduleContract.desktopSegmentedControl, {
      width: 80,
      height: 40,
      padding: "0px",
      gap: "2px",
      borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      borderTopStyle: "solid",
      borderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
      borderRadius: "12px",
      backgroundColor: E2E_SEGMENTED_CONTROL_BACKGROUND,
      backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      indicatorReady: "true",
      indicatorCount: 1,
      indicator: {
        borderTopWidth: "0px",
        borderTopStyle: "none",
        borderRadius: "11px",
        backgroundColor: "rgb(255, 255, 255)",
        backgroundImage: "none",
        backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
        boxShadow: scheduleContract.desktopSegmentedControl.indicator.boxShadow,
        transform: scheduleContract.desktopSegmentedControl.indicator.transform,
        ariaHidden: "true",
        ready: "true",
        motionReady: "true",
        pointerEvents: "none",
        opacity: "1",
        transitionProperty: "width, transform, opacity",
        transitionDuration: "0.36s, 0.36s, 0.12s",
        transitionTimingFunction:
          "cubic-bezier(0.22, 1, 0.36, 1), cubic-bezier(0.22, 1, 0.36, 1), ease",
        width: 38,
        height: 38,
        startDelta:
          scheduleContract.desktopSegmentedControl.indicator.startDelta,
        topDelta: scheduleContract.desktopSegmentedControl.indicator.topDelta,
        widthDelta:
          scheduleContract.desktopSegmentedControl.indicator.widthDelta,
        heightDelta:
          scheduleContract.desktopSegmentedControl.indicator.heightDelta,
      },
      optionWidths: [38, 38],
      optionHeights: [38, 38],
      seamGaps: [2],
      optionRadii: ["11px", "11px"],
      iconStyles: [
        {
          width: 16,
          height: 16,
          strokeWidth: "2px",
          vectorEffect: "none",
        },
        {
          width: 16,
          height: 16,
          strokeWidth: "2px",
          vectorEffect: "none",
        },
      ],
      selected: {
        borderTopWidth: "0px",
        borderTopStyle: "none",
        borderRadius: "11px",
        backgroundColor: "rgba(0, 0, 0, 0)",
        backgroundImage: "none",
        backgroundClip: "border-box",
        boxShadow: "none",
        transform: "none",
      },
      inactive: {
        borderTopWidth: "0px",
        borderTopStyle: "none",
        borderRadius: "11px",
        backgroundColor: "rgba(0, 0, 0, 0)",
        backgroundImage: "none",
        backgroundClip: "border-box",
        boxShadow: "none",
        transform: "none",
      },
    });
    assertSegmentedSurfaceShadow(
      scheduleContract.desktopSegmentedControl.indicator.boxShadow,
      scheduleContract.headerPrimaryControl.boxShadow,
      "Schedule desktop indicator shadow",
    );
    for (const [axis, delta] of Object.entries({
      start: scheduleContract.desktopSegmentedControl.indicator.startDelta,
      top: scheduleContract.desktopSegmentedControl.indicator.topDelta,
      width: scheduleContract.desktopSegmentedControl.indicator.widthDelta,
      height: scheduleContract.desktopSegmentedControl.indicator.heightDelta,
    })) {
      assert.ok(
        delta < 0.5,
        `Schedule desktop indicator ${axis} alignment failed with ${delta}`,
      );
    }
    await assertSegmentedIndicatorAligned(
      runtime.page,
      "Вид занятий",
      "Schedule desktop view toggle",
    );
    const desktopInactiveViewOption = runtime.page.locator(
      '.teaching-schedule-view-toggle button[aria-pressed="false"]',
    );
    const desktopInactiveViewRest = await desktopInactiveViewOption.evaluate(
      (option) => {
        const icon = option.querySelector<SVGElement>("svg.lucide");
        const style = getComputedStyle(option);
        return {
          color: style.color,
          iconColor: icon ? getComputedStyle(icon).color : null,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      },
    );
    assert.equal(desktopInactiveViewRest.color, "oklch(0.439 0 0)");
    assert.deepEqual(desktopInactiveViewRest, {
      color: desktopInactiveViewRest.color,
      iconColor: desktopInactiveViewRest.color,
      backgroundColor: "rgba(0, 0, 0, 0)",
      backgroundImage: "none",
      boxShadow: "none",
      transform: "none",
    });
    await desktopInactiveViewOption.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await desktopInactiveViewOption.evaluate((option) => {
        const icon = option.querySelector<SVGElement>("svg.lucide");
        const style = getComputedStyle(option);
        return {
          color: style.color,
          iconColor: icon ? getComputedStyle(icon).color : null,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      {
        color: "oklch(0.145 0 0)",
        iconColor: "oklch(0.145 0 0)",
        backgroundColor: "rgba(0, 0, 0, 0)",
        backgroundImage: "none",
        boxShadow: "none",
        transform: "none",
      },
      "Fine-pointer hover must change only the inactive segment foreground",
    );
    await runtime.page.mouse.move(0, 0);
    const scheduleHeaderPrimaryButton = runtime.page.getByRole("link", {
      name: "Назначить урок",
      exact: true,
    });
    const scheduleHeaderRestRect =
      await scheduleHeaderPrimaryButton.boundingBox();
    assert.ok(scheduleHeaderRestRect);
    await scheduleHeaderPrimaryButton.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await scheduleHeaderPrimaryButton.evaluate((button) => {
        const style = getComputedStyle(button);
        return {
          backgroundColor: style.backgroundColor,
          borderTopWidth: style.borderTopWidth,
          backgroundClip: style.backgroundClip,
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      {
        backgroundColor: "rgb(255, 255, 255)",
        borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
        backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
        boxShadow: E2E_RAISED_CONTROL_HOVER_SHADOW,
        transform: E2E_RAISED_CONTROL_HOVER_TRANSFORM,
      },
    );
    const scheduleHeaderHoverRect =
      await scheduleHeaderPrimaryButton.boundingBox();
    assert.ok(scheduleHeaderHoverRect);
    assert.ok(
      Math.abs(scheduleHeaderHoverRect.width - scheduleHeaderRestRect.width) <
        0.01,
    );
    assert.ok(
      Math.abs(scheduleHeaderHoverRect.height - scheduleHeaderRestRect.height) <
        0.01,
    );
    assert.ok(
      Math.abs(scheduleHeaderHoverRect.y - (scheduleHeaderRestRect.y - 1)) <
        0.01,
    );
    await runtime.page.mouse.down();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await scheduleHeaderPrimaryButton.evaluate((button) => {
        const style = getComputedStyle(button);
        return {
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      {
        boxShadow: E2E_RAISED_CONTROL_PRESSED_SHADOW,
        transform: "none",
      },
    );
    const scheduleHeaderPressedRect =
      await scheduleHeaderPrimaryButton.boundingBox();
    assert.ok(scheduleHeaderPressedRect);
    assert.ok(
      Math.abs(scheduleHeaderPressedRect.width - scheduleHeaderRestRect.width) <
        0.01,
    );
    assert.ok(
      Math.abs(
        scheduleHeaderPressedRect.height - scheduleHeaderRestRect.height,
      ) < 0.01,
    );
    assert.ok(
      Math.abs(scheduleHeaderPressedRect.y - scheduleHeaderRestRect.y) < 0.01,
    );
    await runtime.page.mouse.move(0, 0);
    await runtime.page.mouse.up();
    assert.doesNotMatch(scheduleContract.toolbarText, /Назначить урок/);
    assert.deepEqual(scheduleContract.toolbarSurface, {
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderTopWidth: "0px",
      boxShadow: "none",
      paddingTop: "0px",
      paddingLeft: "0px",
      paddingRight: "0px",
    });
    assert.deepEqual(
      {
        backgroundColor: scheduleContract.dateNavigator.backgroundColor,
        height: scheduleContract.dateNavigator.height,
        clientHeight: scheduleContract.dateNavigator.clientHeight,
        borderTopWidth: scheduleContract.dateNavigator.borderTopWidth,
        borderTopStyle: scheduleContract.dateNavigator.borderTopStyle,
        borderTopColor: scheduleContract.dateNavigator.borderTopColor,
        backgroundClip: scheduleContract.dateNavigator.backgroundClip,
        boxShadow: scheduleContract.dateNavigator.boxShadow,
        transform: scheduleContract.dateNavigator.transform,
      },
      {
        backgroundColor: "rgb(255, 255, 255)",
        height: "40px",
        clientHeight: 38,
        borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
        borderTopStyle: "solid",
        borderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
        backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
        boxShadow: E2E_ENTRY_CONTROL_SHADOW,
        transform: "none",
      },
    );
    assert.equal(scheduleContract.dateNavigator.triggerFontSize, "14.08px");
    assert.equal(scheduleContract.dateNavigator.triggerFontWeight, "400");
    assert.equal(
      scheduleContract.dateNavigator.triggerColor,
      "rgb(20, 20, 20)",
    );
    assert.ok(
      scheduleContract.dateNavigator.icons.every(
        ({ color, opacity, width, height, strokeWidth, vectorEffect }) =>
          color === "rgb(20, 20, 20)" &&
          opacity === "1" &&
          width === 16 &&
          height === 16 &&
          strokeWidth === "2px" &&
          vectorEffect === "none",
      ),
      `desktop Schedule date glyphs: ${JSON.stringify(scheduleContract.dateNavigator.icons)}`,
    );
    assert.ok(
      Math.abs(scheduleContract.dateNavigator.width - 300) < 0.5,
      `date navigator width: ${scheduleContract.dateNavigator.width}`,
    );
    assert.ok(
      Math.abs(scheduleContract.dateNavigator.pickerWidth - 300) < 0.5,
      `date picker width: ${scheduleContract.dateNavigator.pickerWidth}`,
    );
    assert.deepEqual(scheduleContract.controlsLayout, {
      rightDelta: 0,
      insideInlineInset: true,
      dateBeforeView: true,
      compactDateControl: true,
      externalPeriodSwitchCount: 0,
    });
    assert.deepEqual(scheduleContract.viewButtons, [
      { label: "Показать таблицей", pressed: "true" },
      { label: "Показать карточками", pressed: "false" },
    ]);
    assert.equal(
      scheduleContract.navigationControls.activePillBoxShadow,
      "none",
    );
    assert.ok(
      scheduleContract.navigationControls.pillFontWeights.every(
        (fontWeight) => fontWeight === "400",
      ),
    );
    assert.ok(
      scheduleContract.navigationControls.iconStyles.every(
        ({ color, contentColor, mixBlendMode, opacity }) =>
          color === contentColor &&
          mixBlendMode === "difference" &&
          opacity === "1",
      ),
    );
    assert.deepEqual(scheduleContract.navigationControls.userControl, {
      triggerWidth: 40,
      triggerHeight: 40,
      avatarWidth: 40,
      avatarHeight: 40,
      avatarRadius: "12px",
      visibleNameCount: 0,
    });
    assert.deepEqual(scheduleContract.navLinks, [
      { label: "Расписание", href: "/schedule", current: "page" },
      { label: "Ученики", href: "/students", current: null },
      { label: "Курсы", href: "/courses", current: null },
      { label: "Магазин", href: "/store", current: null },
    ]);

    let html = await runtime.page.content();
    assert.match(html, /Занятий нет/);
    assert.match(html, /Назначить урок/);
    assert.doesNotMatch(html, /Назначить урок в курсе/);
    assert.doesNotMatch(html, /Миша Орлов|Food around the world/);

    e2eCompletionPhase = null;
    e2eScheduleFixtureVisible = true;
    e2eScheduleFixtureRunCount = 2;
    await dateTrigger.click();
    const fixtureDateDialog = runtime.page.getByRole("dialog");
    await fixtureDateDialog.waitFor();
    const weekResponsePromise = runtime.page.waitForResponse((response) =>
      response.url().includes("/api/v2/lesson-runs?"),
    );
    await fixtureDateDialog
      .getByRole("group", {
        name: "Период расписания",
        exact: true,
      })
      .getByRole("button", { name: "Неделя", exact: true })
      .click();
    const fixtureWeekWindow = readScheduleWindow(await weekResponsePromise);
    assert.equal(
      fixtureWeekWindow.to - fixtureWeekWindow.from,
      7 * 24 * 60 * 60 * 1_000,
    );

    const dateResponsePromise = runtime.page.waitForResponse((response) =>
      response.url().includes("/api/v2/lesson-runs?"),
    );
    await runtime.page
      .locator('.teaching-date-grid button[data-date="2026-08-12"]')
      .click();
    readScheduleWindow(await dateResponsePromise);
    await fixtureDateDialog.waitFor({ state: "detached" });
    assert.equal(await dateTrigger.getAttribute("aria-expanded"), "false");
    await expectDateTriggerLabel("Неделя · 10–16 авг");
    await runtime.page.locator(".teaching-date-trigger:focus").waitFor();
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.classList.contains("teaching-date-trigger"),
      ),
      true,
    );
    const scheduleTable = runtime.page.getByRole("table", {
      name: "Занятия за выбранную неделю",
      exact: true,
    });
    await scheduleTable.waitFor();
    await assertCanonicalFirstBodyRowTypography(scheduleTable, "Расписание");
    const scheduleResults = runtime.page.getByRole("region", {
      name: "Назначенные уроки за выбранную неделю",
      exact: true,
    });
    await scheduleResults.waitFor();
    const scheduleTimeHeader = scheduleTable.getByRole("columnheader", {
      name: "Время",
      exact: true,
    });
    const scheduleTimeSort = scheduleTimeHeader.getByRole("button", {
      name: "Время",
      exact: true,
    });
    const scheduleDateHeader = scheduleTable.getByRole("columnheader", {
      name: "Дата",
      exact: true,
    });
    const scheduleRunOrder = () =>
      runtime.page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLTimeElement>(
            ".teaching-run-table tbody tr td:nth-child(2) time",
          ),
        ).map((element) => element.dateTime),
      );
    assert.equal(await scheduleTimeHeader.getAttribute("aria-sort"), "none");
    assert.equal(await scheduleTable.locator("thead svg").count(), 1);
    assert.equal(
      await scheduleDateHeader.locator("svg.lucide-arrow-up").count(),
      1,
    );
    assert.equal(await scheduleTimeHeader.locator("svg").count(), 0);
    await scheduleTimeSort.click();
    assert.equal(
      await scheduleTimeHeader.getAttribute("aria-sort"),
      "ascending",
    );
    assert.equal(await scheduleTable.locator("thead svg").count(), 1);
    assert.equal(await scheduleDateHeader.locator("svg").count(), 0);
    assert.equal(
      await scheduleTimeHeader.locator("svg.lucide-arrow-up").count(),
      1,
    );
    assert.deepEqual(await scheduleRunOrder(), [
      "2026-08-12T03:00:00.000Z",
      "2026-08-12T05:30:00.000Z",
    ]);
    await scheduleTimeSort.click();
    assert.equal(
      await scheduleTimeHeader.getAttribute("aria-sort"),
      "descending",
    );
    assert.equal(await scheduleTable.locator("thead svg").count(), 1);
    assert.equal(
      await scheduleTimeHeader.locator("svg.lucide-arrow-down").count(),
      1,
    );
    assert.deepEqual(await scheduleRunOrder(), [
      "2026-08-12T05:30:00.000Z",
      "2026-08-12T03:00:00.000Z",
    ]);
    await scheduleTimeSort.click();
    assert.equal(
      await runtime.page
        .locator(".teaching-run-table tbody .teaching-run-table-row")
        .count(),
      2,
    );
    assert.equal(
      await runtime.page
        .locator(
          'section[aria-label="Назначенные уроки за выбранную неделю"] > .teaching-section-heading',
        )
        .count(),
      0,
    );
    assert.equal(
      await runtime.page
        .getByRole("heading", { name: "Занятия", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await runtime.page.getByText("Выбранная неделя", { exact: true }).count(),
      0,
    );
    assert.match(
      (await scheduleTable.textContent()) ?? "",
      /Present Perfect · жизненный опыт/,
    );

    const scheduleTableContract = await runtime.page.evaluate(() => {
      const wrapper = document.querySelector<HTMLElement>(
        ".teaching-run-table-wrap",
      );
      const table = document.querySelector<HTMLTableElement>(
        ".teaching-run-table",
      );
      const tableHead = table?.querySelector<HTMLTableSectionElement>("thead");
      const headerRow = table?.querySelector<HTMLTableRowElement>("thead tr");
      const headerCells = Array.from(
        table?.querySelectorAll<HTMLTableCellElement>("thead th") ?? [],
      );
      const colElements = Array.from(
        table?.querySelectorAll<HTMLTableColElement>("colgroup col") ?? [],
      );
      const bodyRow = table?.querySelector<HTMLTableRowElement>(
        ".teaching-run-table-row",
      );
      const bodyCells = bodyRow ? Array.from(bodyRow.cells) : [];
      const dateCellText = table
        ?.querySelector<HTMLElement>(".teaching-run-table-date")
        ?.textContent?.trim();
      const timeCellText = table
        ?.querySelector<HTMLElement>(".teaching-run-table-duration")
        ?.textContent?.trim();
      const status = table?.querySelector<HTMLElement>(
        ".teaching-run-table-status",
      );
      const actionCell = table?.querySelector<HTMLElement>(
        ".teaching-run-table-action-cell",
      );
      const quickActionCount = table?.querySelectorAll(
        ".teaching-run-table-quick-actions, .teaching-run-table-quick-action",
      ).length;
      const menuTrigger = table?.querySelector<HTMLButtonElement>(
        ".teaching-run-action-menu .action-menu-trigger",
      );
      const menuTriggerIcon = menuTrigger?.querySelector<SVGElement>("svg");
      const activeViewButton = document.querySelector<HTMLButtonElement>(
        '.teaching-schedule-view-toggle button[aria-pressed="true"]',
      );
      const bodyTextElements = Array.from(
        table?.querySelectorAll<HTMLElement>(
          ".teaching-run-table-date, .teaching-run-table-duration, .teaching-run-table-truncate, .teaching-run-table-participants, .teaching-run-table-status",
        ) ?? [],
      );
      const bodyIcons = Array.from(
        table?.querySelectorAll<SVGElement>(".teaching-run-table-row svg") ??
          [],
      );
      const truncationElements = Array.from(
        table?.querySelectorAll<HTMLElement>(
          ".teaching-run-table-date, .teaching-run-table-duration, .teaching-run-table-truncate",
        ) ?? [],
      );
      const longValue = "ОченьДлинноеНазваниеБезПробелов".repeat(8);
      for (const element of table?.querySelectorAll<HTMLElement>(
        ".teaching-run-table-truncate",
      ) ?? []) {
        element.textContent = longValue;
      }

      if (
        !wrapper ||
        !table ||
        !tableHead ||
        !headerRow ||
        !bodyRow ||
        colElements.length !== 7 ||
        bodyCells.length !== 7 ||
        !dateCellText ||
        !timeCellText ||
        !status ||
        !actionCell ||
        quickActionCount === undefined ||
        !menuTrigger ||
        !menuTriggerIcon ||
        !activeViewButton
      ) {
        throw new Error("Schedule table visual contract is missing");
      }
      const wrapperStyle = getComputedStyle(wrapper);
      const tableStyle = getComputedStyle(table);
      const tableHeadStyle = getComputedStyle(tableHead);
      const statusStyle = getComputedStyle(status);
      const menuTriggerStyle = getComputedStyle(menuTrigger);
      const activeViewButtonStyle = getComputedStyle(activeViewButton);
      const bodyRowRect = bodyRow.getBoundingClientRect();
      const actionCellRect = actionCell.getBoundingClientRect();
      const menuTriggerRect = menuTrigger.getBoundingClientRect();
      const actionHeader = headerCells.at(-1);
      return {
        surface: {
          wrapperBackgroundColor: wrapperStyle.backgroundColor,
          wrapperBackgroundClip: wrapperStyle.backgroundClip,
          tableBackgroundColor: tableStyle.backgroundColor,
          firstBodyRowBorderTopWidth: getComputedStyle(bodyRow).borderTopWidth,
          wrapperBorderWidths: [
            wrapperStyle.borderTopWidth,
            wrapperStyle.borderRightWidth,
            wrapperStyle.borderBottomWidth,
            wrapperStyle.borderLeftWidth,
          ],
          wrapperBorderRadius: wrapperStyle.borderRadius,
          wrapperBorderStyle: wrapperStyle.borderTopStyle,
          wrapperBorderColor: wrapperStyle.borderTopColor,
        },
        layout: {
          tableLayout: tableStyle.tableLayout,
          minWidth: tableStyle.minWidth,
          colClasses: colElements.map((column) => column.className),
          columnWidths: headerCells.map(
            (cell) => cell.getBoundingClientRect().width,
          ),
          headerPaddings: headerCells.map((cell) => {
            const style = getComputedStyle(cell);
            return [style.paddingLeft, style.paddingRight];
          }),
          bodyPaddings: bodyCells.map((cell) => {
            const style = getComputedStyle(cell);
            return [style.paddingLeft, style.paddingRight];
          }),
        },
        header: {
          visualLabels: headerCells.map(
            (cell) => cell.textContent?.trim() ?? "",
          ),
          actionAccessibleLabel: actionHeader?.getAttribute("aria-label"),
          rowHeight: headerRow.getBoundingClientRect().height,
          cellHeights: headerCells.map(
            (cell) => cell.getBoundingClientRect().height,
          ),
          weights: headerCells.map((cell) => getComputedStyle(cell).fontWeight),
          colors: headerCells.map((cell) => getComputedStyle(cell).color),
          borderBottomWidths: headerCells.map(
            (cell) => getComputedStyle(cell).borderBottomWidth,
          ),
          borderBottomColors: headerCells.map(
            (cell) => getComputedStyle(cell).borderBottomColor,
          ),
          boxSizing: headerCells.map(
            (cell) => getComputedStyle(cell).boxSizing,
          ),
          backgroundColor: tableHeadStyle.backgroundColor,
        },
        bodyGeometry: {
          rowHeight: bodyRow.getBoundingClientRect().height,
          cellHeights: bodyCells.map(
            (cell) => cell.getBoundingClientRect().height,
          ),
          rowBorderColor: getComputedStyle(bodyRow).borderTopColor,
          cursor: getComputedStyle(bodyRow).cursor,
        },
        bodyTypography: bodyTextElements.map((element) => ({
          fontSize: getComputedStyle(element).fontSize,
          fontWeight: getComputedStyle(element).fontWeight,
          color: getComputedStyle(element).color,
          lineHeight: getComputedStyle(element).lineHeight,
        })),
        bodyValues: {
          date: dateCellText,
          time: timeCellText,
        },
        bodyIcons: bodyIcons.map((icon) => {
          const style = getComputedStyle(icon);
          return { color: style.color, opacity: style.opacity };
        }),
        truncation: truncationElements.map((element) => ({
          title: element.getAttribute("title"),
          overflow: getComputedStyle(element).overflow,
          textOverflow: getComputedStyle(element).textOverflow,
          whiteSpace: getComputedStyle(element).whiteSpace,
          isActuallyTruncated: element.scrollWidth > element.clientWidth,
        })),
        status: {
          text: status.textContent?.trim() ?? "",
          backgroundColor: statusStyle.backgroundColor,
          borderTopWidth: statusStyle.borderTopWidth,
          borderRadius: statusStyle.borderRadius,
        },
        actions: {
          visibleText: actionCell.textContent?.trim() ?? "",
          quickActionCount,
          actionButtonCount: actionCell.querySelectorAll("button").length,
          triggerWidth: menuTriggerRect.width,
          triggerHeight: menuTriggerRect.height,
          triggerMinWidth: menuTriggerStyle.minWidth,
          triggerMinHeight: menuTriggerStyle.minHeight,
          triggerBorderRadius: menuTriggerStyle.borderRadius,
          triggerFlexBasis: menuTriggerStyle.flexBasis,
          triggerPaddings: [
            menuTriggerStyle.paddingTop,
            menuTriggerStyle.paddingRight,
            menuTriggerStyle.paddingBottom,
            menuTriggerStyle.paddingLeft,
          ],
          triggerInsets: {
            top: Math.round(menuTriggerRect.top - bodyRowRect.top),
            right: Math.round(actionCellRect.right - menuTriggerRect.right),
            bottom: Math.round(bodyRowRect.bottom - menuTriggerRect.bottom),
            left: Math.round(menuTriggerRect.left - actionCellRect.left),
          },
          isDistinctFromActiveViewOption:
            menuTriggerRect.width !==
              activeViewButton.getBoundingClientRect().width &&
            menuTriggerRect.height !==
              activeViewButton.getBoundingClientRect().height &&
            menuTriggerStyle.borderRadius !==
              activeViewButtonStyle.borderRadius,
          menuTriggerOpacity: menuTriggerStyle.opacity,
          menuTriggerVisibility: menuTriggerStyle.visibility,
          menuTriggerExpanded: menuTrigger.getAttribute("aria-expanded"),
          menuTriggerIconClass: menuTriggerIcon.getAttribute("class") ?? "",
        },
      };
    });
    assert.deepEqual(scheduleTableContract.surface, {
      wrapperBackgroundColor: "rgb(255, 255, 255)",
      wrapperBackgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      tableBackgroundColor: "rgb(255, 255, 255)",
      firstBodyRowBorderTopWidth: "0px",
      wrapperBorderWidths: ["1px", "1px", "1px", "1px"],
      wrapperBorderRadius: "12px",
      wrapperBorderStyle: "solid",
      wrapperBorderColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
    });
    assert.equal(scheduleTableContract.layout.tableLayout, "auto");
    assert.equal(scheduleTableContract.layout.minWidth, "0px");
    assert.deepEqual(scheduleTableContract.layout.colClasses, [
      "teaching-run-table-col-date",
      "teaching-run-table-col-time",
      "teaching-run-table-col-lesson",
      "teaching-run-table-col-course",
      "teaching-run-table-col-participants",
      "teaching-run-table-col-status",
      "teaching-run-table-col-actions",
    ]);
    const compactColumnWidths = [0, 1, 4, 5, 6] as const;
    assert.ok(
      compactColumnWidths.every(
        (index) =>
          (scheduleTableContract.layout.columnWidths[index] ?? 0) <
            (scheduleTableContract.layout.columnWidths[2] ?? 0) &&
          (scheduleTableContract.layout.columnWidths[index] ?? 0) <
            (scheduleTableContract.layout.columnWidths[3] ?? 0),
      ),
    );
    assert.ok(
      scheduleTableContract.layout.columnWidths[2] >
        scheduleTableContract.layout.columnWidths[0],
    );
    assert.ok(
      scheduleTableContract.layout.columnWidths[3] >
        scheduleTableContract.layout.columnWidths[1],
    );
    assert.ok(
      scheduleTableContract.layout.headerPaddings.every(
        ([left, right]) => left === "12px" && right === "12px",
      ),
    );
    assert.ok(
      scheduleTableContract.layout.bodyPaddings
        .slice(0, -1)
        .every(([left, right]) => left === "12px" && right === "12px"),
    );
    assert.deepEqual(scheduleTableContract.layout.bodyPaddings.at(-1), [
      "4px",
      "4px",
    ]);
    assert.deepEqual(scheduleTableContract.header.visualLabels, [
      "Дата",
      "Время",
      "Урок",
      "Курс",
      "Ученики",
      "Статус",
      "",
    ]);
    assert.equal(
      scheduleTableContract.header.actionAccessibleLabel,
      "Действия",
    );
    assert.equal(scheduleTableContract.header.rowHeight, 40);
    assert.ok(
      scheduleTableContract.header.cellHeights.every((height) => height === 40),
    );
    assert.equal(scheduleTableContract.bodyGeometry.rowHeight, 40);
    assert.equal(scheduleTableContract.bodyGeometry.cursor, "pointer");
    assert.ok(
      scheduleTableContract.bodyGeometry.cellHeights.every(
        (height) => height === 40,
      ),
    );
    assert.ok(
      scheduleTableContract.header.weights.every((weight) => weight === "500"),
    );
    assert.ok(
      scheduleTableContract.header.borderBottomWidths.every(
        (width) => width === "1px",
      ),
    );
    assert.ok(
      scheduleTableContract.header.borderBottomColors.every(
        (color) => color === scheduleTableContract.bodyGeometry.rowBorderColor,
      ),
    );
    assert.equal(
      scheduleTableContract.bodyGeometry.rowBorderColor,
      "rgb(236, 236, 239)",
    );
    assert.ok(
      scheduleTableContract.header.boxSizing.every(
        (boxSizing) => boxSizing === "border-box",
      ),
    );
    assert.ok(
      scheduleTableContract.header.colors.every((color) => {
        const channels = color.match(/\d+/g)?.map(Number) ?? [];
        return (
          channels.length >= 3 &&
          channels.slice(0, 3).every((value) => value >= 130)
        );
      }),
    );
    assert.equal(
      scheduleTableContract.header.backgroundColor,
      "rgb(255, 255, 255)",
    );
    assert.ok(scheduleTableContract.bodyTypography.length >= 6);
    assert.ok(
      scheduleTableContract.bodyTypography.every(
        ({ fontSize, fontWeight, color, lineHeight }) =>
          Math.abs(Number.parseFloat(fontSize) - 14.08) < 0.02 &&
          fontWeight === "400" &&
          color === "rgb(20, 20, 20)" &&
          Math.abs(Number.parseFloat(lineHeight) - 18.304) < 0.02,
      ),
    );
    assert.deepEqual(scheduleTableContract.bodyValues, {
      date: "Среда · 12 авг",
      time: "12:00 · 60 мин",
    });
    assert.ok(scheduleTableContract.bodyIcons.length >= 3);
    assert.ok(
      scheduleTableContract.bodyIcons.every(
        ({ color, opacity }) => color === "rgb(20, 20, 20)" && opacity === "1",
      ),
    );
    assert.equal(scheduleTableContract.truncation.length, 8);
    assert.ok(
      scheduleTableContract.truncation.every(
        ({ title, overflow, textOverflow, whiteSpace }) =>
          Boolean(title) &&
          overflow === "hidden" &&
          textOverflow === "ellipsis" &&
          whiteSpace === "nowrap",
      ),
    );
    assert.ok(
      scheduleTableContract.truncation
        .slice(-2)
        .every(({ isActuallyTruncated }) => isActuallyTruncated),
    );
    assert.deepEqual(scheduleTableContract.status, {
      text: "Ожидается",
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderTopWidth: "0px",
      borderRadius: "0px",
    });
    assert.doesNotMatch(
      scheduleTableContract.status.text,
      /завтра|\d{1,2}:\d{2}/i,
    );
    assert.deepEqual(scheduleTableContract.actions, {
      visibleText: "",
      quickActionCount: 0,
      actionButtonCount: 1,
      triggerWidth: 32,
      triggerHeight: 32,
      triggerMinWidth: "32px",
      triggerMinHeight: "32px",
      triggerBorderRadius: "8px",
      triggerFlexBasis: "32px",
      triggerPaddings: ["0px", "0px", "0px", "0px"],
      triggerInsets: { top: 4, right: 4, bottom: 4, left: 4 },
      isDistinctFromActiveViewOption: true,
      menuTriggerOpacity: "1",
      menuTriggerVisibility: "visible",
      menuTriggerExpanded: "false",
      menuTriggerIconClass: scheduleTableContract.actions.menuTriggerIconClass,
    });
    assert.match(
      scheduleTableContract.actions.menuTriggerIconClass,
      /lucide-ellipsis-vertical/,
    );

    const scheduleRow = runtime.page.locator(
      ".teaching-run-table-row:first-child",
    );
    await scheduleRow.hover();
    assert.equal(
      await runtime.page
        .locator(
          ".teaching-run-table-row .teaching-run-table-quick-actions, " +
            ".teaching-run-table-row .teaching-run-table-quick-action",
        )
        .count(),
      0,
    );

    const rowMenuTrigger = runtime.page.locator(
      ".teaching-run-table-row:first-child .teaching-run-action-menu .action-menu-trigger",
    );
    assert.deepEqual(
      await rowMenuTrigger.evaluate((button) => {
        const style = getComputedStyle(button);
        return {
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      {
        backgroundColor: "rgba(0, 0, 0, 0)",
        boxShadow: "none",
        transform: "none",
      },
    );
    await rowMenuTrigger.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await rowMenuTrigger.evaluate((button) => {
        const style = getComputedStyle(button);
        return {
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      {
        backgroundColor: "rgba(20, 20, 20, 0.07)",
        boxShadow: "none",
        transform: "none",
      },
    );
    await runtime.page.mouse.down();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await rowMenuTrigger.evaluate((button) => {
        const style = getComputedStyle(button);
        return {
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      { boxShadow: "none", transform: "none" },
    );
    await runtime.page.mouse.move(0, 0);
    await runtime.page.mouse.up();
    await rowMenuTrigger.click();
    const rowActionMenu = runtime.page.getByRole("menu");
    await rowActionMenu.waitFor();
    await assertCanonicalProductDropdownSurface(
      rowActionMenu,
      "Schedule row action menu",
    );
    const startRunMenuItem = rowActionMenu.getByRole("menuitem", {
      name: "Начать урок",
      exact: true,
    });
    const editRunMenuItem = rowActionMenu.getByRole("menuitem", {
      name: "Изменить",
      exact: true,
    });
    const cancelRunMenuItem = rowActionMenu.getByRole("menuitem", {
      name: "Отменить",
      exact: true,
    });
    await startRunMenuItem.waitFor();
    await editRunMenuItem.waitFor();
    await cancelRunMenuItem.waitFor();
    assert.equal(
      await rowActionMenu
        .locator('[role="separator"], .action-menu-separator')
        .count(),
      0,
    );
    await editRunMenuItem.hover();
    assert.deepEqual(
      await runtime.page.evaluate(() => {
        const menu = document.querySelector<HTMLElement>(
          ".action-menu-panel-portal",
        );
        if (!menu) throw new Error("Portal action menu is missing");
        const rect = menu.getBoundingClientRect();
        const menuStyle = getComputedStyle(menu);
        const items = Array.from(
          menu.querySelectorAll<HTMLElement>(".action-menu-item"),
        );
        const icons = Array.from(
          menu.querySelectorAll<SVGElement>(".action-menu-item-icon"),
        );
        const activeViewOption = document.querySelector<HTMLElement>(
          '.teaching-schedule-view-toggle button[aria-pressed="true"]',
        );
        if (!activeViewOption) {
          throw new Error("Active Schedule view option is missing");
        }
        return {
          fullyInsideViewport:
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.right <= window.innerWidth &&
            rect.bottom <= window.innerHeight,
          position: menuStyle.position,
          borderRadius: menuStyle.borderRadius,
          backgroundColor: menuStyle.backgroundColor,
          borderWidths: [
            menuStyle.borderTopWidth,
            menuStyle.borderRightWidth,
            menuStyle.borderBottomWidth,
            menuStyle.borderLeftWidth,
          ],
          boxShadow: menuStyle.boxShadow,
          activeViewOptionBorderRadius:
            getComputedStyle(activeViewOption).borderRadius,
          items: items.map((item) => {
            const style = getComputedStyle(item);
            return {
              height: item.getBoundingClientRect().height,
              alignItems: style.alignItems,
              gap: style.gap,
              paddingLeft: style.paddingLeft,
              paddingRight: style.paddingRight,
              borderRadius: style.borderRadius,
              color: style.color,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
            };
          }),
          icons: icons.map((icon) => {
            const style = getComputedStyle(icon);
            return {
              color: style.color,
              opacity: style.opacity,
              marginTop: style.marginTop,
            };
          }),
        };
      }),
      {
        fullyInsideViewport: true,
        position: "fixed",
        borderRadius: "12px",
        backgroundColor: "rgb(255, 255, 255)",
        borderWidths: ["0px", "0px", "0px", "0px"],
        boxShadow: E2E_DROPDOWN_SHADOW,
        activeViewOptionBorderRadius: "11px",
        items: [
          {
            height: 40,
            alignItems: "center",
            gap: "12px",
            paddingLeft: "12px",
            paddingRight: "12px",
            borderRadius: "8px",
            color: "rgb(20, 20, 20)",
            fontSize: "14.08px",
            fontWeight: "400",
          },
          {
            height: 40,
            alignItems: "center",
            gap: "12px",
            paddingLeft: "12px",
            paddingRight: "12px",
            borderRadius: "8px",
            color: "rgb(20, 20, 20)",
            fontSize: "14.08px",
            fontWeight: "400",
          },
          {
            height: 40,
            alignItems: "center",
            gap: "12px",
            paddingLeft: "12px",
            paddingRight: "12px",
            borderRadius: "8px",
            color: "rgb(190, 18, 60)",
            fontSize: "14.08px",
            fontWeight: "400",
          },
        ],
        icons: [
          { color: "rgb(20, 20, 20)", opacity: "1", marginTop: "0px" },
          { color: "rgb(20, 20, 20)", opacity: "1", marginTop: "0px" },
          { color: "rgb(190, 18, 60)", opacity: "1", marginTop: "0px" },
        ],
      },
    );
    await startRunMenuItem.press("ArrowDown");
    assert.equal(
      await runtime.page.evaluate(
        () => document.activeElement?.textContent?.trim() ?? "",
      ),
      "Изменить",
    );
    await editRunMenuItem.press("ArrowDown");
    assert.equal(
      await runtime.page.evaluate(
        () => document.activeElement?.textContent?.trim() ?? "",
      ),
      "Отменить",
    );
    await cancelRunMenuItem.press("Escape");
    await rowActionMenu.waitFor({ state: "detached" });
    await runtime.page
      .locator(".teaching-run-action-menu .action-menu-trigger:focus")
      .waitFor();
    assert.equal(await rowMenuTrigger.getAttribute("aria-expanded"), "false");
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.classList.contains("action-menu-trigger"),
      ),
      true,
    );

    const desktopProfileLink = runtime.page.getByRole("link", {
      name: "Открыть профиль",
      exact: true,
    });
    await desktopProfileLink.waitFor();
    assert.equal(await desktopProfileLink.getAttribute("href"), "/profile");
    assert.equal(await desktopProfileLink.getAttribute("aria-haspopup"), null);
    assert.equal(
      await runtime.page
        .getByRole("button", {
          name: "Открыть меню аккаунта",
          exact: true,
        })
        .count(),
      0,
    );
    assert.equal(
      await runtime.page
        .getByRole("menu", { name: "Меню аккаунта", exact: true })
        .count(),
      0,
    );

    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Вид занятий",
      optionName: "Показать карточками",
      label: "Schedule desktop table-to-cards",
    });
    await runtime.page.locator(".teaching-run-card:first-child").waitFor();
    assert.deepEqual(
      await runtime.page.evaluate(() => {
        const actions = document.querySelector<HTMLElement>(
          ".teaching-run-card .teaching-run-actions",
        );
        const primary = actions?.querySelector<HTMLElement>(
          ".product-btn-primary",
        );
        const secondary = actions?.querySelector<HTMLElement>(
          ".product-btn-secondary",
        );
        if (!primary || !secondary) {
          throw new Error("Schedule card button contract is missing");
        }
        const readButton = (button: HTMLElement) => {
          const style = getComputedStyle(button);
          return {
            backgroundColor: style.backgroundColor,
            borderTopWidth: style.borderTopWidth,
            borderTopColor: style.borderTopColor,
            backgroundClip: style.backgroundClip,
            color: style.color,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            boxShadow: style.boxShadow,
            transform: style.transform,
          };
        };
        return {
          primary: readButton(primary),
          secondary: readButton(secondary),
        };
      }),
      {
        primary: {
          backgroundColor: "rgb(255, 255, 255)",
          borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
          borderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
          backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
          color: "rgb(20, 20, 20)",
          fontSize: "14.08px",
          fontWeight: "400",
          boxShadow: E2E_RAISED_CONTROL_SHADOW,
          transform: "none",
        },
        secondary: {
          backgroundColor: "rgb(255, 255, 255)",
          borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
          borderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
          backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
          color: "rgb(20, 20, 20)",
          fontSize: "14.08px",
          fontWeight: "400",
          boxShadow: E2E_RAISED_CONTROL_SHADOW,
          transform: "none",
        },
      },
    );
    assert.equal(await runtime.page.locator(".teaching-run-card").count(), 2);
    assert.equal(await scheduleTable.count(), 0);

    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Вид занятий",
      optionName: "Показать таблицей",
      label: "Schedule desktop cards-to-table",
    });
    await runtime.page
      .getByRole("table", {
        name: "Занятия за выбранную неделю",
        exact: true,
      })
      .waitFor();
    e2eScheduleFixtureVisible = false;
    e2eScheduleFixtureRunCount = 1;

    async function readPrimaryNavActivePill() {
      await runtime.page
        .locator(
          '.site-header-nav-active-pill[data-ready="true"][data-motion-ready="true"]',
        )
        .waitFor();
      await runtime.page.evaluate(async () => {
        await new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => resolve()),
        );
        const activePill = document.querySelector<HTMLElement>(
          ".site-header-nav-active-pill",
        );
        await Promise.all(
          (activePill?.getAnimations() ?? []).map((animation) =>
            animation.finished.catch(() => undefined),
          ),
        );
      });
      return runtime.page.evaluate(() => {
        const track = document.querySelector<HTMLElement>(
          ".site-header-nav-track",
        );
        const activePill = track?.querySelector<HTMLElement>(
          ".site-header-nav-active-pill",
        );
        const activeLink = track?.querySelector<HTMLAnchorElement>(
          '.site-header-nav-pill[aria-current="page"]',
        );
        if (!track || !activePill || !activeLink) {
          throw new Error("Primary navigation active-pill contract is missing");
        }
        const activePillRect = activePill.getBoundingClientRect();
        const activeLinkRect = activeLink.getBoundingClientRect();
        const style = getComputedStyle(activePill);
        return {
          activeHref: activeLink.getAttribute("href"),
          activeLabel: activeLink.textContent?.trim() ?? "",
          trackReady: track.dataset.activePillReady,
          ready: activePill.dataset.ready,
          motionReady: activePill.dataset.motionReady,
          opacity: style.opacity,
          left: activePillRect.left,
          width: activePillRect.width,
          leftDelta: Math.abs(activePillRect.left - activeLinkRect.left),
          topDelta: Math.abs(activePillRect.top - activeLinkRect.top),
          widthDelta: Math.abs(activePillRect.width - activeLinkRect.width),
          heightDelta: Math.abs(activePillRect.height - activeLinkRect.height),
          transitionProperty: style.transitionProperty,
          transitionDuration: style.transitionDuration,
          transitionTimingFunction: style.transitionTimingFunction,
        };
      });
    }

    const scheduleNavActivePill = await readPrimaryNavActivePill();
    assert.deepEqual(
      {
        activeHref: scheduleNavActivePill.activeHref,
        activeLabel: scheduleNavActivePill.activeLabel,
        trackReady: scheduleNavActivePill.trackReady,
        ready: scheduleNavActivePill.ready,
        motionReady: scheduleNavActivePill.motionReady,
        opacity: scheduleNavActivePill.opacity,
        transitionProperty: scheduleNavActivePill.transitionProperty,
        transitionDuration: scheduleNavActivePill.transitionDuration,
        transitionTimingFunction:
          scheduleNavActivePill.transitionTimingFunction,
      },
      {
        activeHref: "/schedule",
        activeLabel: "Расписание",
        trackReady: "true",
        ready: "true",
        motionReady: "true",
        opacity: "1",
        transitionProperty: "width, transform",
        transitionDuration: "0.18s, 0.18s",
        transitionTimingFunction:
          "cubic-bezier(0.22, 1, 0.36, 1), cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
    assert.ok(scheduleNavActivePill.leftDelta < 0.5);
    assert.ok(scheduleNavActivePill.topDelta < 0.5);
    assert.ok(scheduleNavActivePill.widthDelta < 0.5);
    assert.ok(scheduleNavActivePill.heightDelta < 0.5);

    const studentsContentObserved = new Promise<void>((resolve) => {
      e2eStudentDirectoryRpcObserved = resolve;
    });
    e2eStudentDirectoryRpcGate = new Promise<void>((resolve) => {
      releaseDelayedStudentsContent = resolve;
    });
    const studentsLink = runtime.page.getByRole("link", {
      name: "Ученики",
      exact: true,
    });
    const primaryForwardPageTransition = runtime.page.locator(
      'html[data-page-transition-direction="forward"]',
    );
    await primaryForwardPageTransition.waitFor({ state: "detached" });
    await Promise.all([
      runtime.page.waitForURL(/\/students$/),
      primaryForwardPageTransition.waitFor(),
      studentsLink.click(),
    ]);
    let studentsContentTimeout: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        studentsContentObserved,
        new Promise<void>((_, reject) => {
          studentsContentTimeout = setTimeout(
            () =>
              reject(
                new Error(
                  "Students navigation did not reach the gated directory content request",
                ),
              ),
            5_000,
          );
        }),
      ]);
    } finally {
      if (studentsContentTimeout) clearTimeout(studentsContentTimeout);
    }

    const readyStudentsHeader = runtime.page.locator(
      ".app-page-header:not([data-page-header-pending])",
    );
    await readyStudentsHeader.waitFor({ state: "visible" });
    await runtime.page
      .getByText("Загружаем учеников и группы…", { exact: true })
      .waitFor();
    await primaryForwardPageTransition.waitFor({ state: "detached" });
    await runtime.page.evaluate(async () => {
      const header = document.querySelector<HTMLElement>(".app-page-header");
      await Promise.all(
        (header?.getAnimations({ subtree: true }) ?? []).map((animation) =>
          animation.finished.catch(() => undefined),
        ),
      );
    });
    const cachedStudentsHeaderFrame = await readyStudentsHeader.evaluate(
      (element) => {
        const header = element as HTMLElement;
        const content = header.querySelector<HTMLElement>(
          ".app-page-header-content",
        );
        const metric = header.querySelector<HTMLElement>(".app-page-metric");
        const actions = header.querySelector<HTMLElement>(".app-page-actions");
        const title = header.querySelector<HTMLElement>(".app-page-title");
        if (!content || !metric || !actions || !title) {
          throw new Error("Cached Students header contract is missing");
        }
        const rect = header.getBoundingClientRect();
        const tabLabels = Array.from(
          document.querySelectorAll<HTMLElement>(
            "#students-directory-tablist [role=tab] .workspace-tab-label",
          ),
        ).map((label) => label.textContent?.trim().replace(/\s+/g, " ") ?? "");
        return {
          pending: header.hasAttribute("data-page-header-pending"),
          ariaBusy: header.getAttribute("aria-busy"),
          title: title.textContent?.trim() ?? "",
          action: actions.textContent?.trim().replace(/\s+/g, " ") ?? "",
          metric: metric.textContent?.trim() ?? "",
          metricPlaceholder: metric.hasAttribute(
            "data-page-header-metric-placeholder",
          ),
          metricAriaHidden: metric.getAttribute("aria-hidden"),
          contentOpacity: getComputedStyle(content).opacity,
          actionsOpacity: getComputedStyle(actions).opacity,
          contentVisibility: getComputedStyle(content).visibility,
          actionsVisibility: getComputedStyle(actions).visibility,
          tabLabels,
          staticTabLabels: tabLabels.map((label) =>
            label.replace(/\s+\d+$/u, ""),
          ),
          loadingContentPresent:
            document.body.textContent?.includes(
              "Загружаем учеников и группы…",
            ) ?? false,
          tablePresent: Boolean(
            document.querySelector(
              '[aria-label="Ученики, их статусы и группы"]',
            ),
          ),
          top: rect.top,
          height: rect.height,
        };
      },
    );
    assert.deepEqual(
      {
        pending: cachedStudentsHeaderFrame.pending,
        ariaBusy: cachedStudentsHeaderFrame.ariaBusy,
        title: cachedStudentsHeaderFrame.title,
        action: cachedStudentsHeaderFrame.action,
        metric: cachedStudentsHeaderFrame.metric,
        metricPlaceholder: cachedStudentsHeaderFrame.metricPlaceholder,
        metricAriaHidden: cachedStudentsHeaderFrame.metricAriaHidden,
        contentOpacity: cachedStudentsHeaderFrame.contentOpacity,
        actionsOpacity: cachedStudentsHeaderFrame.actionsOpacity,
        contentVisibility: cachedStudentsHeaderFrame.contentVisibility,
        actionsVisibility: cachedStudentsHeaderFrame.actionsVisibility,
        staticTabLabels: cachedStudentsHeaderFrame.staticTabLabels,
        studentsTabLabel: cachedStudentsHeaderFrame.tabLabels[0],
        loadingContentPresent: cachedStudentsHeaderFrame.loadingContentPresent,
        tablePresent: cachedStudentsHeaderFrame.tablePresent,
      },
      {
        pending: false,
        ariaBusy: null,
        title: "Ученики",
        action: "Новый ученик",
        metric: "Активных: 4 · в архиве: 0 · ожидают: 1",
        metricPlaceholder: false,
        metricAriaHidden: null,
        contentOpacity: "1",
        actionsOpacity: "1",
        contentVisibility: "visible",
        actionsVisibility: "visible",
        staticTabLabels: ["Ученики", "Группы", "Наблюдение"],
        studentsTabLabel: "Ученики 5",
        loadingContentPresent: true,
        tablePresent: false,
      },
    );
    assert.ok(cachedStudentsHeaderFrame.height > 0);
    assert.ok(cachedStudentsHeaderFrame.height < 200);

    const pendingMembershipControl = runtime.page.getByRole("group", {
      name: "Принадлежность к группе",
      exact: true,
    });
    await pendingMembershipControl.waitFor({ state: "attached" });
    const disabledMembershipIndicator = await pendingMembershipControl.evaluate(
      (element) => {
        const group = element as HTMLElement;
        const indicator = group.querySelector<HTMLElement>(
          ".product-segmented-control-indicator",
        );
        const selected = group.querySelector<HTMLButtonElement>(
          'button[aria-pressed="true"]',
        );
        if (!indicator || !selected) {
          throw new Error("Pending Students segmented control is missing");
        }
        const read = (): SegmentedEnableFrame => {
          const indicatorStyle = getComputedStyle(indicator);
          const selectedStyle = getComputedStyle(selected);
          const indicatorRect = indicator.getBoundingClientRect();
          const selectedRect = selected.getBoundingClientRect();
          return {
            groupReady: group.getAttribute("data-indicator-ready"),
            indicatorReady: indicator.getAttribute("data-ready"),
            motionReady: indicator.getAttribute("data-motion-ready"),
            selectedDisabled: selected.disabled,
            selectedBackground: selectedStyle.backgroundColor,
            selectedShadow: selectedStyle.boxShadow,
            indicatorBackground: indicatorStyle.backgroundColor,
            indicatorOpacity: indicatorStyle.opacity,
            transitionProperty: indicatorStyle.transitionProperty,
            transitionDuration: indicatorStyle.transitionDuration,
            maxAlignmentDelta: Math.max(
              Math.abs(indicatorRect.left - selectedRect.left),
              Math.abs(indicatorRect.top - selectedRect.top),
              Math.abs(indicatorRect.width - selectedRect.width),
              Math.abs(indicatorRect.height - selectedRect.height),
            ),
          };
        };
        const frames: ReturnType<typeof read>[] = [];
        const observer = new MutationObserver(() => frames.push(read()));
        observer.observe(group, {
          attributes: true,
          subtree: true,
          attributeFilter: [
            "data-indicator-ready",
            "data-ready",
            "data-motion-ready",
            "disabled",
          ],
        });
        (
          window as typeof window & {
            __e2eStudentsSegmentedEnable?: SegmentedEnableProbe;
          }
        ).__e2eStudentsSegmentedEnable = { frames, observer };
        return read();
      },
    );
    assert.deepEqual(
      {
        groupReady: disabledMembershipIndicator.groupReady,
        indicatorReady: disabledMembershipIndicator.indicatorReady,
        motionReady: disabledMembershipIndicator.motionReady,
        selectedDisabled: disabledMembershipIndicator.selectedDisabled,
        selectedBackground: disabledMembershipIndicator.selectedBackground,
        indicatorOpacity: disabledMembershipIndicator.indicatorOpacity,
        transitionProperty: disabledMembershipIndicator.transitionProperty,
      },
      {
        groupReady: null,
        indicatorReady: null,
        motionReady: null,
        selectedDisabled: true,
        selectedBackground: "rgb(255, 255, 255)",
        indicatorOpacity: "0",
        transitionProperty: "none",
      },
      "Disabled selected option keeps the fallback surface while its indicator is unarmed",
    );
    assertSegmentedSurfaceShadow(
      disabledMembershipIndicator.selectedShadow,
      E2E_RAISED_CONTROL_SHADOW,
      "Disabled Students selected fallback shadow",
    );

    releaseStudentsContent();
    e2eStudentDirectoryRpcGate = null;
    e2eStudentDirectoryRpcObserved = null;
    await runtime.page
      .getByRole("heading", { name: "Ученики", exact: true, level: 1 })
      .waitFor();
    await runtime.page
      .getByRole("table", {
        name: "Ученики, их статусы и группы",
        exact: true,
      })
      .waitFor();
    await runtime.page.waitForFunction(() => {
      const frames = (
        window as typeof window & {
          __e2eStudentsSegmentedEnable?: SegmentedEnableProbe;
        }
      ).__e2eStudentsSegmentedEnable?.frames;
      return Boolean(
        frames?.some(
          (frame) => frame.groupReady === "true" && frame.motionReady === null,
        ) && frames.some((frame) => frame.motionReady === "true"),
      );
    });
    const enabledMembershipIndicator = await runtime.page.evaluate(() => {
      const state = (
        window as typeof window & {
          __e2eStudentsSegmentedEnable?: SegmentedEnableProbe;
        }
      ).__e2eStudentsSegmentedEnable;
      if (!state) throw new Error("Students enable frames are missing");
      state.observer.disconnect();
      const instant = state.frames.find(
        (frame) => frame.groupReady === "true" && frame.motionReady === null,
      );
      const armed = state.frames.find((frame) => frame.motionReady === "true");
      delete (
        window as typeof window & {
          __e2eStudentsSegmentedEnable?: unknown;
        }
      ).__e2eStudentsSegmentedEnable;
      return { instant, armed };
    });
    assert.deepEqual(
      enabledMembershipIndicator.instant && {
        groupReady: enabledMembershipIndicator.instant.groupReady,
        indicatorReady: enabledMembershipIndicator.instant.indicatorReady,
        motionReady: enabledMembershipIndicator.instant.motionReady,
        selectedDisabled: enabledMembershipIndicator.instant.selectedDisabled,
        selectedBackground:
          enabledMembershipIndicator.instant.selectedBackground,
        selectedShadow: enabledMembershipIndicator.instant.selectedShadow,
        indicatorBackground:
          enabledMembershipIndicator.instant.indicatorBackground,
        indicatorOpacity: enabledMembershipIndicator.instant.indicatorOpacity,
        transitionProperty:
          enabledMembershipIndicator.instant.transitionProperty,
      },
      {
        groupReady: "true",
        indicatorReady: "true",
        motionReady: null,
        selectedDisabled: false,
        selectedBackground: "rgba(0, 0, 0, 0)",
        selectedShadow: "none",
        indicatorBackground: "rgb(255, 255, 255)",
        indicatorOpacity: "1",
        transitionProperty: "none",
      },
      "Disabled-to-enabled indicator paints immediately before motion arms",
    );
    assert.equal(
      enabledMembershipIndicator.armed?.motionReady,
      "true",
      "Students indicator arms motion on the next animation frame",
    );
    assert.equal(
      enabledMembershipIndicator.armed?.transitionProperty,
      "width, transform, opacity",
    );
    assert.equal(
      enabledMembershipIndicator.armed?.transitionDuration,
      "0.36s, 0.36s, 0.12s",
    );
    assert.ok(
      enabledMembershipIndicator.instant &&
        enabledMembershipIndicator.instant.maxAlignmentDelta < 0.5,
      "Newly enabled indicator must be aligned before motion arms",
    );
    await runtime.page.evaluate(async () => {
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
      const header = document.querySelector<HTMLElement>(".app-page-header");
      await Promise.all(
        (header?.getAnimations({ subtree: true }) ?? []).map((animation) =>
          animation.finished.catch(() => undefined),
        ),
      );
    });
    const resolvedStudentsHeaderFrame = await runtime.page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".app-page-header");
      const content = header?.querySelector<HTMLElement>(
        ".app-page-header-content",
      );
      const title = header?.querySelector<HTMLElement>(".app-page-title");
      const metric = header?.querySelector<HTMLElement>(".app-page-metric");
      const actions = header?.querySelector<HTMLElement>(".app-page-actions");
      if (!header || !content || !title || !metric || !actions) {
        throw new Error("Resolved Students header contract is missing");
      }
      const rect = header.getBoundingClientRect();
      return {
        pending: header.hasAttribute("data-page-header-pending"),
        ariaBusy: header.getAttribute("aria-busy"),
        title: title.textContent?.trim() ?? "",
        metric: metric.textContent?.trim() ?? "",
        action: actions.textContent?.trim().replace(/\s+/g, " ") ?? "",
        metricPlaceholder: metric.hasAttribute(
          "data-page-header-metric-placeholder",
        ),
        metricAriaHidden: metric.getAttribute("aria-hidden"),
        contentOpacity: getComputedStyle(content).opacity,
        actionsOpacity: getComputedStyle(actions).opacity,
        contentVisibility: getComputedStyle(content).visibility,
        actionsVisibility: getComputedStyle(actions).visibility,
        top: rect.top,
        height: rect.height,
      };
    });
    assert.deepEqual(
      {
        pending: resolvedStudentsHeaderFrame.pending,
        ariaBusy: resolvedStudentsHeaderFrame.ariaBusy,
        title: resolvedStudentsHeaderFrame.title,
        action: resolvedStudentsHeaderFrame.action,
        metricPlaceholder: resolvedStudentsHeaderFrame.metricPlaceholder,
        metricAriaHidden: resolvedStudentsHeaderFrame.metricAriaHidden,
        contentOpacity: resolvedStudentsHeaderFrame.contentOpacity,
        actionsOpacity: resolvedStudentsHeaderFrame.actionsOpacity,
        contentVisibility: resolvedStudentsHeaderFrame.contentVisibility,
        actionsVisibility: resolvedStudentsHeaderFrame.actionsVisibility,
      },
      {
        pending: false,
        ariaBusy: null,
        title: "Ученики",
        action: "Новый ученик",
        metricPlaceholder: false,
        metricAriaHidden: null,
        contentOpacity: "1",
        actionsOpacity: "1",
        contentVisibility: "visible",
        actionsVisibility: "visible",
      },
    );
    assert.equal(
      resolvedStudentsHeaderFrame.metric,
      "Активных: 3 · в архиве: 1 · ожидают: 1",
    );
    assert.ok(
      Math.abs(
        resolvedStudentsHeaderFrame.top - cachedStudentsHeaderFrame.top,
      ) < 0.5,
    );
    assert.ok(
      Math.abs(
        resolvedStudentsHeaderFrame.height - cachedStudentsHeaderFrame.height,
      ) < 0.5,
    );
    assert.ok(
      (
        await runtime.page.evaluate(
          () =>
            (
              window as typeof window & {
                __e2ePageTransitionDirections?: string[];
              }
            ).__e2ePageTransitionDirections ?? [],
        )
      ).includes("forward"),
      "Schedule → Students must use the forward header transition",
    );
    await runtime.page
      .locator('.workspace-tabs-indicator[data-motion-ready="true"]')
      .waitFor();
    await runtime.page.evaluate(async () => {
      const indicator = document.querySelector<HTMLElement>(
        ".workspace-tabs-indicator",
      );
      await Promise.all(
        (indicator?.getAnimations() ?? []).map((animation) =>
          animation.finished.catch(() => undefined),
        ),
      );
    });
    const studentsNavActivePill = await readPrimaryNavActivePill();
    assert.deepEqual(
      {
        activeHref: studentsNavActivePill.activeHref,
        activeLabel: studentsNavActivePill.activeLabel,
        trackReady: studentsNavActivePill.trackReady,
        ready: studentsNavActivePill.ready,
        motionReady: studentsNavActivePill.motionReady,
        opacity: studentsNavActivePill.opacity,
        transitionProperty: studentsNavActivePill.transitionProperty,
        transitionDuration: studentsNavActivePill.transitionDuration,
        transitionTimingFunction:
          studentsNavActivePill.transitionTimingFunction,
      },
      {
        activeHref: "/students",
        activeLabel: "Ученики",
        trackReady: "true",
        ready: "true",
        motionReady: "true",
        opacity: "1",
        transitionProperty: "width, transform",
        transitionDuration: "0.18s, 0.18s",
        transitionTimingFunction:
          "cubic-bezier(0.22, 1, 0.36, 1), cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
    assert.ok(studentsNavActivePill.leftDelta < 0.5);
    assert.ok(studentsNavActivePill.topDelta < 0.5);
    assert.ok(studentsNavActivePill.widthDelta < 0.5);
    assert.ok(studentsNavActivePill.heightDelta < 0.5);
    assert.ok(studentsNavActivePill.left > scheduleNavActivePill.left);
    assert.ok(
      Math.abs(studentsNavActivePill.width - scheduleNavActivePill.width) > 0.5,
    );

    html = await runtime.page.content();
    assert.match(html, /Анна Петрова/);
    assert.match(html, /Борис Волков/);
    assert.match(html, /Teen Talk/);
    assert.match(html, /Новый ученик/);
    assert.doesNotMatch(html, /Новая группа/);
    assert.doesNotMatch(html, /Миша Орлов|Food around the world|11 занятий/);

    const studentsVisual = await runtime.page.evaluate(() => {
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
      const titleRow = pageHeading?.querySelector<HTMLElement>(
        ".app-page-title-row",
      );
      const title = document.querySelector<HTMLElement>(".app-page-title");
      const description = document.querySelector<HTMLElement>(
        ".app-page-description",
      );
      const activeTab = document.querySelector<HTMLElement>(
        ".workspace-tab-active",
      );
      const inactiveTab = document.querySelector<HTMLElement>(
        ".workspace-tab:not(.workspace-tab-active)",
      );
      const inactiveTabIcon = inactiveTab?.querySelector<HTMLElement>(
        ".workspace-tab-icon",
      );
      const activeTabLabel = activeTab?.querySelector<HTMLElement>(
        "span:not(.workspace-tab-count)",
      );
      const activeTabCount = activeTab?.querySelector<HTMLElement>(
        ".workspace-tab-count",
      );
      const tabs = document.querySelector<HTMLElement>(".workspace-tabs");
      const indicator = tabs?.querySelector<HTMLElement>(
        ".workspace-tabs-indicator",
      );
      const tabsScroll = document.querySelector<HTMLElement>(
        ".workspace-tabs-scroll",
      );
      const headerActions =
        document.querySelector<HTMLElement>(".app-page-actions");
      const headerAction =
        headerActions?.querySelector<HTMLElement>(".product-btn");
      const toolbar = document.querySelector<HTMLElement>(
        ".student-directory-toolbar",
      );
      const toolbarSearch = toolbar?.querySelector<HTMLElement>(
        ".student-directory-search",
      );
      const toolbarSearchInput =
        toolbarSearch?.querySelector<HTMLInputElement>("input");
      const toolbarSearchIcon = toolbarSearch?.querySelector<SVGElement>(
        "svg[aria-hidden='true']",
      );
      const toolbarControls = toolbar?.querySelector<HTMLElement>(
        ".student-directory-controls",
      );
      const membershipSwitch = toolbar?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Принадлежность к группе"]',
      );
      const activeMembershipButton =
        membershipSwitch?.querySelector<HTMLElement>(
          'button[aria-pressed="true"]',
        );
      const viewSwitch = toolbar?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Вид списка учеников"]',
      );
      const activeViewButton = viewSwitch?.querySelector<HTMLElement>(
        'button[aria-pressed="true"]',
      );
      const tableWrapper = document.querySelector<HTMLElement>(
        ".student-directory-table-wrap",
      );

      if (
        !pageHeader ||
        !pageHeading ||
        !titleRow ||
        !title ||
        !description ||
        !activeTab ||
        !inactiveTab ||
        !inactiveTabIcon ||
        !activeTabLabel ||
        !activeTabCount ||
        !tabs ||
        !indicator ||
        !tabsScroll ||
        !headerActions ||
        !headerAction ||
        !toolbar ||
        !toolbarSearch ||
        !toolbarSearchInput ||
        !toolbarSearchIcon ||
        !toolbarControls ||
        !membershipSwitch ||
        !activeMembershipButton ||
        !viewSwitch ||
        !activeViewButton ||
        !tableWrapper
      ) {
        throw new Error("Students visual contract is missing");
      }

      const pageHeaderStyle = getComputedStyle(pageHeader);
      const pageHeadingStyle = getComputedStyle(pageHeading);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const tabsStyle = getComputedStyle(tabs);
      const tabStyle = getComputedStyle(activeTab);
      const inactiveTabStyle = getComputedStyle(inactiveTab);
      const inactiveTabIconStyle = getComputedStyle(inactiveTabIcon);
      const tabLabelStyle = getComputedStyle(activeTabLabel);
      const tabCountStyle = getComputedStyle(activeTabCount);
      const markerStyle = getComputedStyle(activeTab, "::after");
      const indicatorStyle = getComputedStyle(indicator);
      const baselineStyle = getComputedStyle(tabs, "::before");
      const baselineScaleY = new DOMMatrixReadOnly(baselineStyle.transform).m22;
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const titleRowRect = titleRow.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();
      const tabsScrollRect = tabsScroll.getBoundingClientRect();
      const tabsRect = tabs.getBoundingClientRect();
      const activeTabRect = activeTab.getBoundingClientRect();
      const indicatorRect = indicator.getBoundingClientRect();
      const baselineLeft = Number.parseFloat(baselineStyle.left);
      const baselineRight = Number.parseFloat(baselineStyle.right);
      const toolbarStyle = getComputedStyle(toolbar);
      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarSearchRect = toolbarSearch.getBoundingClientRect();
      const toolbarControlsRect = toolbarControls.getBoundingClientRect();
      const toolbarSearchStyle = getComputedStyle(toolbarSearch);
      const toolbarSearchInputStyle = getComputedStyle(toolbarSearchInput);
      const toolbarSearchPlaceholderStyle = getComputedStyle(
        toolbarSearchInput,
        "::placeholder",
      );
      const toolbarSearchIconStyle = getComputedStyle(toolbarSearchIcon);
      const membershipSwitchStyle = getComputedStyle(membershipSwitch);
      const activeMembershipButtonStyle = getComputedStyle(
        activeMembershipButton,
      );
      const readControlTypography = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return {
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
        };
      };
      const tableWrapperStyle = getComputedStyle(tableWrapper);

      return {
        headerLayout: {
          minHeight: pageHeaderStyle.minHeight,
          height: pageHeaderRect.height,
          actionsShareTitleRow:
            title.parentElement === titleRow &&
            headerActions.parentElement === titleRow &&
            headerActionsRect.top < titleRect.bottom &&
            headerActionsRect.bottom > titleRect.top,
          titleActionBottomDelta: Math.abs(
            headerActionsRect.bottom - titleRect.bottom,
          ),
          actionControlBottomDelta: Math.abs(
            headerAction.getBoundingClientRect().bottom - titleRect.bottom,
          ),
          metricBelowTitleRow: descriptionRect.top >= titleRowRect.bottom - 0.5,
          metricGapDelta: Math.abs(
            descriptionRect.top -
              titleRowRect.bottom -
              Number.parseFloat(pageHeadingStyle.rowGap),
          ),
        },
        headerSignature: {
          titleFontFamily: titleStyle.fontFamily,
          titleFontSize: titleStyle.fontSize,
          titleFontWeight: titleStyle.fontWeight,
          titleLineHeight: titleStyle.lineHeight,
          titleLetterSpacing: titleStyle.letterSpacing,
          descriptionFontSize: descriptionStyle.fontSize,
          descriptionLineHeight: descriptionStyle.lineHeight,
          descriptionColor: descriptionStyle.color,
        },
        tabSignature: {
          height: tabStyle.height,
          radius: tabStyle.borderRadius,
          fontWeight: tabStyle.fontWeight,
          activeColor: tabStyle.color,
          inactiveColor: inactiveTabStyle.color,
          inactiveIconColor: inactiveTabIconStyle.color,
          inactiveIconOpacity: inactiveTabIconStyle.opacity,
          gap: tabsStyle.columnGap,
          tabZIndex: tabStyle.zIndex,
          baselinePaintHeight: baselineStyle.height,
          baselineScaleY,
          baselineVisualHeight: Number(
            (
              Number.parseFloat(baselineStyle.height) * Math.abs(baselineScaleY)
            ).toFixed(3),
          ),
          baselineColor: baselineStyle.backgroundColor,
          baselineZIndex: baselineStyle.zIndex,
          baselinePointerEvents: baselineStyle.pointerEvents,
          baselineLeft: baselineStyle.left,
          baselineRight: baselineStyle.right,
          tabsPaddingLeft: tabsStyle.paddingLeft,
          tabsPaddingRight: tabsStyle.paddingRight,
          markerHeight: markerStyle.height,
          markerColor: markerStyle.backgroundColor,
          markerZIndex: markerStyle.zIndex,
          markerRadius: markerStyle.borderRadius,
          markerBottom: markerStyle.bottom,
          markerDisplay: markerStyle.display,
          indicatorHeight: indicatorStyle.height,
          indicatorColor: indicatorStyle.backgroundColor,
          indicatorZIndex: indicatorStyle.zIndex,
          indicatorRadius: indicatorStyle.borderRadius,
          indicatorBottom: indicatorStyle.bottom,
          indicatorReady: indicator.dataset.ready,
          indicatorTransitionProperty: indicatorStyle.transitionProperty,
          indicatorTransitionDuration: indicatorStyle.transitionDuration,
        },
        tabCount: {
          text: activeTab.innerText.replace(/\s+/g, " ").trim(),
          value: activeTabCount.textContent?.trim() ?? "",
          display: tabCountStyle.display,
          minWidth: tabCountStyle.minWidth,
          height: tabCountStyle.height,
          paddingLeft: tabCountStyle.paddingLeft,
          paddingRight: tabCountStyle.paddingRight,
          borderRadius: tabCountStyle.borderRadius,
          backgroundColor: tabCountStyle.backgroundColor,
          color: tabCountStyle.color,
          labelColor: tabLabelStyle.color,
          fontSize: tabCountStyle.fontSize,
          labelFontSize: tabLabelStyle.fontSize,
          fontWeight: tabCountStyle.fontWeight,
          labelFontWeight: tabLabelStyle.fontWeight,
          position: tabCountStyle.position,
          top: tabCountStyle.top,
          lineHeight: tabCountStyle.lineHeight,
          verticalAlign: tabCountStyle.verticalAlign,
        },
        tabGeometry: {
          firstTabIsActive:
            activeTab === tabs.querySelector<HTMLElement>(".workspace-tab"),
          activeStartInset: activeTabRect.left - tabsScrollRect.left,
          indicatorStartDelta: Math.abs(
            indicatorRect.left - activeTabRect.left,
          ),
          indicatorWidthDelta: Math.abs(
            indicatorRect.width - activeTabRect.width,
          ),
          baselineStartInset:
            tabsRect.left + baselineLeft - tabsScrollRect.left,
          baselineEndInset:
            tabsScrollRect.right - (tabsRect.right - baselineRight),
          allTabsHaveIcons: Array.from(
            tabs.querySelectorAll<HTMLElement>(".workspace-tab"),
          ).every((tab) => Boolean(tab.querySelector(".workspace-tab-icon"))),
        },
        headerActions: headerActions.textContent?.trim() ?? "",
        toolbarText: toolbar.textContent?.trim() ?? "",
        toolbarSurface: {
          backgroundColor: toolbarStyle.backgroundColor,
          borderTopWidth: toolbarStyle.borderTopWidth,
          boxShadow: toolbarStyle.boxShadow,
          paddingTop: toolbarStyle.paddingTop,
          paddingLeft: toolbarStyle.paddingLeft,
          paddingRight: toolbarStyle.paddingRight,
        },
        toolbarAlignment: {
          searchStartInset: toolbarSearchRect.left - toolbarRect.left,
          controlsEndInset: toolbarRect.right - toolbarControlsRect.right,
        },
        searchControl: {
          height: toolbarSearchStyle.height,
          clientHeight: toolbarSearch.clientHeight,
          borderTopWidth: toolbarSearchStyle.borderTopWidth,
          borderTopStyle: toolbarSearchStyle.borderTopStyle,
          borderTopColor: toolbarSearchStyle.borderTopColor,
          backgroundClip: toolbarSearchStyle.backgroundClip,
          boxShadow: toolbarSearchStyle.boxShadow,
          color: toolbarSearchInputStyle.color,
          fontSize: toolbarSearchInputStyle.fontSize,
          fontWeight: toolbarSearchInputStyle.fontWeight,
          lineHeight: toolbarSearchInputStyle.lineHeight,
          placeholderColor: toolbarSearchPlaceholderStyle.color,
          placeholderOpacity: toolbarSearchPlaceholderStyle.opacity,
          iconColor: toolbarSearchIconStyle.color,
          iconOpacity: toolbarSearchIconStyle.opacity,
        },
        controlTypography: {
          ordinaryButton: readControlTypography(headerAction),
          searchInput: readControlTypography(toolbarSearchInput),
          membershipOptions: Array.from(
            membershipSwitch.querySelectorAll<HTMLElement>("button"),
          ).map(readControlTypography),
        },
        controlGeometry: {
          membershipHeight: membershipSwitchStyle.height,
          membershipWidth: membershipSwitch.getBoundingClientRect().width,
          membershipPadding: membershipSwitchStyle.padding,
          membershipGap: membershipSwitchStyle.gap,
          membershipBackgroundColor: membershipSwitchStyle.backgroundColor,
          membershipBackgroundClip: membershipSwitchStyle.backgroundClip,
          membershipBorderTopWidth: membershipSwitchStyle.borderTopWidth,
          membershipBorderTopStyle: membershipSwitchStyle.borderTopStyle,
          membershipBorderTopColor: membershipSwitchStyle.borderTopColor,
          membershipBoxShadow: membershipSwitchStyle.boxShadow,
          membershipButtonHeights: Array.from(
            membershipSwitch.querySelectorAll<HTMLElement>("button"),
          ).map((button) => button.getBoundingClientRect().height),
          activeMembershipHeight: activeMembershipButtonStyle.height,
          activeMembershipBoxShadow: activeMembershipButtonStyle.boxShadow,
          activeMembershipTransform: activeMembershipButtonStyle.transform,
          viewSwitchHeight: getComputedStyle(viewSwitch).height,
          viewSwitchWidth: viewSwitch.getBoundingClientRect().width,
          viewSwitchPadding: getComputedStyle(viewSwitch).padding,
          viewSwitchGap: getComputedStyle(viewSwitch).gap,
          viewSwitchBackgroundColor:
            getComputedStyle(viewSwitch).backgroundColor,
          viewSwitchBackgroundClip: getComputedStyle(viewSwitch).backgroundClip,
          viewSwitchBorderTopWidth: getComputedStyle(viewSwitch).borderTopWidth,
          viewSwitchBorderTopStyle: getComputedStyle(viewSwitch).borderTopStyle,
          viewSwitchBorderTopColor: getComputedStyle(viewSwitch).borderTopColor,
          viewSwitchBoxShadow: getComputedStyle(viewSwitch).boxShadow,
          viewButtonHeights: Array.from(
            viewSwitch.querySelectorAll<HTMLElement>("button"),
          ).map((button) => button.getBoundingClientRect().height),
          activeViewButtonHeight: getComputedStyle(activeViewButton).height,
          activeViewButtonBoxShadow:
            getComputedStyle(activeViewButton).boxShadow,
          viewSwitchInsideControls:
            viewSwitch.parentElement === toolbarControls,
          membershipBeforeViewSwitch: Boolean(
            membershipSwitch.compareDocumentPosition(viewSwitch) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        },
        tableSurface: {
          borderTopWidth: tableWrapperStyle.borderTopWidth,
          borderTopColor: tableWrapperStyle.borderTopColor,
          backgroundClip: tableWrapperStyle.backgroundClip,
          boxShadow: tableWrapperStyle.boxShadow,
          transform: tableWrapperStyle.transform,
        },
        viewButtons: Array.from(viewSwitch.querySelectorAll("button")).map(
          (button) => ({
            label: button.getAttribute("aria-label"),
            pressed: button.getAttribute("aria-pressed"),
          }),
        ),
        membershipButtons: Array.from(
          membershipSwitch.querySelectorAll("button"),
        ).map((button) => ({
          label: button.textContent?.trim() ?? "",
          pressed: button.getAttribute("aria-pressed"),
        })),
        hasFilterTrigger: Boolean(
          toolbar.querySelector(".course-filter-trigger"),
        ),
        nativeSelectCount: toolbar.querySelectorAll("select").length,
      };
    });

    assert.deepEqual(
      studentsVisual.headerSignature,
      scheduleContract.headerSignature,
    );
    assert.ok(["auto", "0px"].includes(studentsVisual.headerLayout.minHeight));
    assert.ok(studentsVisual.headerLayout.height > 0);
    assert.ok(studentsVisual.headerLayout.height < 200);
    assert.equal(studentsVisual.headerLayout.actionsShareTitleRow, true);
    assert.ok(studentsVisual.headerLayout.titleActionBottomDelta < 0.5);
    assert.ok(studentsVisual.headerLayout.actionControlBottomDelta < 0.5);
    assert.equal(studentsVisual.headerLayout.metricBelowTitleRow, true);
    assert.ok(studentsVisual.headerLayout.metricGapDelta < 0.5);
    assert.deepEqual(studentsVisual.tabSignature, {
      height: "40px",
      radius: "12px 12px 0px 0px",
      fontWeight: "400",
      activeColor: "rgb(20, 20, 20)",
      inactiveColor: E2E_MUTED_FOREGROUND,
      inactiveIconColor: E2E_MUTED_FOREGROUND,
      inactiveIconOpacity: "1",
      gap: "12px",
      tabZIndex: "auto",
      baselinePaintHeight: "3px",
      baselineScaleY: 0.4,
      baselineVisualHeight: 1.2,
      baselineColor: E2E_WORKSPACE_TABS_DIVIDER,
      baselineZIndex: "1",
      baselinePointerEvents: "none",
      baselineLeft: "0px",
      baselineRight: "0px",
      tabsPaddingLeft: "0px",
      tabsPaddingRight: "0px",
      markerHeight: "4px",
      markerColor: "rgb(20, 20, 20)",
      markerZIndex: "2",
      markerRadius: "0px",
      markerBottom: "0px",
      markerDisplay: "none",
      indicatorHeight: "4px",
      indicatorColor: "rgb(20, 20, 20)",
      indicatorZIndex: "2",
      indicatorRadius: "0px",
      indicatorBottom: "0px",
      indicatorReady: "true",
      indicatorTransitionProperty: "width, transform, opacity",
      indicatorTransitionDuration: "0.36s, 0.36s, 0.12s",
    });
    assert.match(studentsVisual.tabCount.text, /^Ученики \d+$/);
    assert.match(studentsVisual.tabCount.value, /^\d+$/);
    assert.deepEqual(
      {
        display: studentsVisual.tabCount.display,
        minWidth: studentsVisual.tabCount.minWidth,
        height: studentsVisual.tabCount.height,
        paddingLeft: studentsVisual.tabCount.paddingLeft,
        paddingRight: studentsVisual.tabCount.paddingRight,
        borderRadius: studentsVisual.tabCount.borderRadius,
        backgroundColor: studentsVisual.tabCount.backgroundColor,
      },
      {
        display: "inline",
        minWidth: "0px",
        height: "auto",
        paddingLeft: "0px",
        paddingRight: "0px",
        borderRadius: "0px",
        backgroundColor: "rgba(0, 0, 0, 0)",
      },
    );
    assert.equal(
      studentsVisual.tabCount.color,
      studentsVisual.tabCount.labelColor,
    );
    assert.ok(
      Number.parseFloat(studentsVisual.tabCount.fontSize) <
        Number.parseFloat(studentsVisual.tabCount.labelFontSize),
    );
    assert.equal(studentsVisual.tabCount.fontWeight, "500");
    assert.equal(studentsVisual.tabCount.labelFontWeight, "400");
    assert.equal(studentsVisual.tabCount.position, "relative");
    assert.ok(Number.parseFloat(studentsVisual.tabCount.top) < 0);
    assert.equal(studentsVisual.tabCount.lineHeight, "0px");
    assert.equal(studentsVisual.tabCount.verticalAlign, "baseline");
    assert.equal(studentsVisual.tabGeometry.firstTabIsActive, true);
    assert.equal(studentsVisual.tabGeometry.allTabsHaveIcons, true);
    assert.ok(Math.abs(studentsVisual.tabGeometry.activeStartInset) < 0.5);
    assert.ok(studentsVisual.tabGeometry.indicatorStartDelta < 0.5);
    assert.ok(studentsVisual.tabGeometry.indicatorWidthDelta < 0.5);
    assert.ok(Math.abs(studentsVisual.tabGeometry.baselineStartInset) < 0.5);
    assert.ok(Math.abs(studentsVisual.tabGeometry.baselineEndInset) < 0.5);
    assert.ok(
      Math.abs(
        studentsVisual.tabGeometry.activeStartInset -
          studentsVisual.tabGeometry.baselineStartInset,
      ) < 0.5,
    );
    assert.match(studentsVisual.headerActions, /Новый ученик/);
    assert.doesNotMatch(studentsVisual.toolbarText, /Новый ученик/);
    assert.deepEqual(studentsVisual.toolbarSurface, {
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderTopWidth: "0px",
      boxShadow: "none",
      paddingTop: "0px",
      paddingLeft: "0px",
      paddingRight: "0px",
    });
    assert.ok(Math.abs(studentsVisual.toolbarAlignment.searchStartInset) < 0.5);
    assert.ok(Math.abs(studentsVisual.toolbarAlignment.controlsEndInset) < 0.5);
    assert.deepEqual(studentsVisual.searchControl, {
      height: "40px",
      clientHeight: 38,
      borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      borderTopStyle: "solid",
      borderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
      backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      boxShadow: E2E_ENTRY_CONTROL_SHADOW,
      color: "rgb(20, 20, 20)",
      fontSize: "14.08px",
      fontWeight: "400",
      lineHeight: "16.896px",
      placeholderColor: "rgb(20, 20, 20)",
      placeholderOpacity: "1",
      iconColor: "rgb(20, 20, 20)",
      iconOpacity: "1",
    });
    const canonicalDesktopControlTypography = {
      fontSize: "14.08px",
      fontWeight: "400",
      lineHeight: "16.896px",
    };
    assert.deepEqual(
      studentsVisual.controlTypography.ordinaryButton,
      canonicalDesktopControlTypography,
    );
    assert.deepEqual(
      studentsVisual.controlTypography.searchInput,
      canonicalDesktopControlTypography,
    );
    assert.deepEqual(
      studentsVisual.controlTypography.membershipOptions,
      Array.from({ length: 3 }, () => canonicalDesktopControlTypography),
      "Students membership options must use the same type token as buttons and search",
    );
    const studentSearchSurface = runtime.page.locator(".teaching-hub-search");
    const studentSearchInput = studentSearchSurface.locator(
      'input[type="search"]',
    );
    const studentSearchRestRect = await studentSearchSurface.boundingBox();
    assert.ok(studentSearchRestRect);
    await studentSearchSurface.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await studentSearchSurface.evaluate((surface) => {
        const style = getComputedStyle(surface);
        const rect = surface.getBoundingClientRect();
        return {
          borderTopWidth: style.borderTopWidth,
          backgroundClip: style.backgroundClip,
          boxShadow: style.boxShadow,
          transform: style.transform,
          width: rect.width,
          height: rect.height,
        };
      }),
      {
        borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
        backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
        boxShadow: E2E_ENTRY_CONTROL_SHADOW,
        transform: "none",
        width: studentSearchRestRect.width,
        height: studentSearchRestRect.height,
      },
    );
    await studentSearchInput.click();
    assert.deepEqual(
      await studentSearchSurface.evaluate((surface) => {
        const style = getComputedStyle(surface);
        return {
          borderTopWidth: style.borderTopWidth,
          backgroundClip: style.backgroundClip,
          boxShadow: style.boxShadow,
          transform: style.transform,
          outlineColor: style.outlineColor,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineOffset: style.outlineOffset,
        };
      }),
      {
        borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
        backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
        boxShadow: E2E_ENTRY_CONTROL_SHADOW,
        transform: "none",
        outlineColor: E2E_FOCUS_HALO_COLOR,
        outlineStyle: "solid",
        outlineWidth: "2px",
        outlineOffset: "0px",
      },
    );
    assert.deepEqual(studentsVisual.controlGeometry, {
      membershipHeight: "40px",
      membershipWidth: studentsVisual.controlGeometry.membershipWidth,
      membershipPadding: "0px",
      membershipGap: "2px",
      membershipBackgroundColor: E2E_SEGMENTED_CONTROL_BACKGROUND,
      membershipBackgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      membershipBorderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      membershipBorderTopStyle: "solid",
      membershipBorderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
      membershipBoxShadow: "none",
      membershipButtonHeights: [38, 38, 38],
      activeMembershipHeight: "38px",
      activeMembershipBoxShadow: "none",
      activeMembershipTransform: "none",
      viewSwitchHeight: "40px",
      viewSwitchWidth: 80,
      viewSwitchPadding: "0px",
      viewSwitchGap: "2px",
      viewSwitchBackgroundColor: E2E_SEGMENTED_CONTROL_BACKGROUND,
      viewSwitchBackgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      viewSwitchBorderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      viewSwitchBorderTopStyle: "solid",
      viewSwitchBorderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
      viewSwitchBoxShadow: "none",
      viewButtonHeights: [38, 38],
      activeViewButtonHeight: "38px",
      activeViewButtonBoxShadow: "none",
      viewSwitchInsideControls: true,
      membershipBeforeViewSwitch: true,
    });
    assert.ok(studentsVisual.controlGeometry.membershipWidth > 80);
    assert.deepEqual(studentsVisual.tableSurface, {
      borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      borderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
      backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      boxShadow: E2E_RAISED_SURFACE_SHADOW,
      transform: "none",
    });
    assert.deepEqual(studentsVisual.viewButtons, [
      { label: "Показать таблицей", pressed: "true" },
      { label: "Показать карточками", pressed: "false" },
    ]);
    assert.deepEqual(studentsVisual.membershipButtons, [
      { label: "Все", pressed: "true" },
      { label: "В группе", pressed: "false" },
      { label: "Без группы", pressed: "false" },
    ]);
    assert.equal(studentsVisual.hasFilterTrigger, false);
    assert.equal(studentsVisual.nativeSelectCount, 0);
    await assertSegmentedIndicatorAligned(
      runtime.page,
      "Принадлежность к группе",
      "Students desktop membership",
    );
    await assertSegmentedIndicatorAligned(
      runtime.page,
      "Вид списка учеников",
      "Students desktop view",
    );

    const studentTableSurface = runtime.page.locator(
      ".student-directory-table-wrap",
    );
    await studentTableSurface.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await studentTableSurface.evaluate((surface) => {
        const style = getComputedStyle(surface);
        return {
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      { boxShadow: E2E_RAISED_SURFACE_SHADOW, transform: "none" },
    );

    const activeLearnerViewButton = runtime.page.getByRole("button", {
      name: "Показать таблицей",
      exact: true,
    });
    await activeLearnerViewButton.hover();
    await runtime.page.waitForTimeout(220);
    const learnerViewHover = await activeLearnerViewButton.evaluate(
      (button) => {
        const indicator = button
          .closest('[role="group"]')
          ?.querySelector<HTMLElement>(".product-segmented-control-indicator");
        if (!indicator) throw new Error("Students indicator is missing");
        const style = getComputedStyle(button);
        return {
          optionBoxShadow: style.boxShadow,
          indicatorBoxShadow: getComputedStyle(indicator).boxShadow,
          transform: style.transform,
        };
      },
    );
    assert.deepEqual(
      {
        optionBoxShadow: learnerViewHover.optionBoxShadow,
        transform: learnerViewHover.transform,
      },
      {
        optionBoxShadow: "none",
        transform: "none",
      },
    );
    assertSegmentedSurfaceShadow(
      learnerViewHover.indicatorBoxShadow,
      E2E_RAISED_CONTROL_SHADOW,
      "Students hovered selected indicator",
    );
    await runtime.page.mouse.down();
    await runtime.page.waitForTimeout(220);
    const learnerViewPressed = await activeLearnerViewButton.evaluate(
      (button) => {
        const indicator = button
          .closest('[role="group"]')
          ?.querySelector<HTMLElement>(".product-segmented-control-indicator");
        if (!indicator) throw new Error("Students indicator is missing");
        const style = getComputedStyle(button);
        return {
          optionBoxShadow: style.boxShadow,
          indicatorBoxShadow: getComputedStyle(indicator).boxShadow,
          transform: style.transform,
        };
      },
    );
    assert.deepEqual(
      {
        optionBoxShadow: learnerViewPressed.optionBoxShadow,
        transform: learnerViewPressed.transform,
      },
      {
        optionBoxShadow: "none",
        transform: "none",
      },
    );
    assertSegmentedSurfaceShadow(
      learnerViewPressed.indicatorBoxShadow,
      E2E_RAISED_CONTROL_PRESSED_SHADOW,
      "Students pressed selected indicator",
    );
    await runtime.page.mouse.move(0, 0);
    await runtime.page.mouse.up();

    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Вид списка учеников",
      optionName: "Показать карточками",
      label: "Students desktop table-to-cards",
    });
    const learnerCards = runtime.page.getByRole("region", {
      name: "Карточки учеников",
      exact: true,
    });
    await learnerCards.waitFor();
    assert.equal(
      await runtime.page
        .getByRole("table", {
          name: "Ученики, их статусы и группы",
          exact: true,
        })
        .count(),
      0,
    );
    await learnerCards
      .getByRole("button", {
        name: "Профиль ученика Анна Петрова",
        exact: true,
      })
      .waitFor();
    await learnerCards
      .getByRole("button", {
        name: /Действия с учеником.*Архивная Ольга/,
      })
      .waitFor();
    const learnerCardSurface = learnerCards.locator(
      ".student-directory-card:first-child",
    );
    await learnerCardSurface.waitFor();
    assert.deepEqual(
      await learnerCardSurface.evaluate((element) => {
        const card = element as HTMLElement;
        const style = getComputedStyle(card);
        return {
          borderTopWidth: style.borderTopWidth,
          borderTopColor: style.borderTopColor,
          backgroundClip: style.backgroundClip,
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      {
        borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
        borderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
        backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
        boxShadow: E2E_RAISED_SURFACE_SHADOW,
        transform: "none",
      },
    );
    await learnerCardSurface.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await learnerCardSurface.evaluate((element) => {
        const card = element as HTMLElement;
        const style = getComputedStyle(card);
        return {
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      { boxShadow: E2E_RAISED_SURFACE_SHADOW, transform: "none" },
    );
    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Вид списка учеников",
      optionName: "Показать таблицей",
      label: "Students desktop cards-to-table",
    });

    const learnerTable = runtime.page.getByRole("table", {
      name: "Ученики, их статусы и группы",
      exact: true,
    });
    await learnerTable.waitFor();
    await assertCanonicalFirstBodyRowTypography(learnerTable, "Ученики");
    const learnerMembershipSwitch = runtime.page.getByRole("group", {
      name: "Принадлежность к группе",
      exact: true,
    });
    assert.equal(
      await learnerMembershipSwitch.evaluate(
        (group) => getComputedStyle(group).backgroundColor,
      ),
      E2E_SEGMENTED_CONTROL_BACKGROUND,
    );
    const allMemberships = learnerMembershipSwitch.getByRole("button", {
      name: "Все",
      exact: true,
    });
    const groupedMemberships = learnerMembershipSwitch.getByRole("button", {
      name: "В группе",
      exact: true,
    });
    const ungroupedMemberships = learnerMembershipSwitch.getByRole("button", {
      name: "Без группы",
      exact: true,
    });
    assert.equal(await allMemberships.getAttribute("aria-pressed"), "true");
    assert.equal(
      await groupedMemberships.getAttribute("aria-pressed"),
      "false",
    );
    assert.equal(
      await ungroupedMemberships.getAttribute("aria-pressed"),
      "false",
    );
    const learnerRowNames = () =>
      runtime.page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            ".student-directory-learners-table tbody tr td:first-child strong",
          ),
        ).map((element) => element.textContent?.trim() ?? ""),
      );
    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Принадлежность к группе",
      optionName: "В группе",
      label: "Students desktop variable-width membership",
      expectWidthTransition: true,
    });
    assert.equal(await groupedMemberships.getAttribute("aria-pressed"), "true");
    await assertSegmentedIndicatorPaintsOuterShadow(
      runtime.page,
      "Принадлежность к группе",
      "Students desktop membership indicator",
    );
    assert.equal(
      await runtime.page
        .getByRole("button", { name: "Очистить поиск", exact: true })
        .count(),
      0,
    );
    assert.deepEqual(await learnerRowNames(), [
      "Анна Петрова",
      "Борис Волков",
      "Клара Смирнова",
    ]);
    const learnerToolbarSearch = runtime.page.locator(
      'input[placeholder="Найти ученика"]',
    );
    await learnerToolbarSearch.fill("Анна");
    const clearLearnerSearch = runtime.page.getByRole("button", {
      name: "Очистить поиск",
      exact: true,
    });
    await clearLearnerSearch.waitFor();
    await clearLearnerSearch.click();
    assert.equal(await learnerToolbarSearch.inputValue(), "");
    assert.equal(await groupedMemberships.getAttribute("aria-pressed"), "true");
    assert.deepEqual(await learnerRowNames(), [
      "Анна Петрова",
      "Борис Волков",
      "Клара Смирнова",
    ]);
    assert.equal(await clearLearnerSearch.count(), 0);
    await ungroupedMemberships.press("Space");
    await settleSegmentedIndicator(runtime.page, "Принадлежность к группе");
    assert.equal(
      await ungroupedMemberships.getAttribute("aria-pressed"),
      "true",
    );
    assert.deepEqual(
      await ungroupedMemberships.evaluate((button) => {
        const style = getComputedStyle(button);
        return {
          focused: document.activeElement === button,
          pressed: button.getAttribute("aria-pressed"),
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        };
      }),
      {
        focused: true,
        pressed: "true",
        outlineStyle: "solid",
        outlineWidth: "2px",
      },
      "Students keyboard activation keeps focus and pressed semantics",
    );
    await assertSegmentedIndicatorAligned(
      runtime.page,
      "Принадлежность к группе",
      "Students keyboard-selected membership",
    );
    await learnerTable
      .getByText("Ничего не найдено", { exact: true })
      .waitFor();
    assert.equal(
      await runtime.page
        .getByRole("button", { name: "Очистить поиск", exact: true })
        .count(),
      0,
    );
    assert.deepEqual(await learnerRowNames(), []);
    await allMemberships.click();
    assert.equal(await allMemberships.getAttribute("aria-pressed"), "true");
    await learnerTable.getByText("Архивная Ольга", { exact: true }).waitFor();

    const learnerStatusHeader = learnerTable.getByRole("columnheader", {
      name: "Статус",
      exact: true,
    });
    const learnerStatusSort = learnerStatusHeader.getByRole("button", {
      name: "Статус",
      exact: true,
    });
    assert.equal(await learnerStatusHeader.getAttribute("aria-sort"), "none");
    await learnerStatusSort.click();
    assert.equal(
      await learnerStatusHeader.getAttribute("aria-sort"),
      "ascending",
    );
    assert.deepEqual(await learnerRowNames(), [
      "Анна Петрова",
      "Борис Волков",
      "Клара Смирнова",
      "Новый по QR",
      "Архивная Ольга",
    ]);
    await learnerStatusSort.click();
    assert.equal(
      await learnerStatusHeader.getAttribute("aria-sort"),
      "descending",
    );
    assert.deepEqual(await learnerRowNames(), [
      "Архивная Ольга",
      "Новый по QR",
      "Анна Петрова",
      "Борис Волков",
      "Клара Смирнова",
    ]);

    const archivedRow = runtime.page.locator('tr:has-text("Архивная Ольга")');
    const pendingRow = runtime.page.locator('tr:has-text("Новый по QR")');
    await archivedRow.getByText("В архиве", { exact: true }).waitFor();
    const archivedActionsTrigger = archivedRow.getByRole("button", {
      name: /Действия с учеником.*Архивная Ольга/,
    });
    await archivedActionsTrigger.click();
    let learnerActionMenu = runtime.page.getByRole("menu");
    await learnerActionMenu
      .getByRole("menuitem", { name: "Восстановить", exact: true })
      .waitFor();
    assert.deepEqual(
      await learnerActionMenu.evaluate((menu) => {
        const style = getComputedStyle(menu);
        return {
          borderWidths: [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth,
          ],
          borderRadius: style.borderRadius,
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
          separatorCount: menu.querySelectorAll(
            '[role="separator"], .action-menu-separator',
          ).length,
        };
      }),
      {
        borderWidths: ["0px", "0px", "0px", "0px"],
        borderRadius: "12px",
        backgroundColor: "rgb(255, 255, 255)",
        boxShadow: E2E_DROPDOWN_SHADOW,
        separatorCount: 0,
      },
    );
    await learnerActionMenu.press("Escape");
    await learnerActionMenu.waitFor({ state: "detached" });
    assert.equal(
      await archivedActionsTrigger.getAttribute("aria-expanded"),
      "false",
    );
    await pendingRow.getByText("Ожидает ответа", { exact: true }).waitFor();
    const pendingActionsTrigger = pendingRow.getByRole("button", {
      name: /Действия с учеником.*Новый по QR/,
    });
    await pendingActionsTrigger.click();
    learnerActionMenu = runtime.page.getByRole("menu");
    await learnerActionMenu
      .getByRole("menuitem", { name: "Отменить запрос", exact: true })
      .waitFor();
    await learnerActionMenu.press("Escape");
    await learnerActionMenu.waitFor({ state: "detached" });

    const annaActionsTrigger = runtime.page
      .locator('tr:has-text("Анна Петрова")')
      .getByRole("button", {
        name: /Действия с учеником.*Анна Петрова/,
      });
    await annaActionsTrigger.click();
    learnerActionMenu = runtime.page.getByRole("menu");
    const addToCourseAction = learnerActionMenu.getByRole("menuitem", {
      name: "Добавить в курс…",
      exact: true,
    });
    await addToCourseAction.waitFor();
    assert.equal(
      await learnerActionMenu
        .getByRole("menuitem", { name: /Написать сообщение/ })
        .getAttribute("disabled"),
      null,
    );
    await learnerActionMenu
      .getByRole("menuitem", { name: "Убрать из списка", exact: true })
      .waitFor();
    e2eCourseAudienceReplacement = null;
    await addToCourseAction.click();

    const addToCourseDialog = runtime.page.getByRole("dialog", {
      name: "Добавить в курс",
      exact: true,
    });
    await addToCourseDialog.waitFor();
    const addToCourseSubmit = addToCourseDialog.getByRole("button", {
      name: "Добавить в курс",
      exact: true,
    });
    assert.notEqual(await addToCourseSubmit.getAttribute("disabled"), null);
    const courseChoice = addToCourseDialog.getByRole("radio");
    assert.equal(await courseChoice.count(), 1);
    await courseChoice.check();
    assert.equal(await addToCourseSubmit.getAttribute("disabled"), null);
    await addToCourseSubmit.click();
    await runtime.page
      .getByText(
        `Ученик «Анна Петрова» добавлен в курс «${E2E_COURSE_TITLE}».`,
        { exact: true },
      )
      .waitFor();
    assert.deepEqual(e2eCourseAudienceReplacement, {
      directLearnerProfileIds: [E2E_LEARNER_BORIS_ID, E2E_LEARNER_ANNA_ID],
      learnerGroupIds: [E2E_GROUP_TEEN_ID],
    });

    const studentActionGeometry = await runtime.page.evaluate(() => {
      const wrapper = document.querySelector<HTMLElement>(
        ".student-directory-table-wrap",
      );
      const table = document.querySelector<HTMLTableElement>(
        ".student-directory-learners-table",
      );
      const archivedTableRow = Array.from(table?.rows ?? []).find((row) =>
        row.textContent?.includes("Архивная Ольга"),
      );
      const groupCell = archivedTableRow?.cells[3];
      const actionCell = archivedTableRow?.cells[5];
      const buttons = Array.from(
        actionCell?.querySelectorAll<HTMLButtonElement>("button") ?? [],
      );
      if (!wrapper || !table || !groupCell || !actionCell || !buttons.length) {
        throw new Error("Students action-column geometry is missing");
      }
      const tableRect = table.getBoundingClientRect();
      const groupRect = groupCell.getBoundingClientRect();
      const actionRect = actionCell.getBoundingClientRect();
      const wrapperStyle = getComputedStyle(wrapper);
      const tableStyle = getComputedStyle(table);
      return {
        cellCount: archivedTableRow?.cells.length ?? 0,
        surface: {
          wrapperBackgroundColor: wrapperStyle.backgroundColor,
          wrapperBackgroundClip: wrapperStyle.backgroundClip,
          tableBackgroundColor: tableStyle.backgroundColor,
          wrapperBorderWidths: [
            wrapperStyle.borderTopWidth,
            wrapperStyle.borderRightWidth,
            wrapperStyle.borderBottomWidth,
            wrapperStyle.borderLeftWidth,
          ],
          wrapperBorderRadius: wrapperStyle.borderRadius,
          wrapperBorderColor: wrapperStyle.borderTopColor,
        },
        actionWidth: actionRect.width,
        columnsDoNotOverlap: groupRect.right <= actionRect.left + 0.5,
        buttonsInsideActionCell: buttons.every((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left >= actionRect.left && rect.right <= actionRect.right;
        }),
        tableContainedByWrapper: tableRect.width <= wrapper.scrollWidth + 0.5,
      };
    });
    assert.deepEqual(studentActionGeometry.surface, {
      wrapperBackgroundColor: "rgb(255, 255, 255)",
      wrapperBackgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      tableBackgroundColor: "rgb(255, 255, 255)",
      wrapperBorderWidths: ["1px", "1px", "1px", "1px"],
      wrapperBorderRadius: "12px",
      wrapperBorderColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
    });
    assert.equal(studentActionGeometry.cellCount, 6);
    assert.ok(studentActionGeometry.actionWidth >= 40);
    assert.ok(studentActionGeometry.actionWidth < 100);
    assert.equal(studentActionGeometry.columnsDoNotOverlap, true);
    assert.equal(studentActionGeometry.buttonsInsideActionCell, true);
    assert.equal(studentActionGeometry.tableContainedByWrapper, true);

    const learnerSearch = runtime.page.locator(
      'input[placeholder="Найти ученика"]',
    );
    await learnerSearch.fill("Архивная");
    await archivedRow.waitFor();
    assert.equal(
      await runtime.page.locator(".student-directory-filter-menu").count(),
      0,
    );
    assert.equal(
      await runtime.page
        .getByRole("group", {
          name: "Принадлежность к группе",
          exact: true,
        })
        .count(),
      1,
    );
    await learnerSearch.fill("");

    await runtime.page
      .getByRole("button", {
        name: "Профиль ученика Анна Петрова",
        exact: true,
      })
      .click();
    await runtime.page
      .getByRole("heading", {
        name: "Редактировать ученика",
        exact: true,
        level: 2,
      })
      .waitFor();
    const historyApiResponse = await requestLocalApp(
      `/api/v2/learner-profiles/${E2E_LEARNER_ANNA_ID}/history`,
      { headers: { Cookie: `shidao_session=${teacherCookie}` } },
    );
    const historyApiPayload = historyApiResponse.body.toString("utf8");
    assert.equal(historyApiResponse.status, 200, historyApiPayload);
    assert.match(historyApiPayload, /Уверенно использует Present Perfect\./);
    assert.doesNotMatch(historyApiPayload, /FOREIGN TRAP RECORD|Чужой курс/);
    await runtime.page
      .getByRole("tab", { name: "История", exact: true })
      .click();
    await runtime.page
      .getByText(
        "Показаны только завершённые уроки в ваших курсах. Данные других преподавателей здесь недоступны.",
        { exact: true },
      )
      .waitFor();
    await runtime.page
      .getByText("Уверенно использует Present Perfect.", { exact: true })
      .waitFor();
    html = await runtime.page.content();
    assert.doesNotMatch(html, /FOREIGN TRAP RECORD|Чужой курс/);
    await runtime.page
      .getByRole("tab", { name: "Аккаунт", exact: true })
      .click();
    await runtime.page
      .getByRole("heading", {
        name: "Запросить разрешение для помощника",
        exact: true,
        level: 3,
      })
      .waitFor();
    await runtime.page
      .getByRole("button", { name: "Отправить запрос", exact: true })
      .click();
    await runtime.page
      .getByText(/ Разрешение начнёт действовать только после подтверждения/)
      .waitFor();
    assert.equal(e2eAiConsentRequested, true);
    await runtime.page
      .getByRole("dialog", { name: "Редактировать ученика", exact: true })
      .getByRole("button", { name: "Закрыть", exact: true })
      .click();

    await runtime.page
      .getByRole("tab", { name: "Группы 2", exact: true })
      .click();
    const groupTable = runtime.page.getByRole("table", {
      name: "Группы учеников",
      exact: true,
    });
    await groupTable.waitFor();
    await runtime.page.evaluate(async () => {
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
      const indicator = document.querySelector<HTMLElement>(
        ".workspace-tabs-indicator",
      );
      if (!indicator) throw new Error("Moving tab indicator is missing");
      await Promise.all(
        indicator
          .getAnimations()
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    const movedTabIndicator = await runtime.page.evaluate(() => {
      const tabs = document.querySelector<HTMLElement>(".workspace-tabs");
      const activeTab = tabs?.querySelector<HTMLElement>(
        '.workspace-tab[aria-selected="true"]',
      );
      const indicator = tabs?.querySelector<HTMLElement>(
        ".workspace-tabs-indicator",
      );
      if (!tabs || !activeTab || !indicator) {
        throw new Error("Moving tab indicator contract is missing");
      }
      const tabsRect = tabs.getBoundingClientRect();
      const activeRect = activeTab.getBoundingClientRect();
      const indicatorRect = indicator.getBoundingClientRect();
      return {
        activeLabel: activeTab.textContent?.replace(/\s+/g, " ").trim() ?? "",
        movedRight: indicatorRect.left > tabsRect.left,
        startDelta: Math.abs(indicatorRect.left - activeRect.left),
        widthDelta: Math.abs(indicatorRect.width - activeRect.width),
      };
    });
    assert.match(movedTabIndicator.activeLabel, /^Группы 2$/);
    assert.equal(movedTabIndicator.movedRight, true);
    assert.ok(movedTabIndicator.startDelta < 0.5);
    assert.ok(movedTabIndicator.widthDelta < 0.5);

    await runtime.page.emulateMedia({ reducedMotion: "reduce" });
    const reducedIndicatorDuration = await runtime.page
      .locator(".workspace-tabs-indicator")
      .evaluate((indicator) =>
        Number.parseFloat(getComputedStyle(indicator).transitionDuration),
      );
    assert.ok(
      reducedIndicatorDuration <= 0.00001,
      `Reduced-motion indicator must be effectively instant, got ${reducedIndicatorDuration}s`,
    );
    const reducedNavPillDuration = await runtime.page
      .locator(".site-header-nav-active-pill")
      .evaluate((indicator) =>
        Number.parseFloat(getComputedStyle(indicator).transitionDuration),
      );
    assert.ok(
      reducedNavPillDuration <= 0.00001,
      `Reduced-motion nav pill must be effectively instant, got ${reducedNavPillDuration}s`,
    );
    await runtime.page.emulateMedia({ reducedMotion: "no-preference" });
    await assertCanonicalFirstBodyRowTypography(groupTable, "Группы");
    const groupViewSwitch = runtime.page.getByRole("group", {
      name: "Вид списка групп",
      exact: true,
    });
    assert.deepEqual(
      await runtime.page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '[role="group"][aria-label="Вид списка групп"] button',
          ),
        ).map((button) => ({
          label: button.getAttribute("aria-label"),
          pressed: button.getAttribute("aria-pressed"),
        })),
      ),
      [
        { label: "Показать таблицей", pressed: "true" },
        { label: "Показать карточками", pressed: "false" },
      ],
    );
    const groupsToolbarContract = await runtime.page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(
        ".student-directory-toolbar",
      );
      const search = toolbar?.querySelector<HTMLElement>(
        ".student-directory-search",
      );
      const controls = toolbar?.querySelector<HTMLElement>(
        ".student-directory-controls",
      );
      if (!toolbar || !search || !controls) {
        throw new Error("Groups toolbar contract is missing");
      }
      const style = getComputedStyle(toolbar);
      const rect = toolbar.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      return {
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        searchStartInset: searchRect.left - rect.left,
        controlsEndInset: rect.right - controlsRect.right,
      };
    });
    assert.equal(groupsToolbarContract.paddingLeft, "0px");
    assert.equal(groupsToolbarContract.paddingRight, "0px");
    assert.ok(Math.abs(groupsToolbarContract.searchStartInset) < 0.5);
    assert.ok(Math.abs(groupsToolbarContract.controlsEndInset) < 0.5);
    html = await runtime.page.content();
    assert.match(html, /Подготовка к экзамену/);
    assert.match(html, /2 ученика/);
    assert.match(html, /Новая группа/);

    await groupViewSwitch
      .getByRole("button", { name: "Показать карточками", exact: true })
      .click();
    const groupCards = runtime.page.getByRole("region", {
      name: "Карточки групп",
      exact: true,
    });
    await groupCards.waitFor();
    await groupCards
      .getByRole("button", { name: "Группа Teen Talk", exact: true })
      .waitFor();
    assert.equal(
      await runtime.page
        .getByRole("table", { name: "Группы учеников", exact: true })
        .count(),
      0,
    );
    await groupViewSwitch
      .getByRole("button", { name: "Показать таблицей", exact: true })
      .click();
    await runtime.page
      .getByRole("table", { name: "Группы учеников", exact: true })
      .waitFor();

    const studentsCurrent = await runtime.page.evaluate(() =>
      document
        .querySelector<HTMLAnchorElement>(
          '.site-header-nav-pill[href="/students"]',
        )
        ?.getAttribute("aria-current"),
    );
    assert.equal(studentsCurrent, "page");

    const scheduleLink = runtime.page.getByRole("link", {
      name: "Расписание",
      exact: true,
    });
    await Promise.all([
      runtime.page.waitForURL(/\/schedule$/),
      scheduleLink.click(),
    ]);
    await runtime.page
      .getByRole("heading", { name: "Расписание", exact: true, level: 1 })
      .waitFor();
    const primaryTransitionDirections = await runtime.page.evaluate(
      () =>
        (
          window as typeof window & {
            __e2ePageTransitionDirections?: string[];
          }
        ).__e2ePageTransitionDirections ?? [],
    );
    assert.equal(primaryTransitionDirections.at(-1), "back");
  } finally {
    releaseStudentsContent();
    e2eStudentDirectoryRpcGate = null;
    e2eStudentDirectoryRpcObserved = null;
    e2eCompletionPhase = null;
    e2eScheduleFixtureVisible = false;
    e2eScheduleFixtureRunCount = 1;
    e2eStudentDirectoryRpcDelayMs = 0;
    e2eStudentDirectoryRpcReleaseAt = 0;
    await runtime.close();
  }
});

test("browser smoke: self profile exposes only learner-safe history and controls AI consent", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eAiConsentStatus = "pending";
  const runtime = await openPage({ cookie: authenticatedCookieValue() });
  try {
    await runtime.page.goto("/profile", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", {
        name: "E2E Adult",
        exact: true,
        level: 1,
      })
      .waitFor();
    assert.equal(
      await runtime.page.getByRole("heading", { level: 1 }).count(),
      1,
    );
    const assertProfileSurfaceContract = async (surfaceName: string) => {
      const cards = await runtime.page
        .locator('[data-profile-surface="card"]')
        .evaluateAll((elements) =>
          elements
            .filter((element) => (element as HTMLElement).offsetParent !== null)
            .map((element) => {
              const style = getComputedStyle(element);
              return {
                backgroundColor: style.backgroundColor,
                backgroundClip: style.backgroundClip,
                borderRadius: style.borderRadius,
                borderTopWidth: style.borderTopWidth,
                boxShadow: style.boxShadow,
              };
            }),
        );
      assert.ok(cards.length > 0, `${surfaceName}: expected visible cards`);
      for (const card of cards) {
        assert.equal(card.backgroundColor, "rgb(255, 255, 255)", surfaceName);
        assert.equal(card.backgroundClip, "padding-box", surfaceName);
        assert.equal(card.borderRadius, "20px", surfaceName);
        assert.equal(card.borderTopWidth, "1px", surfaceName);
        assert.notEqual(card.boxShadow, "none", surfaceName);
      }

      const rows = await runtime.page
        .locator('[data-profile-surface="row"]')
        .evaluateAll((elements) =>
          elements
            .filter((element) => (element as HTMLElement).offsetParent !== null)
            .map((element) => {
              const style = getComputedStyle(element);
              return {
                backgroundColor: style.backgroundColor,
                backgroundClip: style.backgroundClip,
                borderRadius: style.borderRadius,
                borderTopWidth: style.borderTopWidth,
                boxShadow: style.boxShadow,
              };
            }),
        );
      for (const row of rows) {
        assert.equal(row.backgroundColor, "rgb(255, 255, 255)", surfaceName);
        assert.equal(row.backgroundClip, "padding-box", surfaceName);
        assert.equal(row.borderRadius, "20px", surfaceName);
        assert.equal(row.borderTopWidth, "1px", surfaceName);
        assert.equal(row.boxShadow, "none", surfaceName);
      }

      const tables = await runtime.page
        .locator('[data-profile-surface="table"]')
        .evaluateAll((elements) =>
          elements
            .filter((element) => (element as HTMLElement).offsetParent !== null)
            .map((element) => {
              const style = getComputedStyle(element);
              return {
                backgroundColor: style.backgroundColor,
                backgroundClip: style.backgroundClip,
                borderRadius: style.borderRadius,
                borderTopWidth: style.borderTopWidth,
                boxShadow: style.boxShadow,
              };
            }),
        );
      for (const table of tables) {
        assert.equal(table.backgroundColor, "rgb(255, 255, 255)", surfaceName);
        assert.equal(table.backgroundClip, "padding-box", surfaceName);
        assert.equal(table.borderRadius, "20px", surfaceName);
        assert.equal(table.borderTopWidth, "1px", surfaceName);
        assert.notEqual(table.boxShadow, "none", surfaceName);
      }
    };
    const profileTabOwnership = await runtime.page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).map(
        (tab) => {
          const controls = tab.getAttribute("aria-controls") ?? "";
          const panel = controls ? document.getElementById(controls) : null;
          return {
            controls,
            panelRole: panel?.getAttribute("role") ?? "",
            labelledBy: panel?.getAttribute("aria-labelledby") ?? "",
            tabId: tab.id,
          };
        },
      ),
    );
    assert.ok(profileTabOwnership.length > 0);
    assert.equal(
      profileTabOwnership.every(
        ({ controls, panelRole, labelledBy, tabId }) =>
          Boolean(controls) && panelRole === "tabpanel" && labelledBy === tabId,
      ),
      true,
    );
    let html = await runtime.page.content();
    assert.match(html, /1 ч 32 мин/);
    assert.match(html, /Известное фактическое время/);
    await assertProfileSurfaceContract("Профиль");

    await runtime.page.setViewportSize({ width: 484, height: 812 });
    await runtime.page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => resolve()),
          ),
        ),
    );
    const compactProfileHeader = await runtime.page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".app-page-header");
      const content = header?.querySelector<HTMLElement>(
        ".app-page-header-content",
      );
      const heading = header?.querySelector<HTMLElement>(".app-page-heading");
      const titleRow = heading?.querySelector<HTMLElement>(
        ".app-page-title-row",
      );
      const title = titleRow?.querySelector<HTMLElement>(".app-page-title");
      const description = heading?.querySelector<HTMLElement>(
        ".app-page-description",
      );
      const actions = header?.querySelector<HTMLElement>(".app-page-actions");
      const action = actions?.querySelector<HTMLElement>(".product-btn");
      if (
        !header ||
        !content ||
        !heading ||
        !titleRow ||
        !title ||
        !description ||
        !actions ||
        !action
      ) {
        throw new Error("Compact Profile header contract is missing");
      }

      const headerStyle = getComputedStyle(header);
      const headingStyle = getComputedStyle(heading);
      const titleRowStyle = getComputedStyle(titleRow);
      const headerRect = header.getBoundingClientRect();
      const titleRowRect = titleRow.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      const actionRect = action.getBoundingClientRect();
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        direction: titleRowStyle.flexDirection,
        wrap: titleRowStyle.flexWrap,
        actionLabel: action.textContent?.trim() ?? "",
        actionIntrinsicWidthDelta: Math.abs(
          actionsRect.width - actionRect.width,
        ),
        titleActionBottomDelta: Math.abs(actionsRect.bottom - titleRect.bottom),
        actionControlBottomDelta: Math.abs(
          actionRect.bottom - titleRect.bottom,
        ),
        actionRightInsetDelta: Math.abs(
          headerRect.right -
            Number.parseFloat(headerStyle.paddingRight) -
            actionsRect.right,
        ),
        titleActionGap: actionsRect.left - titleRect.right,
        actionsShareTitleRow:
          title.parentElement === titleRow &&
          actions.parentElement === titleRow &&
          actionsRect.top < titleRect.bottom &&
          actionsRect.bottom > titleRect.top,
        metricBelowTitleRow: descriptionRect.top >= titleRowRect.bottom - 0.5,
        metricGapDelta: Math.abs(
          descriptionRect.top -
            titleRowRect.bottom -
            Number.parseFloat(headingStyle.rowGap),
        ),
      };
    });
    assert.deepEqual(
      {
        clientWidth: compactProfileHeader.clientWidth,
        scrollWidth: compactProfileHeader.scrollWidth,
        direction: compactProfileHeader.direction,
        wrap: compactProfileHeader.wrap,
        actionLabel: compactProfileHeader.actionLabel,
        actionsShareTitleRow: compactProfileHeader.actionsShareTitleRow,
        metricBelowTitleRow: compactProfileHeader.metricBelowTitleRow,
      },
      {
        clientWidth: 484,
        scrollWidth: 484,
        direction: "row",
        wrap: "wrap",
        actionLabel: "Выход",
        actionsShareTitleRow: true,
        metricBelowTitleRow: true,
      },
    );
    assert.ok(compactProfileHeader.actionIntrinsicWidthDelta < 0.5);
    assert.ok(compactProfileHeader.titleActionBottomDelta < 0.5);
    assert.ok(compactProfileHeader.actionControlBottomDelta < 0.5);
    assert.ok(compactProfileHeader.actionRightInsetDelta < 0.5);
    assert.ok(Math.abs(compactProfileHeader.titleActionGap - 24) < 0.5);
    assert.ok(compactProfileHeader.metricGapDelta < 0.5);

    const initialProfileTabs = await runtime.page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>(".workspace-tabs-rail");
      const scroller = rail?.querySelector<HTMLElement>(
        ".workspace-tabs-scroll",
      );
      const leftControl = rail?.querySelector<HTMLButtonElement>(
        '.workspace-tabs-scroll-control[aria-label="Прокрутить вкладки влево"]',
      );
      const rightControl = rail?.querySelector<HTMLButtonElement>(
        '.workspace-tabs-scroll-control[aria-label="Прокрутить вкладки вправо"]',
      );
      if (!rail || !scroller || !leftControl || !rightControl) {
        throw new Error("Compact Profile tabs contract is missing");
      }
      return {
        overflowX: getComputedStyle(scroller).overflowX,
        scrollbarWidth: getComputedStyle(scroller).scrollbarWidth,
        scrollLeft: scroller.scrollLeft,
        overflows: scroller.scrollWidth > scroller.clientWidth,
        leftControlHidden: leftControl.hidden,
        rightControlHidden: rightControl.hidden,
        controlsOutsideTablist:
          !leftControl.closest('[role="tablist"]') &&
          !rightControl.closest('[role="tablist"]'),
      };
    });
    assert.deepEqual(initialProfileTabs, {
      overflowX: "auto",
      scrollbarWidth: "none",
      scrollLeft: 0,
      overflows: true,
      leftControlHidden: true,
      rightControlHidden: false,
      controlsOutsideTablist: true,
    });

    await runtime.page
      .getByRole("button", {
        name: "Прокрутить вкладки вправо",
        exact: true,
      })
      .click();
    await runtime.page.waitForFunction(() => {
      const scroller = document.querySelector<HTMLElement>(
        ".workspace-tabs-scroll",
      );
      return Boolean(scroller && scroller.scrollLeft > 1);
    });
    await runtime.page
      .getByRole("button", {
        name: "Прокрутить вкладки влево",
        exact: true,
      })
      .waitFor();
    const scrolledProfileTabsLeft = await runtime.page
      .locator(".workspace-tabs-scroll")
      .evaluate((scroller) => scroller.scrollLeft);
    assert.ok(scrolledProfileTabsLeft > initialProfileTabs.scrollLeft);

    await runtime.page
      .getByRole("button", {
        name: "Прокрутить вкладки влево",
        exact: true,
      })
      .click();
    await runtime.page.waitForFunction(() => {
      const scroller = document.querySelector<HTMLElement>(
        ".workspace-tabs-scroll",
      );
      const leftControl = document.querySelector<HTMLButtonElement>(
        ".workspace-tabs-scroll-control-left",
      );
      const rightControl = document.querySelector<HTMLButtonElement>(
        ".workspace-tabs-scroll-control-right",
      );
      return Boolean(
        scroller &&
        leftControl?.hidden &&
        rightControl &&
        !rightControl.hidden &&
        scroller.scrollLeft <= 1,
      );
    });
    assert.equal(
      await runtime.page
        .locator(".workspace-tabs-scroll-control-right")
        .getAttribute("hidden"),
      null,
    );
    assert.equal(
      await runtime.page
        .locator(".workspace-tabs-scroll-control-left")
        .getAttribute("hidden"),
      "",
    );

    await runtime.page.setViewportSize({ width: 1280, height: 720 });
    await runtime.page.waitForFunction(() => {
      const scroller = document.querySelector<HTMLElement>(
        ".workspace-tabs-scroll",
      );
      const leftControl = document.querySelector<HTMLButtonElement>(
        ".workspace-tabs-scroll-control-left",
      );
      const rightControl = document.querySelector<HTMLButtonElement>(
        ".workspace-tabs-scroll-control-right",
      );
      return Boolean(
        scroller &&
        leftControl?.hidden &&
        rightControl?.hidden &&
        scroller.scrollWidth <= scroller.clientWidth,
      );
    });
    assert.equal(
      await runtime.page
        .locator(".workspace-tabs-scroll-control-right")
        .getAttribute("hidden"),
      "",
    );
    assert.equal(
      await runtime.page
        .locator(".workspace-tabs-scroll-control-left")
        .getAttribute("hidden"),
      "",
    );

    await runtime.page.getByRole("tab", { name: /^История/ }).click();
    await runtime.page
      .getByText("Опубликованный комментарий для учебного профиля.", {
        exact: true,
      })
      .waitFor();
    html = await runtime.page.content();
    assert.doesNotMatch(html, /FOREIGN TRAP RECORD|Чужой курс/);
    await assertProfileSurfaceContract("История");

    await runtime.page
      .getByRole("tab", { name: /^Аттестация/, exact: false })
      .click();
    await runtime.page
      .getByText(E2E_EDUCATOR_COURSE_TITLE, { exact: true })
      .waitFor();
    assert.equal(
      await runtime.page
        .getByText("Не удалось выполнить операцию с курсом.", { exact: true })
        .count(),
      0,
    );
    await assertProfileSurfaceContract("Аттестация");

    await runtime.page
      .getByRole("tab", { name: /^Наблюдатели/, exact: false })
      .click();
    await runtime.page
      .getByRole("heading", { name: "Активные наблюдатели", exact: true })
      .waitFor();
    await assertProfileSurfaceContract("Наблюдатели");

    await runtime.page
      .getByRole("tab", { name: /^Настройки/, exact: false })
      .click();
    await runtime.page
      .getByText("Персонализация с общей историей", { exact: true })
      .waitFor();
    await assertProfileSurfaceContract("Настройки");

    assert.equal(await runtime.page.getByRole("radio").count(), 0);
    const chooseAvatarButton = runtime.page.getByRole("button", {
      name: "Выбрать аватар",
      exact: true,
    });
    await chooseAvatarButton.click();
    const avatarDialog = runtime.page.getByRole("dialog", {
      name: "Выберите аватар",
      exact: true,
    });
    await avatarDialog.waitFor();
    const presetRadios = avatarDialog.getByRole("radio");
    assert.equal(await presetRadios.count(), 20);
    await runtime.page.waitForFunction(() => {
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(
          '[role="dialog"] fieldset img',
        ),
      );
      return (
        images.length === 20 &&
        images.every(
          (image) =>
            image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
        )
      );
    });
    const presetImageContract = await avatarDialog
      .locator("fieldset img")
      .evaluateAll((images) =>
        images.map((image) => {
          const avatarImage = image as HTMLImageElement;
          return {
            complete: avatarImage.complete,
            naturalWidth: avatarImage.naturalWidth,
            naturalHeight: avatarImage.naturalHeight,
            src: avatarImage.getAttribute("src") ?? "",
          };
        }),
      );
    assert.equal(presetImageContract.length, 20);
    assert.equal(
      presetImageContract.every(
        (image) =>
          image.complete &&
          image.naturalWidth > 0 &&
          image.naturalHeight > 0 &&
          image.src.includes("/_next/image") &&
          image.src.includes("url=%2Favatars%2Fpresets%2F"),
      ),
      true,
    );
    const saveAvatarButton = avatarDialog.getByRole("button", {
      name: "Сохранить",
      exact: true,
    });
    assert.equal(await saveAvatarButton.isEnabled(), false);
    const secondPresetId = await presetRadios.nth(1).getAttribute("id");
    assert.ok(secondPresetId);
    await avatarDialog.locator(`label[for="${secondPresetId}"]`).click();
    assert.equal(await saveAvatarButton.isEnabled(), true);
    await runtime.page.keyboard.press("Escape");
    await avatarDialog.waitFor({ state: "detached" });
    assert.equal(
      await chooseAvatarButton.evaluate(
        (button) => button === document.activeElement,
      ),
      true,
    );

    await runtime.page
      .locator('input[type="file"][aria-label="Выбрать фото на компьютере"]')
      .setInputFiles(
        join(process.cwd(), "public/avatars/presets/sd-avatar-v1-02.webp"),
      );
    const uploadDialog = runtime.page.getByRole("dialog", {
      name: "Новое фото",
      exact: true,
    });
    await uploadDialog.waitFor();
    await runtime.page.waitForFunction(() => {
      const preview = document.querySelector<HTMLImageElement>(
        '[role="dialog"] img[alt="Предпросмотр нового фото"]',
      );
      return Boolean(preview?.complete && preview.naturalWidth > 0);
    });
    assert.match(
      (await uploadDialog.getByText("sd-avatar-v1-02.webp").textContent()) ??
        "",
      /sd-avatar-v1-02\.webp/,
    );
    await uploadDialog
      .getByRole("button", { name: "Отмена", exact: true })
      .click();
    await uploadDialog.waitFor({ state: "detached" });

    await runtime.page.setViewportSize({ width: 375, height: 812 });
    await chooseAvatarButton.click();
    await avatarDialog.waitFor();
    const mobileAvatarDialog = await avatarDialog.evaluate((element) => {
      const panel = element as HTMLElement;
      const grid = panel.querySelector<HTMLElement>("fieldset > div");
      if (!grid) throw new Error("Avatar preset grid is missing");
      const rect = panel.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        overflowY: getComputedStyle(panel).overflowY,
      };
    });
    assert.ok(mobileAvatarDialog.left >= 0 && mobileAvatarDialog.top >= 0);
    assert.ok(
      mobileAvatarDialog.right <= mobileAvatarDialog.viewportWidth &&
        mobileAvatarDialog.bottom <= mobileAvatarDialog.viewportHeight,
    );
    assert.equal(mobileAvatarDialog.columns, 4);
    assert.equal(mobileAvatarDialog.overflowY, "auto");
    await runtime.page.keyboard.press("Escape");
    await avatarDialog.waitFor({ state: "detached" });

    await runtime.page
      .getByRole("button", { name: "Разрешить", exact: true })
      .click();
    await runtime.page.getByText("Разрешено", { exact: true }).waitFor();
    assert.equal(e2eAiConsentStatus, "active");
    await runtime.page
      .getByRole("button", { name: "Отозвать", exact: true })
      .click();
    await runtime.page.getByText("Отозвано", { exact: true }).waitFor();
    assert.equal(e2eAiConsentStatus, "revoked");
  } finally {
    await runtime.close();
  }
});

test("browser smoke: observer reads published history only and can leave immediately", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eObservedGrantLeft = false;
  const runtime = await openPage({ cookie: authenticatedCookieValue() });
  try {
    await runtime.page.goto("/students", { waitUntil: "networkidle" });
    const observingEntryTab = runtime.page.getByRole("tab", {
      name: "Наблюдение 1",
      exact: true,
    });
    await Promise.all([
      runtime.page.waitForURL(/\/students\?tab=observing$/),
      observingEntryTab.click(),
    ]);
    await runtime.page.goto("/observing", { waitUntil: "networkidle" });
    await runtime.page.waitForURL(/\/students\?tab=observing$/);
    await runtime.page
      .getByRole("heading", { name: "Ученики", exact: true, level: 1 })
      .waitFor();
    const observingTab = runtime.page.getByRole("tab", {
      name: "Наблюдение 1",
      exact: true,
    });
    await observingTab.waitFor();
    const observingIa = await runtime.page.evaluate(() => ({
      tabSelected: document
        .querySelector("#students-directory-tab-observing")
        ?.getAttribute("aria-selected"),
      studentsCurrent: document
        .querySelector('.site-header-nav-pill[href="/students"]')
        ?.getAttribute("aria-current"),
    }));
    assert.deepEqual(observingIa, {
      tabSelected: "true",
      studentsCurrent: "page",
    });
    await runtime.page
      .getByRole("heading", { name: "Борис Волков", exact: true, level: 2 })
      .waitFor();
    const observingTabOwnership = await runtime.page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).map(
        (tab) => {
          const controls = tab.getAttribute("aria-controls") ?? "";
          const panel = controls ? document.getElementById(controls) : null;
          return {
            controls,
            panelRole: panel?.getAttribute("role") ?? "",
            labelledBy: panel?.getAttribute("aria-labelledby") ?? "",
            tabId: tab.id,
          };
        },
      ),
    );
    assert.ok(observingTabOwnership.length > 0);
    assert.equal(
      observingTabOwnership.every(
        ({ controls, panelRole, labelledBy, tabId }) =>
          Boolean(controls) && panelRole === "tabpanel" && labelledBy === tabId,
      ),
      true,
    );
    await runtime.page.getByRole("tab", { name: /^История/ }).click();
    await runtime.page
      .getByText("Опубликованный комментарий для учебного профиля.", {
        exact: true,
      })
      .waitFor();
    const html = await runtime.page.content();
    assert.doesNotMatch(
      html,
      /FOREIGN TRAP RECORD|Чужой курс|Редактировать результат|Назначить урок|Запустить урок/,
    );

    await runtime.page.evaluate(() => {
      window.confirm = () => true;
    });
    await runtime.page
      .getByRole("button", { name: "Отказаться от доступа", exact: true })
      .click();
    await runtime.page
      .getByText("Нет активного наблюдения", { exact: true })
      .waitFor();
    assert.equal(e2eObservedGrantLeft, true);
    await runtime.page
      .getByRole("tab", { name: "Наблюдение", exact: true })
      .waitFor();
    assert.equal(
      await runtime.page
        .locator("#students-directory-tab-observing .workspace-tab-count")
        .count(),
      0,
    );
  } finally {
    await runtime.close();
  }
});

test("browser smoke: observer settings accepts an incoming request and revokes owned access", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eObserverInvitationAccepted = false;
  e2eObserverGrantRevoked = false;
  e2eObserverInviteCreated = false;
  const runtime = await openPage({ cookie: authenticatedCookieValue() });
  try {
    await runtime.page.goto("/profile?tab=observers", {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByRole("heading", { name: "E2E Adult", exact: true, level: 1 })
      .waitFor();
    await runtime.page
      .getByRole("button", { name: "Отправить приглашение", exact: true })
      .waitFor();
    assert.deepEqual(
      await runtime.page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>(".course-demo-shell");
        const header = document.querySelector<HTMLElement>(
          ".site-header-shell-demo",
        );
        const userTrigger =
          header?.querySelector<HTMLElement>(".nav-profile-link");
        const userAvatar = userTrigger?.querySelector<HTMLElement>(
          ".nav-user-trigger-avatar",
        );
        const activeTab = document.querySelector<HTMLElement>(
          "#learning-profile-tab-observers",
        );
        const primaryAction = document.querySelector<HTMLElement>(
          'form .product-btn-primary[type="submit"]',
        );
        const primaryIcon = primaryAction?.querySelector<SVGElement>("svg");
        if (
          !shell ||
          !header ||
          !userTrigger ||
          !userAvatar ||
          !activeTab ||
          !primaryAction ||
          !primaryIcon
        ) {
          throw new Error("Unified observer control contract is missing");
        }
        const shellStyle = getComputedStyle(shell);
        const headerStyle = getComputedStyle(header);
        const primaryStyle = getComputedStyle(primaryAction);
        const primaryIconStyle = getComputedStyle(primaryIcon);
        const userTriggerRect = userTrigger.getBoundingClientRect();
        const userAvatarRect = userAvatar.getBoundingClientRect();
        const sectionHeadings = Array.from(
          document.querySelectorAll<HTMLHeadingElement>("h2"),
        ).map((heading) => heading.textContent?.trim() ?? "");
        return {
          shellBackground: shellStyle.backgroundColor,
          headerBackground: headerStyle.backgroundColor,
          headerBackdropFilter: headerStyle.backdropFilter,
          userControl: {
            triggerWidth: userTriggerRect.width,
            triggerHeight: userTriggerRect.height,
            avatarWidth: userAvatarRect.width,
            avatarHeight: userAvatarRect.height,
            avatarRadius: getComputedStyle(userAvatar).borderRadius,
            visibleNameCount: header.querySelectorAll(".nav-user-trigger-name")
              .length,
          },
          activeTabSelected: activeTab.getAttribute("aria-selected"),
          legacySettingsShellCount: document.querySelectorAll(
            ".settings-product-shell, .nav-settings-shell",
          ).length,
          activeObserversBeforeInvite:
            sectionHeadings.indexOf("Активные наблюдатели") >= 0 &&
            sectionHeadings.indexOf("Активные наблюдатели") <
              sectionHeadings.indexOf("Пригласить наблюдателя"),
          primaryAction: {
            height: primaryStyle.height,
            radius: primaryStyle.borderRadius,
            fontSize: primaryStyle.fontSize,
            fontWeight: primaryStyle.fontWeight,
            background: primaryStyle.backgroundColor,
            borderTopWidth: primaryStyle.borderTopWidth,
            color: primaryStyle.color,
            boxShadow: primaryStyle.boxShadow,
            transform: primaryStyle.transform,
            iconColor: primaryIconStyle.color,
            iconOpacity: primaryIconStyle.opacity,
          },
        };
      }),
      {
        shellBackground: "rgb(245, 241, 232)",
        headerBackground: "rgb(255, 255, 255)",
        headerBackdropFilter: "none",
        userControl: {
          triggerWidth: 40,
          triggerHeight: 40,
          avatarWidth: 40,
          avatarHeight: 40,
          avatarRadius: "12px",
          visibleNameCount: 0,
        },
        activeTabSelected: "true",
        legacySettingsShellCount: 0,
        activeObserversBeforeInvite: true,
        primaryAction: {
          height: "40px",
          radius: "12px",
          fontSize: "14.08px",
          fontWeight: "400",
          background: "rgb(255, 255, 255)",
          borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
          color: "rgb(20, 20, 20)",
          boxShadow: E2E_RAISED_CONTROL_SHADOW,
          transform: "none",
          iconColor: "rgb(20, 20, 20)",
          iconOpacity: "1",
        },
      },
    );
    await runtime.page
      .getByLabel("Email получателя")
      .fill("observer-e2e@example.test");
    await runtime.page.getByLabel("Свободная подпись").fill("бабушка");
    await runtime.page
      .getByRole("button", { name: "Отправить приглашение", exact: true })
      .click();
    await runtime.page.getByText(/ резервную ссылку сейчас/).waitFor();
    assert.equal(e2eObserverInviteCreated, true);
    await runtime.page.getByText("Мария Соколова", { exact: true }).waitFor();
    await runtime.page
      .getByRole("button", { name: "Принять", exact: true })
      .click();
    await runtime.page.getByText("Принято", { exact: true }).waitFor();
    assert.equal(e2eObserverInvitationAccepted, true);

    const activeObserverCard = runtime.page.locator(
      'li:has-text("Доверенный наблюдатель")',
    );
    await activeObserverCard
      .getByRole("button", { name: "Отозвать", exact: true })
      .click();
    const revokeDialog = runtime.page.getByRole("dialog", {
      name: "Отозвать доступ?",
      exact: true,
    });
    await revokeDialog.waitFor();
    await revokeDialog
      .getByRole("button", { name: "Отозвать доступ", exact: true })
      .click();
    await runtime.page
      .getByText("Наблюдателей пока нет", { exact: true })
      .waitFor();
    assert.equal(e2eObserverGrantRevoked, true);
  } finally {
    await runtime.close();
  }
});

test("browser smoke: trusted adult resets child credentials and learner revokes recovery delegate", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eRecoveryResetCompleted = false;
  e2eRecoveryDelegateRevoked = false;
  const runtime = await openPage({ cookie: authenticatedCookieValue() });
  try {
    await runtime.page.goto("/profile?tab=settings#security", {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByRole("heading", { name: "E2E Adult", exact: true, level: 1 })
      .waitFor();
    assert.equal(
      await runtime.page
        .locator("#learning-profile-tab-settings")
        .getAttribute("aria-selected"),
      "true",
    );
    await runtime.page
      .getByRole("heading", { name: "Мой PIN-код", exact: true, level: 2 })
      .waitFor();
    await runtime.page.getByText("boris-child", { exact: false }).waitFor();
    assert.deepEqual(
      await runtime.page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>("button.product-btn"),
        );
        const findButton = (label: string) =>
          buttons.find((button) => button.textContent?.trim() === label);
        const secondary = findButton("Сменить логин и PIN");
        const destructive = findButton("Отозвать право");
        if (!secondary || !destructive) {
          throw new Error("Security Settings button variants are missing");
        }
        const readButton = (button: HTMLButtonElement) => {
          const style = getComputedStyle(button);
          return {
            height: style.height,
            radius: style.borderRadius,
            fontWeight: style.fontWeight,
            background: style.backgroundColor,
            borderTopWidth: style.borderTopWidth,
            color: style.color,
            boxShadow: style.boxShadow,
          };
        };
        return {
          secondary: readButton(secondary),
          destructive: readButton(destructive),
        };
      }),
      {
        secondary: {
          height: "40px",
          radius: "12px",
          fontWeight: "400",
          background: "rgb(255, 255, 255)",
          borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
          color: "rgb(20, 20, 20)",
          boxShadow: E2E_RAISED_CONTROL_SHADOW,
        },
        destructive: {
          height: "40px",
          radius: "12px",
          fontWeight: "400",
          background: "rgb(255, 255, 255)",
          borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
          color: "rgb(190, 18, 60)",
          boxShadow: E2E_RAISED_CONTROL_SHADOW,
        },
      },
    );
    await runtime.page
      .getByRole("button", { name: "Сменить логин и PIN", exact: true })
      .click();
    await runtime.page
      .getByLabel("Новый логин учащегося")
      .fill("boris-new-login");
    await runtime.page
      .getByLabel("Новый PIN учащегося (4–8 цифр)")
      .fill("1357");
    await runtime.page
      .getByLabel("Ваш текущий пароль или PIN")
      .fill("adult-secret");
    await runtime.page
      .getByRole("button", { name: "Сохранить новые данные", exact: true })
      .click();
    await runtime.page
      .getByText(/Доступ для «Борис Волков» обновлён/)
      .waitFor();
    assert.equal(e2eRecoveryResetCompleted, true);

    await runtime.page.evaluate(() => {
      window.confirm = () => true;
    });
    await runtime.page
      .getByRole("button", { name: "Отозвать право", exact: true })
      .click();
    await runtime.page
      .getByText("Право восстановления отозвано.", { exact: true })
      .waitFor();
    await runtime.page.getByText("Право отозвано", { exact: true }).waitFor();
    assert.equal(e2eRecoveryDelegateRevoked, true);
  } finally {
    await runtime.close();
  }
});

test("browser smoke: QR creates only pending connection, archive restores, and offline creation remains explicit", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eArchivedLearnerRestored = false;
  e2eOfflineProfileCreated = false;
  const runtime = await openPage({ cookie: authenticatedCookieValue() });
  try {
    await runtime.page.goto("/students#connect-code=ABCDE-FGHIJ", {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByRole("heading", { name: "Добавить ученика", exact: true, level: 2 })
      .waitFor();
    const fragmentContract = await runtime.page.evaluate(() => ({
      hash: window.location.hash,
      code:
        document.querySelector<HTMLInputElement>("input.font-mono")?.value ??
        "",
    }));
    assert.equal(fragmentContract.hash, "");
    assert.equal(fragmentContract.code, "ABCDE-FGHIJ");
    await runtime.page.getByLabel("Имя в моём списке").fill("Ученик по QR");
    await runtime.page
      .getByRole("button", { name: "Отправить запрос", exact: true })
      .click();
    await runtime.page
      .getByText(/Запрос отправлен\. Ученик появится в активном списке/)
      .waitFor();
    await runtime.page
      .getByRole("button", { name: "Готово", exact: true })
      .click();
    await runtime.page.getByText("Новый по QR", { exact: true }).waitFor();

    const learnerSearch = runtime.page.locator(
      'input[placeholder="Найти ученика"]',
    );
    await learnerSearch.fill("Архивная");
    const learnerNameHeader = runtime.page
      .getByRole("table", {
        name: "Ученики, их статусы и группы",
        exact: true,
      })
      .getByRole("columnheader", { name: "Ученик", exact: true });
    assert.equal(
      await learnerNameHeader.getAttribute("aria-sort"),
      "ascending",
    );
    await learnerNameHeader
      .getByRole("button", { name: "Ученик", exact: true })
      .click();
    assert.equal(
      await learnerNameHeader.getAttribute("aria-sort"),
      "descending",
    );
    await runtime.page.getByText("Архивная Ольга", { exact: true }).waitFor();
    await runtime.page
      .getByRole("button", {
        name: /Действия с учеником.*Архивная Ольга/,
      })
      .click();
    await runtime.page
      .getByRole("menu")
      .getByRole("menuitem", { name: "Восстановить", exact: true })
      .click();
    await runtime.page.getByText(/Ученик снова в активном списке/).waitFor();
    assert.equal(e2eArchivedLearnerRestored, true);
    assert.equal(await learnerSearch.inputValue(), "Архивная");
    assert.equal(
      await learnerNameHeader.getAttribute("aria-sort"),
      "descending",
    );
    assert.equal(
      await runtime.page.locator(".student-directory-filter-menu").count(),
      0,
    );

    await learnerSearch.fill("");

    await runtime.page
      .getByRole("button", { name: "Новый ученик", exact: true })
      .click();
    await runtime.page
      .getByRole("button", {
        name: /Создать без аккаунта/,
        exact: false,
      })
      .click();
    await runtime.page.getByLabel("Имя в моём списке").fill("Ева без аккаунта");
    await runtime.page
      .getByRole("button", {
        name: "Создать профиль без аккаунта",
        exact: true,
      })
      .click();
    await runtime.page
      .getByText("Профиль без аккаунта создан.", { exact: true })
      .waitFor();
    await runtime.page.getByText("Ева без аккаунта", { exact: true }).waitFor();
    assert.equal(e2eOfflineProfileCreated, true);
  } finally {
    await runtime.close();
  }
});

test("browser smoke: mixed Course audience deduplicates direct and grouped learners", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.goto(`/courses/${E2E_COURSE_ID}`, {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByRole("tab", { name: "О курсе", exact: true })
      .click();
    await runtime.page
      .getByRole("heading", {
        name: "Ученики и группы курса",
        exact: true,
        level: 2,
      })
      .waitFor();
    await runtime.page
      .getByRole("group", { name: "Группы", exact: true })
      .waitFor();

    const audienceContract = await runtime.page.evaluate(() => {
      const summary = document
        .querySelector<HTMLElement>(".course-audience-summary strong")
        ?.textContent?.replace(/\s+/g, " ")
        .trim();
      const selectedGroups = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          ".course-audience-picker:first-of-type input[type='checkbox']:checked",
        ),
      ).length;
      const selectedDirectLearners = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          ".course-audience-picker:nth-of-type(2) input[type='checkbox']:checked",
        ),
      ).length;
      const audienceText = document
        .querySelector<HTMLElement>("#course-audience-section")
        ?.textContent?.replace(/\s+/g, " ")
        .trim();

      return {
        summary,
        selectedGroups,
        selectedDirectLearners,
        audienceText,
        hasDialog: Boolean(document.querySelector("[role='dialog']")),
      };
    });

    assert.equal(
      audienceContract.summary,
      "Выбрано: 1 группа, 1 ученик отдельно · 2 ученика в курсе",
    );
    assert.equal(audienceContract.selectedGroups, 1);
    assert.equal(audienceContract.selectedDirectLearners, 1);
    assert.equal(audienceContract.hasDialog, false);
    assert.match(
      audienceContract.audienceText ?? "",
      /Уже входит через: Teen Talk/,
    );
    assert.match(
      audienceContract.audienceText ?? "",
      /ИИ будет учитывать уникальные профили/,
    );
  } finally {
    await runtime.close();
  }
});

test("browser smoke: completion UI keeps private comments teacher-only and publishes explicit comments", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  resetE2eCompletionFlow();
  e2eObservedGrantLeft = false;
  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  async function completeVisibleRun(input: {
    report: string;
    selfComment: string;
    publishSelf: boolean;
    observedComment: string;
    publishObserved: boolean;
  }) {
    const runLessonRow = runtime.page.locator(
      `[aria-label="Таблица уроков курса"] tbody tr:has-text("${E2E_LESSON_TITLE}")`,
    );
    await runLessonRow
      .getByRole("button", {
        name: `Действия с уроком «${E2E_LESSON_TITLE}»`,
        exact: true,
      })
      .click();
    await runtime.page
      .getByRole("menuitem", {
        name: "Завершить урок",
        exact: true,
      })
      .click();
    const dialog = runtime.page.getByRole("dialog", {
      name: "Завершить урок",
      exact: true,
    });
    await dialog.waitFor();
    await dialog.getByLabel("Как прошёл урок").fill(input.report);
    await dialog.getByLabel("Фактическая длительность, минут").fill("45");

    for (const learnerLabel of ["E2E Adult", "Борис Волков"]) {
      await dialog
        .getByRole("group", {
          name: `Посещаемость: ${learnerLabel}`,
          exact: true,
        })
        .getByRole("radio", { name: "Был на уроке", exact: true })
        .check();
    }
    await dialog
      .getByLabel("Комментарий об ученике E2E Adult")
      .fill(input.selfComment);
    await dialog
      .getByLabel("Комментарий об ученике Борис Волков")
      .fill(input.observedComment);
    if (input.publishSelf) {
      await dialog
        .getByLabel("Добавить комментарий E2E Adult в учебный профиль")
        .check();
    }
    if (input.publishObserved) {
      await dialog
        .getByLabel("Добавить комментарий Борис Волков в учебный профиль")
        .check();
    }
    await dialog
      .getByRole("button", { name: "Завершить и сохранить", exact: true })
      .click();
    try {
      await dialog.waitFor({ state: "hidden", timeout: 10_000 });
    } catch {
      const alert = await runtime.page.evaluate(
        () =>
          document
            .querySelector<HTMLElement>("[role='dialog'] [role='alert']")
            ?.textContent?.trim() ?? "completion dialog stayed open",
      );
      assert.fail(alert);
    }
  }

  try {
    await runtime.page.goto(`/courses/${E2E_COURSE_ID}`, {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByRole("heading", { name: E2E_COURSE_TITLE, exact: true, level: 1 })
      .waitFor();

    await completeVisibleRun({
      report: "Первое завершение: приватный self, опубликованный observer.",
      selfComment: E2E_PRIVATE_SELF_COMMENT,
      publishSelf: false,
      observedComment: E2E_PUBLISHED_OBSERVED_COMMENT,
      publishObserved: true,
    });
    await completeVisibleRun({
      report: "Второе завершение: опубликованный self, приватный observer.",
      selfComment: E2E_PUBLISHED_SELF_COMMENT,
      publishSelf: true,
      observedComment: E2E_PRIVATE_OBSERVED_COMMENT,
      publishObserved: false,
    });

    assert.equal(e2eCompletionPayloads.length, 2);
    assert.deepEqual(
      e2eCompletionPayloads.map((payload) => ({
        runId: payload.p_lesson_run_id,
        actualDurationMinutes: payload.p_actual_duration_minutes,
        records: [...payload.p_records]
          .map((record) => ({
            learnerProfileId: record.learnerProfileId,
            teacherComment: record.teacherComment,
            shareWithLearner: record.shareWithLearner,
          }))
          .sort((left, right) =>
            left.learnerProfileId.localeCompare(right.learnerProfileId),
          ),
      })),
      [
        {
          runId: E2E_COMPLETION_PRIVATE_RUN_ID,
          actualDurationMinutes: 45,
          records: [
            {
              learnerProfileId: E2E_LEARNER_BORIS_ID,
              teacherComment: E2E_PUBLISHED_OBSERVED_COMMENT,
              shareWithLearner: true,
            },
            {
              learnerProfileId: E2E_SELF_LEARNER_ID,
              teacherComment: E2E_PRIVATE_SELF_COMMENT,
              shareWithLearner: false,
            },
          ],
        },
        {
          runId: E2E_COMPLETION_PUBLISHED_RUN_ID,
          actualDurationMinutes: 45,
          records: [
            {
              learnerProfileId: E2E_LEARNER_BORIS_ID,
              teacherComment: E2E_PRIVATE_OBSERVED_COMMENT,
              shareWithLearner: false,
            },
            {
              learnerProfileId: E2E_SELF_LEARNER_ID,
              teacherComment: E2E_PUBLISHED_SELF_COMMENT,
              shareWithLearner: true,
            },
          ],
        },
      ],
    );

    await runtime.page
      .getByRole("tab", { name: "История", exact: true })
      .click();
    await runtime.page
      .getByText(E2E_PRIVATE_SELF_COMMENT, { exact: false })
      .waitFor();
    let html = await runtime.page.content();
    assert.match(html, new RegExp(E2E_PRIVATE_SELF_COMMENT));
    assert.match(html, new RegExp(E2E_PRIVATE_OBSERVED_COMMENT));
    assert.match(html, new RegExp(E2E_PUBLISHED_SELF_COMMENT));
    assert.match(html, new RegExp(E2E_PUBLISHED_OBSERVED_COMMENT));
    assert.match(html, /Только преподавателю/);
    assert.match(html, /Опубликован в учебном профиле/);

    await runtime.page.goto("/profile", { waitUntil: "networkidle" });
    await runtime.page.getByRole("tab", { name: /^История/ }).click();
    await runtime.page
      .getByText(E2E_PUBLISHED_SELF_COMMENT, { exact: true })
      .waitFor();
    html = await runtime.page.content();
    assert.doesNotMatch(
      html,
      new RegExp(
        `${E2E_PRIVATE_SELF_COMMENT}|${E2E_PRIVATE_OBSERVED_COMMENT}|${E2E_PUBLISHED_OBSERVED_COMMENT}`,
      ),
    );

    await runtime.page.goto("/observing", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", { name: "Борис Волков", exact: true, level: 2 })
      .waitFor();
    await runtime.page.getByRole("tab", { name: /^История/ }).click();
    await runtime.page
      .getByText(E2E_PUBLISHED_OBSERVED_COMMENT, { exact: true })
      .waitFor();
    html = await runtime.page.content();
    assert.doesNotMatch(
      html,
      new RegExp(
        `${E2E_PRIVATE_SELF_COMMENT}|${E2E_PRIVATE_OBSERVED_COMMENT}|${E2E_PUBLISHED_SELF_COMMENT}`,
      ),
    );
  } finally {
    e2eCompletionPhase = null;
    e2eCompletionPayloads.length = 0;
    e2eCompletedLearningRecordRows.length = 0;
    await runtime.close();
  }
});

test("browser smoke: copied invitation strips its fragment and supports merge cancel and confirm", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const rawToken = "browser-manual-secret-1234567890";
  e2eMergeStatus = "pending";
  e2eSupabaseReferers.length = 0;
  {
    const runtime = await openPage({ cookie: authenticatedCookieValue() });
    try {
      await runtime.page.goto(
        `/identity/invitations/${E2E_MERGE_INVITATION_ID}#kind=profile&token=${rawToken}`,
        { waitUntil: "networkidle" },
      );
      await runtime.page.getByText("Анна", { exact: true }).waitFor();
      const secretContract = await runtime.page.evaluate(() => ({
        hash: window.location.hash,
        search: window.location.search,
        stored: window.sessionStorage.getItem(
          `shidao.identity-invitation.${window.location.pathname.split("/").at(-1)}`,
        ),
      }));
      assert.equal(secretContract.hash, "");
      assert.equal(secretContract.search, "");
      assert.match(secretContract.stored ?? "", new RegExp(rawToken));
      await runtime.page
        .getByRole("button", {
          name: "Проверить объединение",
          exact: true,
        })
        .click();
      await runtime.page
        .getByRole("heading", {
          name: "Проверка необратимого объединения",
          exact: true,
          level: 2,
        })
        .waitFor();
      await runtime.page
        .getByRole("button", { name: "Не объединять", exact: true })
        .click();
      await runtime.page
        .getByRole("heading", {
          name: "Объединение отменено",
          exact: true,
          level: 2,
        })
        .waitFor();
      assert.equal(e2eMergeStatus, "cancelled");
    } finally {
      await runtime.close();
    }
  }

  e2eMergeStatus = "pending";
  {
    const runtime = await openPage({ cookie: authenticatedCookieValue() });
    try {
      await runtime.page.goto(
        `/identity/invitations/${E2E_MERGE_INVITATION_ID}#kind=profile&token=${rawToken}`,
        { waitUntil: "networkidle" },
      );
      await runtime.page
        .getByRole("button", {
          name: "Проверить объединение",
          exact: true,
        })
        .click();
      await runtime.page
        .getByRole("button", {
          name: "Подтвердить объединение",
          exact: true,
        })
        .click();
      await runtime.page
        .getByRole("heading", {
          name: "Учебные результаты объединены",
          exact: true,
          level: 2,
        })
        .waitFor();
      assert.equal(e2eMergeStatus, "completed");
    } finally {
      await runtime.close();
    }
  }

  assert.equal(
    e2eSupabaseReferers.some((referer) => referer.includes(rawToken)),
    false,
  );
});

test("browser smoke: verified email handoff survives navigation and is consumed on terminal action", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage();
  try {
    const next = `/identity/invitations/${E2E_PROFILE_INVITATION_ID}`;
    const callback = new URL(
      "/auth/confirm",
      `https://v2.shidao.ru:${browserProxyPort}`,
    );
    callback.searchParams.set("token_hash", "browser-verified-email-hash");
    callback.searchParams.set("type", "invite");
    callback.searchParams.set("next", next);
    callback.searchParams.set("identity_invitation", E2E_PROFILE_INVITATION_ID);
    callback.searchParams.set("identity_kind", "profile");
    await runtime.page.goto(callback.toString(), { waitUntil: "networkidle" });
    await runtime.page.getByText("Анна", { exact: true }).waitFor();
    assert.equal(new URL(runtime.page.url()).hash, "");
    assert.equal(new URL(runtime.page.url()).searchParams.has("token"), false);

    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page.goto(`${next}?kind=profile`, {
      waitUntil: "networkidle",
    });
    await runtime.page.getByText("Анна", { exact: true }).waitFor();
    await runtime.page
      .getByRole("button", { name: "Отклонить", exact: true })
      .click();
    await runtime.page
      .getByRole("heading", { name: "Готово", exact: true, level: 2 })
      .waitFor();

    await runtime.page.goto(`${next}?kind=profile`, {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByText("Запрос недоступен или больше не существует.", {
        exact: true,
      })
      .waitFor();

    const pageResponse = await requestLocalApp(next);
    assert.match(pageResponse.headers["cache-control"] ?? "", /no-store/);
    assert.equal(pageResponse.headers["referrer-policy"], "no-referrer");
  } finally {
    await runtime.close();
  }
});

test("browser smoke: child activation creates a separate login with acknowledged recovery delegate", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eChildActivationAcknowledged = false;
  const runtime = await openPage({ cookie: authenticatedCookieValue() });
  try {
    await runtime.page.goto(
      `/identity/invitations/${E2E_CHILD_INVITATION_ID}#kind=profile&token=browser-child-secret-1234567890`,
      { waitUntil: "networkidle" },
    );
    await runtime.page.getByText("Борис", { exact: true }).waitFor();
    await runtime.page
      .getByLabel("Уникальный login учащегося")
      .fill("boris-child");
    await runtime.page.getByLabel("PIN учащегося (4–8 цифр)").fill("2468");
    await runtime.page
      .getByRole("checkbox", {
        name: /Я понимаю, что стану доверенным взрослым/,
      })
      .check();
    await runtime.page
      .getByLabel("Подтвердите вход текущим паролем или PIN")
      .fill("adult-secret");
    await runtime.page
      .getByRole("button", {
        name: "Создать отдельный аккаунт",
        exact: true,
      })
      .click();
    await runtime.page.getByText("boris-child", { exact: true }).waitFor();
    await runtime.page
      .getByText(/Вы стали доверенным взрослым для восстановления/)
      .waitFor();
    const html = await runtime.page.content();
    assert.match(html, /наблюдение подключается отдельно/i);
    assert.match(html, /E2E Adult/);
    assert.equal(e2eChildActivationAcknowledged, true);
  } finally {
    await runtime.close();
  }
});

test("browser smoke: mobile Account menu exposes main sections and Profile", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eCompletionPhase = null;
  e2eScheduleFixtureVisible = false;
  e2eArchivedLearnerRestored = false;
  const runtime = await openPage({
    cookie: authenticatedCookieValue(),
    viewport: { width: 375, height: 812 },
    mobile: true,
  });

  try {
    await runtime.page.clock.setFixedTime("2026-08-11T00:00:00.000Z");
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", { name: "Занятий нет", exact: true, level: 2 })
      .waitFor();
    assertMobileEditableContract(
      await readMobileEditableContract(runtime.page),
      375,
      "Schedule at 375px",
    );

    const mobileMenuTrigger = runtime.page.getByRole("button", {
      name: "Открыть меню аккаунта",
      exact: true,
    });
    await mobileMenuTrigger.waitFor();
    assert.deepEqual(
      await runtime.page.evaluate(() => {
        const header = document.querySelector<HTMLElement>(
          ".site-header-shell-demo",
        );
        const trigger = document.querySelector<HTMLElement>(
          ".nav-account-menu-trigger",
        );
        if (!header || !trigger) {
          throw new Error("Mobile header surface contract is missing");
        }
        const headerStyle = getComputedStyle(header);
        const triggerStyle = getComputedStyle(trigger);
        return {
          inputMode: {
            coarsePointer: matchMedia("(pointer: coarse)").matches,
            noHover: matchMedia("(hover: none)").matches,
          },
          header: {
            backgroundColor: headerStyle.backgroundColor,
            backgroundImage: headerStyle.backgroundImage,
            backdropFilter: headerStyle.backdropFilter,
            opacity: headerStyle.opacity,
          },
          closedTrigger: {
            expanded: trigger.getAttribute("aria-expanded"),
            backgroundColor: triggerStyle.backgroundColor,
            backgroundImage: triggerStyle.backgroundImage,
            boxShadow: triggerStyle.boxShadow,
          },
        };
      }),
      {
        inputMode: {
          coarsePointer: true,
          noHover: true,
        },
        header: {
          backgroundColor: "rgb(255, 255, 255)",
          backgroundImage: "none",
          backdropFilter: "none",
          opacity: "1",
        },
        closedTrigger: {
          expanded: "false",
          backgroundColor: "rgb(255, 255, 255)",
          backgroundImage: "none",
          boxShadow: "none",
        },
      },
    );
    await mobileMenuTrigger.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await mobileMenuTrigger.evaluate((trigger) => {
        const style = getComputedStyle(trigger);
        return {
          expanded: trigger.getAttribute("aria-expanded"),
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
        };
      }),
      {
        expanded: "false",
        backgroundColor: "rgb(255, 255, 255)",
        boxShadow: "none",
      },
    );
    await runtime.page.mouse.move(1, 300);

    const mobileScheduleContract = await runtime.page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(
        ".teaching-hub-toolbar",
      );
      const toolbarActions = toolbar?.querySelector<HTMLElement>(
        ".teaching-schedule-toolbar-actions",
      );
      const navigator = document.querySelector<HTMLElement>(
        ".teaching-date-navigator",
      );
      const picker = document.querySelector<HTMLElement>(
        ".teaching-date-picker",
      );
      const dateTrigger = navigator?.querySelector<HTMLElement>(
        ".teaching-date-trigger",
      );
      const viewToggle = document.querySelector<HTMLElement>(
        ".teaching-schedule-view-toggle",
      );
      const selectedViewOption = viewToggle?.querySelector<HTMLElement>(
        'button[aria-pressed="true"]',
      );
      const inactiveViewOption = viewToggle?.querySelector<HTMLElement>(
        'button[aria-pressed="false"]',
      );
      const siteHeader = document.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );
      const primaryAction = document.querySelector<HTMLElement>(
        ".app-page-header .app-page-actions > .product-btn",
      );
      const emptyCard = document.querySelector<HTMLElement>(
        ".teaching-schedule-empty.surface-card",
      );
      if (
        !toolbar ||
        !toolbarActions ||
        !navigator ||
        !picker ||
        !dateTrigger ||
        !viewToggle ||
        !selectedViewOption ||
        !inactiveViewOption ||
        !siteHeader ||
        !primaryAction ||
        !emptyCard
      ) {
        throw new Error("Mobile schedule controls are missing");
      }
      const readOpaqueWhiteSurface = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          opacity: style.opacity,
          backdropFilter: style.backdropFilter,
        };
      };
      const readTouchSegmentedControl = (
        group: HTMLElement,
        selected: HTMLElement,
        inactive: HTMLElement,
        referenceButton: HTMLElement,
      ) => {
        const groupRect = group.getBoundingClientRect();
        const groupStyle = getComputedStyle(group);
        const groupBeforeStyle = getComputedStyle(group, "::before");
        const selectedStyle = getComputedStyle(selected);
        const selectedBeforeStyle = getComputedStyle(selected, "::before");
        const inactiveStyle = getComputedStyle(inactive);
        const inactiveBeforeStyle = getComputedStyle(inactive, "::before");
        const indicator = group.querySelector<HTMLElement>(
          ".product-segmented-control-indicator",
        );
        if (!indicator) {
          throw new Error("Mobile segmented indicator is missing");
        }
        const indicatorStyle = getComputedStyle(indicator);
        const indicatorRect = indicator.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();
        const options = Array.from(
          group.querySelectorAll<HTMLElement>("button"),
        );
        const optionRects = options.map((button) =>
          button.getBoundingClientRect(),
        );
        const readSurface = (element: HTMLElement) => {
          const style = getComputedStyle(element);
          return {
            borderTopWidth: style.borderTopWidth,
            borderTopStyle: style.borderTopStyle,
            borderTopColor: style.borderTopColor,
            borderRadius: style.borderRadius,
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            backgroundClip: style.backgroundClip,
            boxShadow: style.boxShadow,
          };
        };
        const readGlyph = (icon: SVGElement) => {
          const rect = icon.getBoundingClientRect();
          const strokePart = icon.querySelector<SVGElement>(
            "path, line, polyline, polygon, circle, ellipse, rect",
          );
          const strokeStyle = getComputedStyle(strokePart ?? icon);
          return {
            width: rect.width,
            height: rect.height,
            strokeWidth: strokeStyle.strokeWidth,
            vectorEffect: strokeStyle.vectorEffect,
          };
        };
        return {
          group: {
            width: groupRect.width,
            height: groupRect.height,
            padding: groupStyle.padding,
            gap: groupStyle.gap,
            borderTopWidth: groupStyle.borderTopWidth,
            borderTopStyle: groupStyle.borderTopStyle,
            borderTopColor: groupStyle.borderTopColor,
            borderRadius: groupStyle.borderRadius,
            backgroundColor: groupStyle.backgroundColor,
            backgroundClip: groupStyle.backgroundClip,
            boxShadow: groupStyle.boxShadow,
          },
          groupIndicatorReady: group.getAttribute("data-indicator-ready"),
          groupBeforeContent: groupBeforeStyle.content,
          indicatorCount: group.querySelectorAll(
            ".product-segmented-control-indicator",
          ).length,
          indicator: {
            surface: readSurface(indicator),
            width: indicatorRect.width,
            height: indicatorRect.height,
            opacity: indicatorStyle.opacity,
            display: indicatorStyle.display,
            pointerEvents: indicatorStyle.pointerEvents,
            backdropFilter: indicatorStyle.backdropFilter,
            zIndex: indicatorStyle.zIndex,
            ariaHidden: indicator.getAttribute("aria-hidden"),
            ready: indicator.getAttribute("data-ready"),
            motionReady: indicator.getAttribute("data-motion-ready"),
            transitionProperty: indicatorStyle.transitionProperty,
            transitionDuration: indicatorStyle.transitionDuration,
            transitionTimingFunction: indicatorStyle.transitionTimingFunction,
            selectedStartDelta: Math.abs(
              indicatorRect.left - selectedRect.left,
            ),
            selectedTopDelta: Math.abs(indicatorRect.top - selectedRect.top),
            selectedWidthDelta: Math.abs(
              indicatorRect.width - selectedRect.width,
            ),
            selectedHeightDelta: Math.abs(
              indicatorRect.height - selectedRect.height,
            ),
          },
          optionWidths: optionRects.map((rect) => rect.width),
          optionHeights: optionRects.map((rect) => rect.height),
          seamGaps: optionRects
            .slice(1)
            .map((rect, index) =>
              Number((rect.left - optionRects[index]!.right).toFixed(3)),
            ),
          optionRadii: options.map(
            (button) => getComputedStyle(button).borderRadius,
          ),
          iconStyles: Array.from(
            group.querySelectorAll<SVGElement>("button svg.lucide"),
          ).map(readGlyph),
          referenceButton: readSurface(referenceButton),
          selected: {
            surface: readSurface(selected),
            transform: selectedStyle.transform,
            beforeContent: selectedBeforeStyle.content,
          },
          inactive: {
            borderTopWidth: inactiveStyle.borderTopWidth,
            borderTopStyle: inactiveStyle.borderTopStyle,
            backgroundColor: inactiveStyle.backgroundColor,
            backgroundImage: inactiveStyle.backgroundImage,
            boxShadow: inactiveStyle.boxShadow,
            transform: inactiveStyle.transform,
            beforeContent: inactiveBeforeStyle.content,
          },
        };
      };
      const readGlyph = (icon: SVGElement) => {
        const rect = icon.getBoundingClientRect();
        const strokePart = icon.querySelector<SVGElement>(
          "path, line, polyline, polygon, circle, ellipse, rect",
        );
        const strokeStyle = getComputedStyle(strokePart ?? icon);
        return {
          width: rect.width,
          height: rect.height,
          strokeWidth: strokeStyle.strokeWidth,
          vectorEffect: strokeStyle.vectorEffect,
        };
      };
      const viewportWidth = document.documentElement.clientWidth;
      const toolbarStyle = getComputedStyle(toolbar);
      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarActionsRect = toolbarActions.getBoundingClientRect();
      const controls = [picker, navigator, viewToggle].map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      });
      return {
        clientWidth: viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        controlsInsideViewport: controls.every(
          ({ left, right }) => left >= 0 && right <= viewportWidth,
        ),
        toolbarPaddingLeft: toolbarStyle.paddingLeft,
        toolbarPaddingRight: toolbarStyle.paddingRight,
        controlsStartInset: toolbarActionsRect.left - toolbarRect.left,
        controlsEndInset: toolbarRect.right - toolbarActionsRect.right,
        externalPeriodSwitchCount: document.querySelectorAll(
          ".teaching-schedule-period-switch",
        ).length,
        primaryActionHeight: primaryAction.getBoundingClientRect().height,
        primaryActionFontSize: getComputedStyle(primaryAction).fontSize,
        navigatorHeight: navigator.getBoundingClientRect().height,
        dateTriggerFontSize: getComputedStyle(dateTrigger).fontSize,
        viewToggleHeight: viewToggle.getBoundingClientRect().height,
        viewTogglePadding: getComputedStyle(viewToggle).padding,
        viewToggleButtonHeights: Array.from(
          viewToggle.querySelectorAll<HTMLElement>("button"),
        ).map((button) => button.getBoundingClientRect().height),
        viewToggleIconSizes: Array.from(
          viewToggle.querySelectorAll<SVGElement>("button svg"),
        ).map((icon) => {
          const rect = icon.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
        whiteSurfaces: {
          header: readOpaqueWhiteSurface(siteHeader),
          primaryAction: readOpaqueWhiteSurface(primaryAction),
          emptyCard: readOpaqueWhiteSurface(emptyCard),
          dateNavigator: readOpaqueWhiteSurface(navigator),
        },
        iconMatrix: {
          primaryAction: readGlyph(
            primaryAction.querySelector<SVGElement>("svg.lucide")!,
          ),
          dateNavigator: Array.from(
            navigator.querySelectorAll<SVGElement>("svg.lucide"),
          )
            .filter((icon) => icon.getClientRects().length > 0)
            .map(readGlyph),
          viewToggle: Array.from(
            viewToggle.querySelectorAll<SVGElement>("svg.lucide"),
          ).map(readGlyph),
        },
        viewToggle: readTouchSegmentedControl(
          viewToggle,
          selectedViewOption,
          inactiveViewOption,
          primaryAction,
        ),
      };
    });
    assert.deepEqual(
      {
        clientWidth: mobileScheduleContract.clientWidth,
        scrollWidth: mobileScheduleContract.scrollWidth,
        controlsInsideViewport: mobileScheduleContract.controlsInsideViewport,
        toolbarPaddingLeft: mobileScheduleContract.toolbarPaddingLeft,
        toolbarPaddingRight: mobileScheduleContract.toolbarPaddingRight,
        controlsStartInset: mobileScheduleContract.controlsStartInset,
        controlsEndInset: mobileScheduleContract.controlsEndInset,
        externalPeriodSwitchCount:
          mobileScheduleContract.externalPeriodSwitchCount,
        primaryActionHeight: mobileScheduleContract.primaryActionHeight,
        primaryActionFontSize: mobileScheduleContract.primaryActionFontSize,
        navigatorHeight: mobileScheduleContract.navigatorHeight,
        dateTriggerFontSize: mobileScheduleContract.dateTriggerFontSize,
        viewToggleHeight: mobileScheduleContract.viewToggleHeight,
        viewTogglePadding: mobileScheduleContract.viewTogglePadding,
        viewToggleButtonHeights: mobileScheduleContract.viewToggleButtonHeights,
        viewToggleIconSizes: mobileScheduleContract.viewToggleIconSizes,
      },
      {
        clientWidth: 375,
        scrollWidth: 375,
        controlsInsideViewport: true,
        toolbarPaddingLeft: "0px",
        toolbarPaddingRight: "0px",
        controlsStartInset: 0,
        controlsEndInset: 0,
        externalPeriodSwitchCount: 0,
        primaryActionHeight: 40,
        primaryActionFontSize: "14.08px",
        navigatorHeight: 40,
        dateTriggerFontSize: "14.08px",
        viewToggleHeight: 40,
        viewTogglePadding: "0px",
        viewToggleButtonHeights: [38, 38],
        viewToggleIconSizes: [
          { width: 16, height: 16 },
          { width: 16, height: 16 },
        ],
      },
    );
    assert.deepEqual(mobileScheduleContract.iconMatrix.primaryAction, {
      width: 16,
      height: 16,
      strokeWidth: "2px",
      vectorEffect: "none",
    });
    assert.ok(mobileScheduleContract.iconMatrix.dateNavigator.length >= 3);
    for (const glyph of [
      ...mobileScheduleContract.iconMatrix.dateNavigator,
      ...mobileScheduleContract.iconMatrix.viewToggle,
    ]) {
      assert.deepEqual(glyph, {
        width: 16,
        height: 16,
        strokeWidth: "2px",
        vectorEffect: "none",
      });
    }
    for (const [surfaceName, surface] of Object.entries(
      mobileScheduleContract.whiteSurfaces,
    )) {
      assertOpaqueWhiteSurface(surface, `Schedule mobile ${surfaceName}`);
    }
    assertTouchSegmentedControl(
      mobileScheduleContract.viewToggle,
      "Schedule mobile view toggle",
    );
    await assertSegmentedIndicatorPaintsOuterShadow(
      runtime.page,
      "Вид занятий",
      "Schedule mobile view indicator",
    );
    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Вид занятий",
      optionName: "Показать карточками",
      label: "Schedule mobile table-to-cards",
    });
    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Вид занятий",
      optionName: "Показать таблицей",
      label: "Schedule mobile cards-to-table",
    });
    await runtime.page.emulateMedia({ reducedMotion: "reduce" });
    const reducedMotionSegmentedTransitions = await runtime.page
      .locator(".teaching-schedule-view-toggle button")
      .evaluateAll((options) =>
        options.map((option) => {
          const style = getComputedStyle(option);
          const rect = option.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            transitionProperty: style.transitionProperty,
            transitionDurationSeconds: Number.parseFloat(
              style.transitionDuration,
            ),
            transitionDelaySeconds: Number.parseFloat(style.transitionDelay),
          };
        }),
      );
    assert.equal(reducedMotionSegmentedTransitions.length, 2);
    assert.ok(
      reducedMotionSegmentedTransitions.every(
        ({
          transitionProperty,
          transitionDurationSeconds,
          transitionDelaySeconds,
          width,
          height,
        }) =>
          width === 38 &&
          height === 38 &&
          transitionProperty === "none" &&
          transitionDurationSeconds <= 0.00001 &&
          transitionDelaySeconds === 0,
      ),
      "Schedule mobile segmented options must stop transitioning under reduced motion",
    );
    const reducedMotionIndicatorContract = await runtime.page
      .getByRole("group", { name: "Вид занятий", exact: true })
      .evaluate(async (group) => {
        const root = group as HTMLElement;
        const indicator = root.querySelector<HTMLElement>(
          ".product-segmented-control-indicator",
        );
        const target = root.querySelector<HTMLButtonElement>(
          'button[aria-label="Показать карточками"]',
        );
        if (!indicator || !target) {
          throw new Error("Reduced-motion Schedule indicator is missing");
        }
        target.click();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        const selected = root.querySelector<HTMLButtonElement>(
          'button[aria-pressed="true"]',
        );
        if (!selected) {
          throw new Error("Reduced-motion Schedule selection is missing");
        }
        const indicatorStyle = getComputedStyle(indicator);
        const indicatorRect = indicator.getBoundingClientRect();
        const selectedRect = selected.getBoundingClientRect();
        return {
          transitionProperty: indicatorStyle.transitionProperty,
          transitionDuration: indicatorStyle.transitionDuration,
          animationCount: indicator.getAnimations().length,
          boxShadow: indicatorStyle.boxShadow,
          selectedLabel: selected.getAttribute("aria-label"),
          startDelta: Math.abs(indicatorRect.left - selectedRect.left),
          topDelta: Math.abs(indicatorRect.top - selectedRect.top),
          widthDelta: Math.abs(indicatorRect.width - selectedRect.width),
          heightDelta: Math.abs(indicatorRect.height - selectedRect.height),
        };
      });
    assert.equal(reducedMotionIndicatorContract.transitionProperty, "none");
    assert.ok(
      Number.parseFloat(reducedMotionIndicatorContract.transitionDuration) <=
        0.00001,
    );
    assert.equal(reducedMotionIndicatorContract.animationCount, 0);
    assertSegmentedSurfaceShadow(
      reducedMotionIndicatorContract.boxShadow,
      E2E_RAISED_CONTROL_SHADOW,
      "Schedule reduced-motion indicator shadow",
    );
    assert.equal(
      reducedMotionIndicatorContract.selectedLabel,
      "Показать карточками",
    );
    assert.ok(
      [
        reducedMotionIndicatorContract.startDelta,
        reducedMotionIndicatorContract.topDelta,
        reducedMotionIndicatorContract.widthDelta,
        reducedMotionIndicatorContract.heightDelta,
      ].every((delta) => delta < 0.5),
      "Schedule reduced-motion indicator must align instantly",
    );
    await runtime.page
      .getByRole("button", { name: "Показать таблицей", exact: true })
      .click();
    await settleSegmentedIndicator(runtime.page, "Вид занятий");
    await runtime.page.emulateMedia({ reducedMotion: "no-preference" });
    const mobileSelectedViewOption = runtime.page.locator(
      '.teaching-schedule-view-toggle button[aria-pressed="true"]',
    );
    await mobileSelectedViewOption.hover();
    await runtime.page.waitForTimeout(220);
    const mobileSelectedViewHover = await mobileSelectedViewOption.evaluate(
      (option) => {
        const indicator = option
          .closest('[role="group"]')
          ?.querySelector<HTMLElement>(".product-segmented-control-indicator");
        if (!indicator) throw new Error("Schedule indicator is missing");
        const style = getComputedStyle(option);
        return {
          backgroundColor: style.backgroundColor,
          optionBoxShadow: style.boxShadow,
          indicatorBoxShadow: getComputedStyle(indicator).boxShadow,
          transform: style.transform,
        };
      },
    );
    assert.deepEqual(
      {
        backgroundColor: mobileSelectedViewHover.backgroundColor,
        optionBoxShadow: mobileSelectedViewHover.optionBoxShadow,
        transform: mobileSelectedViewHover.transform,
      },
      {
        backgroundColor: "rgba(0, 0, 0, 0)",
        optionBoxShadow: "none",
        transform: "none",
      },
    );
    assertSegmentedSurfaceShadow(
      mobileSelectedViewHover.indicatorBoxShadow,
      E2E_RAISED_CONTROL_SHADOW,
      "Schedule mobile hovered selected indicator",
    );
    await runtime.page.mouse.move(1, 300);

    const mobileDateTrigger = runtime.page.locator(".teaching-date-trigger");
    await mobileDateTrigger.click();
    await runtime.page.getByRole("dialog").waitFor();
    const mobilePopoverContract = await runtime.page.evaluate(() => {
      const popover = document.querySelector<HTMLElement>(
        ".teaching-date-popover",
      );
      const periodSwitch = document.querySelector<HTMLElement>(
        ".teaching-date-period-switch",
      );
      if (!popover || !periodSwitch) {
        throw new Error("Mobile schedule calendar is missing");
      }
      const viewportWidth = document.documentElement.clientWidth;
      const rect = popover.getBoundingClientRect();
      return {
        clientWidth: viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        popoverInsideViewport:
          rect.left >= 0 && rect.right <= viewportWidth && rect.width > 300,
        periodLabels: Array.from(periodSwitch.querySelectorAll("button")).map(
          (button) => button.textContent?.trim() ?? "",
        ),
        periodSwitchHeight: periodSwitch.getBoundingClientRect().height,
        periodSwitchWidth: periodSwitch.getBoundingClientRect().width,
        periodSwitchPadding: getComputedStyle(periodSwitch).padding,
        periodSwitchGap: getComputedStyle(periodSwitch).gap,
        periodSwitchBorderTopWidth:
          getComputedStyle(periodSwitch).borderTopWidth,
        periodSwitchBorderTopStyle:
          getComputedStyle(periodSwitch).borderTopStyle,
        periodSwitchBorderTopColor:
          getComputedStyle(periodSwitch).borderTopColor,
        periodSwitchBackgroundClip:
          getComputedStyle(periodSwitch).backgroundClip,
        periodSwitchBeforeContent: getComputedStyle(periodSwitch, "::before")
          .content,
        periodButtonHeights: Array.from(
          periodSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => button.getBoundingClientRect().height),
        periodButtonFontSizes: Array.from(
          periodSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => getComputedStyle(button).fontSize),
      };
    });
    assert.deepEqual(mobilePopoverContract, {
      clientWidth: 375,
      scrollWidth: 375,
      popoverInsideViewport: true,
      periodLabels: ["День", "Неделя", "Месяц"],
      periodSwitchHeight: 40,
      periodSwitchWidth: mobilePopoverContract.periodSwitchWidth,
      periodSwitchPadding: "0px",
      periodSwitchGap: "2px",
      periodSwitchBorderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      periodSwitchBorderTopStyle: "solid",
      periodSwitchBorderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
      periodSwitchBackgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      periodSwitchBeforeContent: "none",
      periodButtonHeights: [38, 38, 38],
      periodButtonFontSizes: ["14.08px", "14.08px", "14.08px"],
    });
    assert.ok(mobilePopoverContract.periodSwitchWidth > 80);

    await runtime.page.setViewportSize({ width: 320, height: 812 });
    assertMobileEditableContract(
      await readMobileEditableContract(runtime.page),
      320,
      "Schedule at 320px",
    );
    const narrowCalendarContract = await runtime.page.evaluate(() => {
      const toolbarActions = document.querySelector<HTMLElement>(
        ".teaching-schedule-toolbar-actions",
      );
      const picker = document.querySelector<HTMLElement>(
        ".teaching-date-picker",
      );
      const navigator = document.querySelector<HTMLElement>(
        ".teaching-date-navigator",
      );
      const viewToggle = document.querySelector<HTMLElement>(
        ".teaching-schedule-view-toggle",
      );
      const popover = document.querySelector<HTMLElement>(
        ".teaching-date-popover",
      );
      if (!toolbarActions || !picker || !navigator || !viewToggle || !popover) {
        throw new Error("Narrow schedule calendar geometry is missing");
      }
      const viewportWidth = document.documentElement.clientWidth;
      return {
        clientWidth: viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        allControlsInsideViewport: [
          toolbarActions,
          picker,
          navigator,
          viewToggle,
          popover,
        ].every((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= viewportWidth;
        }),
        popoverWidth: popover.getBoundingClientRect().width,
      };
    });
    assert.equal(narrowCalendarContract.clientWidth, 320);
    assert.equal(
      narrowCalendarContract.scrollWidth,
      narrowCalendarContract.clientWidth,
    );
    assert.equal(narrowCalendarContract.allControlsInsideViewport, true);
    assert.ok(narrowCalendarContract.popoverWidth <= 288);
    await assertSegmentedIndicatorAligned(
      runtime.page,
      "Вид занятий",
      "Schedule mobile view at 320px",
    );
    await runtime.page.setViewportSize({ width: 375, height: 812 });

    e2eScheduleFixtureVisible = true;
    const mobileDateResponsePromise = runtime.page.waitForResponse((response) =>
      response.url().includes("/api/v2/lesson-runs?"),
    );
    await runtime.page
      .locator('.teaching-date-grid button[data-date="2026-08-12"]')
      .click();
    await mobileDateResponsePromise;
    await runtime.page
      .getByRole("table", {
        name: "Занятия за выбранную неделю",
        exact: true,
      })
      .waitFor();

    const mobileTableContract = await runtime.page.evaluate(() => {
      const wrapper = document.querySelector<HTMLElement>(
        ".teaching-run-table-wrap",
      );
      if (!wrapper) throw new Error("Mobile schedule table is missing");
      const viewportWidth = document.documentElement.clientWidth;
      const rect = wrapper.getBoundingClientRect();
      const style = getComputedStyle(wrapper);
      return {
        clientWidth: viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflowX: style.overflowX,
        tableWidthContainedByScroller:
          wrapper.scrollWidth >= wrapper.clientWidth,
        wrapperInsideViewport: rect.left >= 0 && rect.right <= viewportWidth,
        menuTriggerCount: wrapper.querySelectorAll(
          ".teaching-run-action-menu .action-menu-trigger",
        ).length,
        quickActionCount: wrapper.querySelectorAll(
          ".teaching-run-table-quick-actions, .teaching-run-table-quick-action",
        ).length,
      };
    });
    assert.deepEqual(mobileTableContract, {
      clientWidth: 375,
      scrollWidth: 375,
      overflowX: "auto",
      tableWidthContainedByScroller: true,
      wrapperInsideViewport: true,
      menuTriggerCount: 1,
      quickActionCount: 0,
    });

    await runtime.page.setViewportSize({ width: 320, height: 812 });
    const narrowTableContract = await runtime.page.evaluate(() => {
      const wrapper = document.querySelector<HTMLElement>(
        ".teaching-run-table-wrap",
      );
      if (!wrapper) throw new Error("Narrow schedule table is missing");
      const viewportWidth = document.documentElement.clientWidth;
      const rect = wrapper.getBoundingClientRect();
      const style = getComputedStyle(wrapper);
      return {
        clientWidth: viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflowX: style.overflowX,
        tableWidthContainedByScroller:
          wrapper.scrollWidth >= wrapper.clientWidth,
        wrapperInsideViewport: rect.left >= 0 && rect.right <= viewportWidth,
      };
    });
    assert.deepEqual(narrowTableContract, {
      clientWidth: 320,
      scrollWidth: 320,
      overflowX: "auto",
      tableWidthContainedByScroller: true,
      wrapperInsideViewport: true,
    });
    const narrowRowMenuTrigger = runtime.page.getByRole("button", {
      name: /Действия с занятием/,
    });
    await narrowRowMenuTrigger.click();
    const narrowRowMenu = runtime.page.getByRole("menu");
    await narrowRowMenu.waitFor();
    const narrowMenuContract = await runtime.page.evaluate(() => {
      const menu = document.querySelector<HTMLElement>(
        ".action-menu-panel-portal",
      );
      const trigger = document.querySelector<HTMLElement>(
        ".teaching-run-action-menu .action-menu-trigger",
      );
      if (!menu || !trigger) {
        throw new Error("Narrow schedule action menu is missing");
      }
      const viewportWidth = document.documentElement.clientWidth;
      const menuRect = menu.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const items = Array.from(
        menu.querySelectorAll<HTMLElement>(".action-menu-item"),
      );
      return {
        clientWidth: viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        menuInsideViewport:
          menuRect.left >= 0 &&
          menuRect.right <= viewportWidth &&
          menuRect.top >= 0 &&
          menuRect.bottom <= window.innerHeight,
        triggerInsideViewport:
          triggerRect.left >= 0 && triggerRect.right <= viewportWidth,
        itemHeights: items.map((item) => item.getBoundingClientRect().height),
      };
    });
    assert.deepEqual(narrowMenuContract, {
      clientWidth: 320,
      scrollWidth: 320,
      menuInsideViewport: true,
      triggerInsideViewport: true,
      itemHeights: [40, 40, 40],
    });
    await narrowRowMenu
      .getByRole("menuitem", { name: "Начать урок", exact: true })
      .press("Escape");
    await narrowRowMenu.waitFor({ state: "detached" });
    assert.equal(
      await narrowRowMenuTrigger.getAttribute("aria-expanded"),
      "false",
    );
    await runtime.page.setViewportSize({ width: 375, height: 812 });

    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Вид занятий",
      optionName: "Показать карточками",
      label: "Schedule mobile fixture table-to-cards",
    });
    await runtime.page.locator(".teaching-run-card").waitFor();
    const mobileCardContract = await runtime.page.evaluate(() => {
      const cardBody = document.querySelector<HTMLElement>(
        ".teaching-run-card-body",
      );
      if (!cardBody) throw new Error("Mobile schedule card is missing");
      const courseTitle = cardBody.querySelector<HTMLElement>(
        ".teaching-run-content > p",
      );
      const lessonTitle = cardBody.querySelector<HTMLElement>(
        ".teaching-run-content > h3",
      );
      if (!courseTitle || !lessonTitle) {
        throw new Error("Mobile schedule card titles are missing");
      }
      courseTitle.textContent = "ОченьДлинноеНазваниеКурсаБезПробелов".repeat(
        4,
      );
      lessonTitle.textContent = "ОченьДлинноеНазваниеУрокаБезПробелов".repeat(
        4,
      );
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        cardBodyDisplay: getComputedStyle(cardBody).display,
        courseTitleWrap: getComputedStyle(courseTitle).overflowWrap,
        lessonTitleWrap: getComputedStyle(lessonTitle).overflowWrap,
      };
    });
    assert.deepEqual(mobileCardContract, {
      clientWidth: 375,
      scrollWidth: 375,
      cardBodyDisplay: "grid",
      courseTitleWrap: "anywhere",
      lessonTitleWrap: "anywhere",
    });

    await runtime.page
      .getByRole("button", { name: "Открыть меню аккаунта", exact: true })
      .click();

    const mobileAccountMenuContract = await runtime.page.evaluate(() => {
      const trigger = document.querySelector<HTMLElement>(
        ".nav-account-menu-trigger",
      );
      const header = document.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );
      const burger = trigger?.querySelector<SVGElement>(".nav-main-menu-icon");
      const avatar = trigger?.querySelector<HTMLElement>(
        ".nav-user-trigger-avatar",
      );
      const menu = document.querySelector<HTMLElement>(
        '.nav-account-menu-mobile[role="menu"][aria-label="Меню аккаунта"]',
      );
      const profileHeader = menu?.querySelector<HTMLElement>(
        ".nav-dropdown-profile",
      );
      const profileAvatar = profileHeader?.querySelector<HTMLElement>(
        ".nav-dropdown-profile-avatar",
      );
      const profileName =
        profileHeader?.querySelector<HTMLElement>("p:first-child");
      const profileEmail = profileHeader?.querySelector<HTMLElement>(
        "p:last-child:not(:first-child)",
      );
      const items = menu?.querySelector<HTMLElement>(".nav-dropdown-items");
      if (
        !trigger ||
        !header ||
        !burger ||
        !menu ||
        !profileHeader ||
        !profileAvatar ||
        !profileName ||
        !profileEmail ||
        !items
      ) {
        throw new Error("Mobile account menu contract is missing");
      }
      const viewportWidth = document.documentElement.clientWidth;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const profileHeaderRect = profileHeader.getBoundingClientRect();
      const profileAvatarRect = profileAvatar.getBoundingClientRect();
      const itemsRect = items.getBoundingClientRect();
      const menuStyle = getComputedStyle(menu);
      const profileHeaderStyle = getComputedStyle(profileHeader);
      const headerStyle = getComputedStyle(header);
      const readGlyph = (icon: SVGElement) => {
        const rect = icon.getBoundingClientRect();
        const strokePart = icon.querySelector<SVGElement>(
          "path, line, polyline, polygon, circle, ellipse, rect",
        );
        const strokeStyle = getComputedStyle(strokePart ?? icon);
        return {
          width: rect.width,
          height: rect.height,
          strokeWidth: strokeStyle.strokeWidth,
          vectorEffect: strokeStyle.vectorEffect,
        };
      };
      const visibleMenuItems = Array.from(
        menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).filter((item) => item.getClientRects().length > 0);
      return {
        trigger: {
          width: triggerRect.width,
          height: triggerRect.height,
          burger: readGlyph(burger),
          visibleAvatarCount:
            avatar && avatar.getClientRects().length > 0 ? 1 : 0,
        },
        profileName: profileName.textContent?.trim(),
        profileNameFontSize: getComputedStyle(profileName).fontSize,
        profileNameFontWeight: getComputedStyle(profileName).fontWeight,
        profileEmail: profileEmail.textContent?.trim(),
        profileEmailFontSize: getComputedStyle(profileEmail).fontSize,
        profileEmailFontWeight: getComputedStyle(profileEmail).fontWeight,
        profileAvatarCount: profileHeader.querySelectorAll(
          ".nav-user-trigger-avatar",
        ).length,
        profileImageCount: profileHeader.querySelectorAll("img").length,
        profileAvatar: {
          width: profileAvatarRect.width,
          height: profileAvatarRect.height,
          fontSize: getComputedStyle(profileAvatar).fontSize,
        },
        profileDivider: {
          borderBottomWidth: profileHeaderStyle.borderBottomWidth,
          borderBottomStyle: profileHeaderStyle.borderBottomStyle,
          leftGap: profileHeaderRect.left - menuRect.left,
          rightGap: menuRect.right - profileHeaderRect.right,
        },
        itemRail: {
          borderTopWidth: getComputedStyle(items).borderTopWidth,
          contained:
            itemsRect.left >= menuRect.left &&
            itemsRect.right <= menuRect.right,
        },
        menu: {
          leftInset: menuRect.left,
          rightInset: viewportWidth - menuRect.right,
          topGap: menuRect.top - triggerRect.bottom,
          borderRadius: menuStyle.borderRadius,
          insideViewport:
            menuRect.left >= 0 &&
            menuRect.right <= viewportWidth &&
            menuRect.top >= 0 &&
            menuRect.bottom <= window.innerHeight,
          boxShadow: menuStyle.boxShadow,
        },
        whiteSurfaces: {
          header: {
            backgroundColor: headerStyle.backgroundColor,
            backgroundImage: headerStyle.backgroundImage,
            opacity: headerStyle.opacity,
            backdropFilter: headerStyle.backdropFilter,
          },
          menu: {
            backgroundColor: menuStyle.backgroundColor,
            backgroundImage: menuStyle.backgroundImage,
            opacity: menuStyle.opacity,
            backdropFilter: menuStyle.backdropFilter,
          },
          profile: {
            backgroundColor: profileHeaderStyle.backgroundColor,
            backgroundImage: profileHeaderStyle.backgroundImage,
            opacity: profileHeaderStyle.opacity,
            backdropFilter: profileHeaderStyle.backdropFilter,
          },
        },
        itemHeights: visibleMenuItems.map(
          (item) => item.getBoundingClientRect().height,
        ),
        itemFontSizes: visibleMenuItems.map(
          (item) => getComputedStyle(item).fontSize,
        ),
        itemFontWeights: visibleMenuItems.map(
          (item) => getComputedStyle(item).fontWeight,
        ),
        itemIconStyles: visibleMenuItems.map((item) => {
          const icon = item.querySelector<SVGElement>("svg");
          if (!icon) throw new Error("Mobile account menu icon is missing");
          return readGlyph(icon);
        }),
        visibleMenuItems: visibleMenuItems.map(
          (item) => item.textContent?.trim() ?? "",
        ),
      };
    });
    assert.deepEqual(mobileAccountMenuContract.trigger, {
      width: 48,
      height: 48,
      burger: {
        width: 16,
        height: 16,
        strokeWidth: "2px",
        vectorEffect: "none",
      },
      visibleAvatarCount: 0,
    });
    assert.equal(mobileAccountMenuContract.profileName, "E2E Adult");
    assert.equal(mobileAccountMenuContract.profileNameFontSize, "14px");
    assert.equal(mobileAccountMenuContract.profileNameFontWeight, "600");
    assert.equal(
      mobileAccountMenuContract.profileEmail,
      "adult-e2e@example.test",
    );
    assert.equal(mobileAccountMenuContract.profileEmailFontSize, "12px");
    assert.equal(mobileAccountMenuContract.profileEmailFontWeight, "400");
    assert.equal(mobileAccountMenuContract.profileAvatarCount, 1);
    assert.equal(mobileAccountMenuContract.profileImageCount, 1);
    assert.deepEqual(mobileAccountMenuContract.profileAvatar, {
      width: 48,
      height: 48,
      fontSize: "11.52px",
    });
    assert.equal(
      mobileAccountMenuContract.profileDivider.borderBottomWidth,
      "1px",
    );
    assert.equal(
      mobileAccountMenuContract.profileDivider.borderBottomStyle,
      "solid",
    );
    assert.ok(Math.abs(mobileAccountMenuContract.profileDivider.leftGap) < 0.5);
    assert.ok(
      Math.abs(mobileAccountMenuContract.profileDivider.rightGap) < 0.5,
    );
    assert.deepEqual(mobileAccountMenuContract.itemRail, {
      borderTopWidth: "0px",
      contained: true,
    });
    assert.ok(Math.abs(mobileAccountMenuContract.menu.leftInset - 12) < 0.5);
    assert.ok(Math.abs(mobileAccountMenuContract.menu.rightInset - 12) < 0.5);
    assert.ok(Math.abs(mobileAccountMenuContract.menu.topGap - 12) < 0.5);
    assert.equal(mobileAccountMenuContract.menu.borderRadius, "16px");
    assert.equal(mobileAccountMenuContract.menu.insideViewport, true);
    for (const [surfaceName, surface] of Object.entries(
      mobileAccountMenuContract.whiteSurfaces,
    )) {
      assertOpaqueWhiteSurface(surface, `Mobile Account ${surfaceName}`);
    }
    assert.equal(
      mobileAccountMenuContract.whiteSurfaces.menu.backgroundColor,
      mobileAccountMenuContract.whiteSurfaces.header.backgroundColor,
      "Mobile menu and header must resolve to the exact same white",
    );
    assert.match(
      mobileAccountMenuContract.menu.boxShadow,
      /0px 24px 32px -24px/,
      "Mobile menu shadow must fall downward instead of tinting the header",
    );
    assert.match(mobileAccountMenuContract.menu.boxShadow, /0\.24/);
    assert.deepEqual(
      mobileAccountMenuContract.itemHeights,
      [68, 68, 68, 68, 68],
    );
    assert.deepEqual(mobileAccountMenuContract.itemFontSizes, [
      "14px",
      "14px",
      "14px",
      "14px",
      "14px",
    ]);
    assert.deepEqual(mobileAccountMenuContract.itemFontWeights, [
      "400",
      "400",
      "400",
      "400",
      "400",
    ]);
    assert.deepEqual(
      mobileAccountMenuContract.itemIconStyles,
      Array.from({ length: 5 }, () => ({
        width: 16,
        height: 16,
        strokeWidth: "2px",
        vectorEffect: "none",
      })),
    );
    assert.deepEqual(mobileAccountMenuContract.visibleMenuItems, [
      "Расписание",
      "Ученики",
      "Курсы",
      "Магазин",
      "Профиль",
    ]);

    const scheduleMenuItem = runtime.page.getByRole("menuitem", {
      name: "Расписание",
      exact: true,
    });
    await scheduleMenuItem.waitFor();
    await runtime.page
      .getByRole("menuitem", { name: "Курсы", exact: true })
      .waitFor();
    await runtime.page
      .getByRole("menuitem", { name: "Магазин", exact: true })
      .waitFor();
    const learningProfileMenuItem = runtime.page.getByRole("menuitem", {
      name: "Профиль",
      exact: true,
    });
    await learningProfileMenuItem.waitFor();
    const accountMenu = runtime.page.getByRole("menu", {
      name: "Меню аккаунта",
      exact: true,
    });

    assert.deepEqual(
      await runtime.page.evaluate(() => {
        const trigger = document.querySelector<HTMLElement>(
          ".nav-account-menu-trigger",
        );
        const items = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".nav-account-menu-mobile .nav-dropdown-item",
          ),
        ).filter((item) => item.getClientRects().length > 0);
        if (!trigger || items.length === 0) {
          throw new Error("Pointer-open account menu state is missing");
        }
        return {
          activeElementIsTrigger: document.activeElement === trigger,
          activeLabel: document.activeElement?.getAttribute("aria-label"),
          focusedMenuItemCount: items.filter(
            (item) => document.activeElement === item,
          ).length,
          itemHalos: items.map((item) => {
            const style = getComputedStyle(item);
            return {
              outlineStyle: style.outlineStyle,
              boxShadow: style.boxShadow,
            };
          }),
        };
      }),
      {
        activeElementIsTrigger: true,
        activeLabel: "Закрыть меню аккаунта",
        focusedMenuItemCount: 0,
        itemHalos: [
          { outlineStyle: "none", boxShadow: "none" },
          { outlineStyle: "none", boxShadow: "none" },
          { outlineStyle: "none", boxShadow: "none" },
          { outlineStyle: "none", boxShadow: "none" },
          { outlineStyle: "none", boxShadow: "none" },
        ],
      },
    );
    assert.equal(
      await runtime.page.locator(".nav-dropdown-item:focus").count(),
      0,
    );

    await runtime.page
      .getByRole("button", {
        name: "Закрыть меню аккаунта",
        exact: true,
      })
      .click();
    await accountMenu.waitFor({ state: "detached" });
    const triggerAfterClickClose = runtime.page.getByRole("button", {
      name: "Открыть меню аккаунта",
      exact: true,
    });
    await triggerAfterClickClose.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await triggerAfterClickClose.evaluate((trigger) => {
        const style = getComputedStyle(trigger);
        return {
          focused: document.activeElement === trigger,
          expanded: trigger.getAttribute("aria-expanded"),
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
        };
      }),
      {
        focused: false,
        expanded: "false",
        backgroundColor: "rgb(255, 255, 255)",
        boxShadow: "none",
      },
    );

    await triggerAfterClickClose.click();
    await accountMenu.waitFor();
    await runtime.page.mouse.move(4, 780);
    await runtime.page.mouse.down();
    await runtime.page.mouse.up();
    await accountMenu.waitFor({ state: "detached" });
    const triggerAfterOutsideClose = runtime.page.getByRole("button", {
      name: "Открыть меню аккаунта",
      exact: true,
    });
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await triggerAfterOutsideClose.evaluate((trigger) => {
        const style = getComputedStyle(trigger);
        return {
          focused: document.activeElement === trigger,
          expanded: trigger.getAttribute("aria-expanded"),
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
        };
      }),
      {
        focused: false,
        expanded: "false",
        backgroundColor: "rgb(255, 255, 255)",
        boxShadow: "none",
      },
    );

    await triggerAfterOutsideClose.evaluate((trigger) =>
      (trigger as HTMLElement).focus(),
    );
    await triggerAfterOutsideClose.press("Enter");
    await accountMenu.waitFor();
    await runtime.page.locator(".nav-dropdown-item:focus").waitFor();
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.textContent?.trim(),
      ),
      "Расписание",
    );
    await scheduleMenuItem.press("End");
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.textContent?.trim(),
      ),
      "Профиль",
    );
    await learningProfileMenuItem.press("Home");
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.textContent?.trim(),
      ),
      "Расписание",
    );
    await scheduleMenuItem.press("Escape");
    await accountMenu.waitFor({ state: "detached" });
    assert.equal(
      await runtime.page.evaluate(
        () => document.activeElement?.getAttribute("aria-label") ?? "",
      ),
      "Открыть меню аккаунта",
    );
    const triggerAfterEscape = runtime.page.getByRole("button", {
      name: "Открыть меню аккаунта",
      exact: true,
    });
    await triggerAfterEscape.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await triggerAfterEscape.evaluate((trigger) => {
        const style = getComputedStyle(trigger);
        return {
          focused: document.activeElement === trigger,
          expanded: trigger.getAttribute("aria-expanded"),
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
        };
      }),
      {
        focused: true,
        expanded: "false",
        backgroundColor: "rgb(255, 255, 255)",
        boxShadow: "none",
      },
    );

    await triggerAfterEscape.press("Enter");
    await accountMenu.waitFor();
    const stableMenuTrigger = runtime.page.locator(".nav-account-menu-trigger");
    const firstKeyboardMenuItem = runtime.page.locator(
      ".nav-account-menu-mobile .nav-dropdown-item:focus",
    );
    await firstKeyboardMenuItem.waitFor();
    await firstKeyboardMenuItem.press("Shift+Tab");
    assert.equal(
      await stableMenuTrigger.evaluate(
        (trigger) => document.activeElement === trigger,
      ),
      true,
    );
    await stableMenuTrigger.press("Enter");
    await accountMenu.waitFor({ state: "detached" });
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await stableMenuTrigger.evaluate((trigger) => {
        const style = getComputedStyle(trigger);
        return {
          focused: document.activeElement === trigger,
          expanded: trigger.getAttribute("aria-expanded"),
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
        };
      }),
      {
        focused: true,
        expanded: "false",
        backgroundColor: "rgb(255, 255, 255)",
        boxShadow: "none",
      },
    );

    await triggerAfterEscape.click();
    await runtime.page
      .getByRole("menu", { name: "Меню аккаунта", exact: true })
      .waitFor();

    await Promise.all([
      runtime.page.waitForURL(/\/profile$/),
      learningProfileMenuItem.click(),
    ]);
    await runtime.page
      .getByRole("heading", {
        name: "E2E Adult",
        exact: true,
        level: 1,
      })
      .waitFor();

    await runtime.page
      .getByRole("button", { name: "Открыть меню аккаунта", exact: true })
      .click();
    const studentsMenuItem = runtime.page.getByRole("menuitem", {
      name: "Ученики",
      exact: true,
    });
    await Promise.all([
      runtime.page.waitForURL(/\/students$/),
      studentsMenuItem.click(),
    ]);
    await runtime.page
      .getByRole("heading", { name: "Ученики", exact: true, level: 1 })
      .waitFor();
    await runtime.page
      .getByRole("table", {
        name: "Ученики, их статусы и группы",
        exact: true,
      })
      .waitFor();
    await runtime.page
      .locator("html[data-page-transition-direction]")
      .waitFor({ state: "detached" });
    assertMobileEditableContract(
      await readMobileEditableContract(runtime.page),
      375,
      "Students at 375px",
    );

    const mobileContract = await runtime.page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(
        ".student-directory-toolbar",
      );
      const rail = toolbar?.querySelector<HTMLElement>(
        ".student-directory-controls",
      );
      const membershipSwitch = rail?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Принадлежность к группе"]',
      );
      const viewSwitch = rail?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Вид списка учеников"]',
      );
      const activeViewButton = viewSwitch?.querySelector<HTMLElement>(
        'button[aria-pressed="true"]',
      );
      const inactiveViewButton = viewSwitch?.querySelector<HTMLElement>(
        'button[aria-pressed="false"]',
      );
      const search = toolbar?.querySelector<HTMLElement>(
        ".teaching-hub-search",
      );
      const searchInput = search?.querySelector<HTMLInputElement>("input");
      const primaryAction = document.querySelector<HTMLElement>(
        ".app-page-header .app-page-actions > .product-btn",
      );
      const tableWrap = document.querySelector<HTMLElement>(
        ".student-directory-table-wrap",
      );
      const table = tableWrap?.querySelector<HTMLTableElement>(
        ".student-directory-learners-table",
      );
      const archivedRow = Array.from(table?.rows ?? []).find((row) =>
        row.textContent?.includes("Архивная Ольга"),
      );
      const groupCell = archivedRow?.cells[3];
      const actionCell = archivedRow?.cells[5];
      const actionButtons = Array.from(
        actionCell?.querySelectorAll<HTMLButtonElement>("button") ?? [],
      );
      if (
        !toolbar ||
        !rail ||
        !membershipSwitch ||
        !viewSwitch ||
        !activeViewButton ||
        !inactiveViewButton ||
        !search ||
        !searchInput ||
        !primaryAction ||
        !tableWrap ||
        !table ||
        !groupCell ||
        !actionCell ||
        !actionButtons.length
      ) {
        throw new Error("Mobile Students toolbar controls are missing");
      }
      const viewportWidth = document.documentElement.clientWidth;
      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarStyle = getComputedStyle(toolbar);
      const railRect = rail.getBoundingClientRect();
      const tableWrapRect = tableWrap.getBoundingClientRect();
      const tableWrapStyle = getComputedStyle(tableWrap);
      const tableRect = table.getBoundingClientRect();
      const groupRect = groupCell.getBoundingClientRect();
      const actionRect = actionCell.getBoundingClientRect();
      const readSurface = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return {
          borderTopWidth: style.borderTopWidth,
          borderTopStyle: style.borderTopStyle,
          borderTopColor: style.borderTopColor,
          borderRadius: style.borderRadius,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          backgroundClip: style.backgroundClip,
          boxShadow: style.boxShadow,
        };
      };
      const readGlyph = (icon: SVGElement) => {
        const rect = icon.getBoundingClientRect();
        const strokePart = icon.querySelector<SVGElement>(
          "path, line, polyline, polygon, circle, ellipse, rect",
        );
        const strokeStyle = getComputedStyle(strokePart ?? icon);
        return {
          width: rect.width,
          height: rect.height,
          strokeWidth: strokeStyle.strokeWidth,
          vectorEffect: strokeStyle.vectorEffect,
        };
      };
      const viewSwitchRect = viewSwitch.getBoundingClientRect();
      const viewSwitchStyle = getComputedStyle(viewSwitch);
      const viewOptions = Array.from(
        viewSwitch.querySelectorAll<HTMLElement>("button"),
      );
      const viewOptionRects = viewOptions.map((button) =>
        button.getBoundingClientRect(),
      );
      const activeViewStyle = getComputedStyle(activeViewButton);
      const inactiveViewStyle = getComputedStyle(inactiveViewButton);
      const viewIndicator = viewSwitch.querySelector<HTMLElement>(
        ".product-segmented-control-indicator",
      );
      if (!viewIndicator) {
        throw new Error("Mobile Students view indicator is missing");
      }
      const viewIndicatorStyle = getComputedStyle(viewIndicator);
      const viewIndicatorRect = viewIndicator.getBoundingClientRect();
      const activeViewRect = activeViewButton.getBoundingClientRect();
      return {
        clientWidth: viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        heading: document.querySelector("h1")?.textContent?.trim() ?? "",
        toolbarInsideViewport:
          toolbarRect.left >= 0 && toolbarRect.right <= viewportWidth,
        toolbarPaddingLeft: toolbarStyle.paddingLeft,
        toolbarPaddingRight: toolbarStyle.paddingRight,
        railStartInset: railRect.left - toolbarRect.left,
        railEndInset: toolbarRect.right - railRect.right,
        railOverflowX: getComputedStyle(rail).overflowX,
        railFlexWrap: getComputedStyle(rail).flexWrap,
        railScrollIsContained: rail.scrollWidth > rail.clientWidth,
        searchHeight: search.getBoundingClientRect().height,
        searchFontSize: getComputedStyle(searchInput).fontSize,
        searchFontWeight: getComputedStyle(searchInput).fontWeight,
        searchLineHeight: getComputedStyle(searchInput).lineHeight,
        primaryActionHeight: primaryAction.getBoundingClientRect().height,
        primaryActionFontSize: getComputedStyle(primaryAction).fontSize,
        primaryActionFontWeight: getComputedStyle(primaryAction).fontWeight,
        primaryActionLineHeight: getComputedStyle(primaryAction).lineHeight,
        workspaceTabHeights: Array.from(
          document.querySelectorAll<HTMLElement>(".workspace-tab"),
        )
          .filter((tab) => tab.getClientRects().length > 0)
          .map((tab) => tab.getBoundingClientRect().height),
        workspaceTabFontSizes: Array.from(
          document.querySelectorAll<HTMLElement>(".workspace-tab"),
        )
          .filter((tab) => tab.getClientRects().length > 0)
          .map((tab) => getComputedStyle(tab).fontSize),
        membershipSwitchHeight: getComputedStyle(membershipSwitch).height,
        membershipSwitchWidth: membershipSwitch.getBoundingClientRect().width,
        membershipSwitchPadding: getComputedStyle(membershipSwitch).padding,
        membershipSwitchGap: getComputedStyle(membershipSwitch).gap,
        membershipSwitchBorderTopWidth:
          getComputedStyle(membershipSwitch).borderTopWidth,
        membershipSwitchBorderTopStyle:
          getComputedStyle(membershipSwitch).borderTopStyle,
        membershipSwitchBorderTopColor:
          getComputedStyle(membershipSwitch).borderTopColor,
        membershipSwitchBackgroundClip:
          getComputedStyle(membershipSwitch).backgroundClip,
        membershipSwitchBeforeContent: getComputedStyle(
          membershipSwitch,
          "::before",
        ).content,
        membershipButtonHeights: Array.from(
          membershipSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => button.getBoundingClientRect().height),
        membershipButtonFontSizes: Array.from(
          membershipSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => getComputedStyle(button).fontSize),
        membershipButtonFontWeights: Array.from(
          membershipSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => getComputedStyle(button).fontWeight),
        membershipButtonLineHeights: Array.from(
          membershipSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => getComputedStyle(button).lineHeight),
        membershipSwitchInsideViewport: (() => {
          const rect = membershipSwitch.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= viewportWidth;
        })(),
        membershipButtons: Array.from(
          membershipSwitch.querySelectorAll("button"),
        ).map((button) => ({
          label: button.textContent?.trim() ?? "",
          pressed: button.getAttribute("aria-pressed"),
        })),
        viewSwitchHeight: getComputedStyle(viewSwitch).height,
        viewSwitchPadding: getComputedStyle(viewSwitch).padding,
        viewButtonHeights: Array.from(
          viewSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => button.getBoundingClientRect().height),
        viewIconSizes: Array.from(
          viewSwitch.querySelectorAll<SVGElement>("button svg"),
        ).map((icon) => {
          const rect = icon.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
        activeViewButtonHeight: getComputedStyle(activeViewButton).height,
        viewSwitchInsideViewport: (() => {
          const rect = viewSwitch.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= viewportWidth;
        })(),
        viewButtons: Array.from(viewSwitch.querySelectorAll("button")).map(
          (button) => ({
            label: button.getAttribute("aria-label"),
            pressed: button.getAttribute("aria-pressed"),
          }),
        ),
        viewToggle: {
          group: {
            width: viewSwitchRect.width,
            height: viewSwitchRect.height,
            padding: viewSwitchStyle.padding,
            gap: viewSwitchStyle.gap,
            borderTopWidth: viewSwitchStyle.borderTopWidth,
            borderTopStyle: viewSwitchStyle.borderTopStyle,
            borderTopColor: viewSwitchStyle.borderTopColor,
            borderRadius: viewSwitchStyle.borderRadius,
            backgroundColor: viewSwitchStyle.backgroundColor,
            backgroundClip: viewSwitchStyle.backgroundClip,
            boxShadow: viewSwitchStyle.boxShadow,
          },
          groupIndicatorReady: viewSwitch.getAttribute("data-indicator-ready"),
          groupBeforeContent: getComputedStyle(viewSwitch, "::before").content,
          indicatorCount: viewSwitch.querySelectorAll(
            ".product-segmented-control-indicator",
          ).length,
          indicator: {
            surface: readSurface(viewIndicator),
            width: viewIndicatorRect.width,
            height: viewIndicatorRect.height,
            opacity: viewIndicatorStyle.opacity,
            display: viewIndicatorStyle.display,
            pointerEvents: viewIndicatorStyle.pointerEvents,
            backdropFilter: viewIndicatorStyle.backdropFilter,
            zIndex: viewIndicatorStyle.zIndex,
            ariaHidden: viewIndicator.getAttribute("aria-hidden"),
            ready: viewIndicator.getAttribute("data-ready"),
            motionReady: viewIndicator.getAttribute("data-motion-ready"),
            transitionProperty: viewIndicatorStyle.transitionProperty,
            transitionDuration: viewIndicatorStyle.transitionDuration,
            transitionTimingFunction:
              viewIndicatorStyle.transitionTimingFunction,
            selectedStartDelta: Math.abs(
              viewIndicatorRect.left - activeViewRect.left,
            ),
            selectedTopDelta: Math.abs(
              viewIndicatorRect.top - activeViewRect.top,
            ),
            selectedWidthDelta: Math.abs(
              viewIndicatorRect.width - activeViewRect.width,
            ),
            selectedHeightDelta: Math.abs(
              viewIndicatorRect.height - activeViewRect.height,
            ),
          },
          optionWidths: viewOptionRects.map((rect) => rect.width),
          optionHeights: viewOptionRects.map((rect) => rect.height),
          seamGaps: viewOptionRects
            .slice(1)
            .map((rect, index) =>
              Number((rect.left - viewOptionRects[index]!.right).toFixed(3)),
            ),
          optionRadii: viewOptions.map(
            (button) => getComputedStyle(button).borderRadius,
          ),
          iconStyles: Array.from(
            viewSwitch.querySelectorAll<SVGElement>("button svg.lucide"),
          ).map(readGlyph),
          referenceButton: readSurface(primaryAction),
          selected: {
            surface: readSurface(activeViewButton),
            transform: activeViewStyle.transform,
            beforeContent: getComputedStyle(activeViewButton, "::before")
              .content,
          },
          inactive: {
            borderTopWidth: inactiveViewStyle.borderTopWidth,
            borderTopStyle: inactiveViewStyle.borderTopStyle,
            backgroundColor: inactiveViewStyle.backgroundColor,
            backgroundImage: inactiveViewStyle.backgroundImage,
            boxShadow: inactiveViewStyle.boxShadow,
            transform: inactiveViewStyle.transform,
            beforeContent: getComputedStyle(inactiveViewButton, "::before")
              .content,
          },
        },
        hasFilterTrigger: Boolean(rail.querySelector(".course-filter-trigger")),
        nativeSelectCount: rail.querySelectorAll("select").length,
        tableWrapInsideViewport:
          tableWrapRect.left >= 0 && tableWrapRect.right <= viewportWidth,
        tableOverflowX: getComputedStyle(tableWrap).overflowX,
        tableSurface: {
          backgroundColor: tableWrapStyle.backgroundColor,
          borderTopWidth: tableWrapStyle.borderTopWidth,
          borderRadius: tableWrapStyle.borderRadius,
        },
        tableScrollIsContained: tableWrap.scrollWidth > tableWrap.clientWidth,
        rowCellCount: archivedRow?.cells.length ?? 0,
        columnsDoNotOverlap: groupRect.right <= actionRect.left + 0.5,
        actionsInsideTable:
          actionRect.left >= tableRect.left &&
          actionRect.right <= tableRect.right &&
          actionButtons.every((button) => {
            const rect = button.getBoundingClientRect();
            return (
              rect.left >= actionRect.left && rect.right <= actionRect.right
            );
          }),
      };
    });
    assert.equal(mobileContract.clientWidth, 375);
    assert.equal(mobileContract.scrollWidth, mobileContract.clientWidth);
    assert.equal(mobileContract.heading, "Ученики");
    assert.equal(mobileContract.toolbarInsideViewport, true);
    assert.equal(mobileContract.toolbarPaddingLeft, "0px");
    assert.equal(mobileContract.toolbarPaddingRight, "0px");
    assert.ok(Math.abs(mobileContract.railStartInset) < 0.5);
    assert.ok(Math.abs(mobileContract.railEndInset) < 0.5);
    assert.equal(mobileContract.railOverflowX, "visible");
    assert.equal(mobileContract.railFlexWrap, "wrap");
    assert.equal(mobileContract.railScrollIsContained, false);
    assert.equal(mobileContract.searchHeight, 40);
    assert.equal(mobileContract.searchFontSize, "16px");
    assert.equal(mobileContract.searchFontWeight, "400");
    assert.equal(mobileContract.searchLineHeight, "19.2px");
    assert.equal(mobileContract.primaryActionHeight, 40);
    assert.equal(mobileContract.primaryActionFontSize, "14.08px");
    assert.equal(mobileContract.primaryActionFontWeight, "400");
    assert.equal(mobileContract.primaryActionLineHeight, "16.896px");
    assert.ok(mobileContract.workspaceTabHeights.length >= 2);
    assert.ok(
      mobileContract.workspaceTabHeights.every((height) => height === 40),
    );
    assert.ok(
      mobileContract.workspaceTabFontSizes.every(
        (fontSize) => fontSize === "14.08px",
      ),
    );
    assert.equal(mobileContract.membershipSwitchHeight, "40px");
    assert.ok(mobileContract.membershipSwitchWidth > 80);
    assert.equal(mobileContract.membershipSwitchPadding, "0px");
    assert.equal(mobileContract.membershipSwitchGap, "2px");
    assert.equal(
      mobileContract.membershipSwitchBorderTopWidth,
      E2E_PRODUCT_SURFACE_BORDER_WIDTH,
    );
    assert.equal(mobileContract.membershipSwitchBorderTopStyle, "solid");
    assert.equal(
      mobileContract.membershipSwitchBorderTopColor,
      E2E_PRODUCT_SURFACE_BORDER_COLOR,
    );
    assert.equal(
      mobileContract.membershipSwitchBackgroundClip,
      E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
    );
    assert.ok(
      ["none", "normal"].includes(mobileContract.membershipSwitchBeforeContent),
    );
    assert.deepEqual(mobileContract.membershipButtonHeights, [38, 38, 38]);
    assert.deepEqual(mobileContract.membershipButtonFontSizes, [
      "14.08px",
      "14.08px",
      "14.08px",
    ]);
    assert.deepEqual(mobileContract.membershipButtonFontWeights, [
      "400",
      "400",
      "400",
    ]);
    assert.deepEqual(mobileContract.membershipButtonLineHeights, [
      "16.896px",
      "16.896px",
      "16.896px",
    ]);
    assert.ok(
      mobileContract.membershipButtonFontSizes.every(
        (fontSize) => fontSize === mobileContract.primaryActionFontSize,
      ) &&
        mobileContract.membershipButtonFontWeights.every(
          (fontWeight) => fontWeight === mobileContract.primaryActionFontWeight,
        ) &&
        mobileContract.membershipButtonLineHeights.every(
          (lineHeight) => lineHeight === mobileContract.primaryActionLineHeight,
        ),
      "Students mobile membership and ordinary button must share one typography token",
    );
    assert.equal(mobileContract.membershipSwitchInsideViewport, true);
    assert.deepEqual(mobileContract.membershipButtons, [
      { label: "Все", pressed: "true" },
      { label: "В группе", pressed: "false" },
      { label: "Без группы", pressed: "false" },
    ]);
    assert.equal(mobileContract.viewSwitchHeight, "40px");
    assert.equal(mobileContract.viewSwitchPadding, "0px");
    assert.deepEqual(mobileContract.viewButtonHeights, [38, 38]);
    assert.deepEqual(mobileContract.viewIconSizes, [
      { width: 16, height: 16 },
      { width: 16, height: 16 },
    ]);
    assert.equal(mobileContract.activeViewButtonHeight, "38px");
    assertTouchSegmentedControl(
      mobileContract.viewToggle,
      "Students mobile view toggle",
    );
    await assertSegmentedIndicatorAligned(
      runtime.page,
      "Принадлежность к группе",
      "Students mobile membership at 375px",
    );
    assert.equal(mobileContract.viewSwitchInsideViewport, true);
    assert.deepEqual(mobileContract.viewButtons, [
      { label: "Показать таблицей", pressed: "true" },
      { label: "Показать карточками", pressed: "false" },
    ]);
    assert.equal(mobileContract.hasFilterTrigger, false);
    assert.equal(mobileContract.nativeSelectCount, 0);
    assert.equal(mobileContract.tableWrapInsideViewport, true);
    assert.equal(mobileContract.tableOverflowX, "auto");
    assert.deepEqual(mobileContract.tableSurface, {
      backgroundColor: "rgb(255, 255, 255)",
      borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      borderRadius: "12px",
    });
    assert.equal(mobileContract.tableScrollIsContained, true);
    assert.equal(mobileContract.rowCellCount, 6);
    assert.equal(mobileContract.columnsDoNotOverlap, true);
    assert.equal(mobileContract.actionsInsideTable, true);

    await runtime.page.setViewportSize({ width: 320, height: 812 });
    assertMobileEditableContract(
      await readMobileEditableContract(runtime.page),
      320,
      "Students at 320px",
    );
    const narrowMembershipContract = await runtime.page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(
        ".student-directory-toolbar",
      );
      const rail = toolbar?.querySelector<HTMLElement>(
        ".student-directory-controls",
      );
      const group = rail?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Принадлежность к группе"]',
      );
      if (!toolbar || !rail || !group) {
        throw new Error("320px Students membership control is missing");
      }

      const viewportWidth = document.documentElement.clientWidth;
      const toolbarRect = toolbar.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const groupRect = group.getBoundingClientRect();
      const groupStyle = getComputedStyle(group);
      const optionRects = Array.from(
        group.querySelectorAll<HTMLElement>("button"),
      ).map((button) => button.getBoundingClientRect());
      return {
        viewportWidth,
        toolbarInsideViewport:
          toolbarRect.left >= 0 && toolbarRect.right <= viewportWidth,
        railInsideToolbar:
          railRect.left >= toolbarRect.left - 0.5 &&
          railRect.right <= toolbarRect.right + 0.5,
        groupInsideRail:
          groupRect.left >= railRect.left - 0.5 &&
          groupRect.right <= railRect.right + 0.5,
        groupInsideViewport:
          groupRect.left >= 0 && groupRect.right <= viewportWidth,
        groupWidth: groupRect.width,
        availableRailWidth: railRect.width,
        railRightInset: toolbarRect.right - railRect.right,
        groupRightInset: railRect.right - groupRect.right,
        viewportRightInset: viewportWidth - groupRect.right,
        height: groupRect.height,
        padding: groupStyle.padding,
        gap: groupStyle.gap,
        borderTopWidth: groupStyle.borderTopWidth,
        borderTopStyle: groupStyle.borderTopStyle,
        optionHeights: optionRects.map((rect) => rect.height),
        optionFontWeights: Array.from(
          group.querySelectorAll<HTMLElement>("button"),
        ).map((button) => getComputedStyle(button).fontWeight),
      };
    });
    assert.equal(narrowMembershipContract.viewportWidth, 320);
    assert.equal(narrowMembershipContract.toolbarInsideViewport, true);
    assert.equal(narrowMembershipContract.railInsideToolbar, true);
    assert.equal(narrowMembershipContract.groupInsideRail, true);
    assert.equal(narrowMembershipContract.groupInsideViewport, true);
    assert.ok(
      narrowMembershipContract.groupWidth <=
        narrowMembershipContract.availableRailWidth + 0.5,
    );
    assert.ok(Math.abs(narrowMembershipContract.railRightInset) < 0.5);
    assert.ok(narrowMembershipContract.groupRightInset >= -0.5);
    assert.ok(
      narrowMembershipContract.viewportRightInset >= 11.5,
      `320px Students membership control must preserve the container's 12px right inset; got ${narrowMembershipContract.viewportRightInset}`,
    );
    assert.equal(narrowMembershipContract.height, 40);
    assert.equal(narrowMembershipContract.padding, "0px");
    assert.equal(narrowMembershipContract.gap, "2px");
    assert.equal(
      narrowMembershipContract.borderTopWidth,
      E2E_PRODUCT_SURFACE_BORDER_WIDTH,
    );
    assert.equal(narrowMembershipContract.borderTopStyle, "solid");
    assert.deepEqual(narrowMembershipContract.optionHeights, [38, 38, 38]);
    assert.deepEqual(narrowMembershipContract.optionFontWeights, [
      "400",
      "400",
      "400",
    ]);
    await assertSegmentedIndicatorAligned(
      runtime.page,
      "Принадлежность к группе",
      "Students mobile membership at 320px",
    );
    await runtime.page.setViewportSize({ width: 375, height: 812 });
  } finally {
    e2eCompletionPhase = null;
    e2eScheduleFixtureVisible = false;
    await runtime.close();
  }
});

test("browser smoke: new Course starts on About and keeps its draft across tabs", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.goto("/courses/new", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", { name: "Новый курс", exact: true, level: 1 })
      .waitFor();
    const newCourseHeader = await runtime.page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".app-page-header");
      const content = header?.querySelector<HTMLElement>(
        ".app-page-header-content",
      );
      const heading = header?.querySelector<HTMLElement>(".app-page-heading");
      const title = header?.querySelector<HTMLElement>(".app-page-title");
      const back = header?.querySelector<HTMLElement>(".app-page-back-link");
      const icon = back?.querySelector<HTMLElement>(".app-page-back-link-icon");
      if (!header || !content || !heading || !title || !back || !icon) {
        throw new Error("New Course header contract is missing");
      }

      const headerStyle = getComputedStyle(header);
      const headerRect = header.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const backRect = back.getBoundingClientRect();
      const innerWidth =
        headerRect.width -
        Number.parseFloat(headerStyle.paddingLeft) -
        Number.parseFloat(headerStyle.paddingRight);

      return {
        display: headerStyle.display,
        hasActionsClass: header.classList.contains(
          "app-page-header-with-actions",
        ),
        actionCount: header.querySelectorAll(".app-page-actions").length,
        contentOwnsInnerWidth: Math.abs(contentRect.width - innerWidth),
        titleOwnsContentWidth: Math.abs(titleRect.width - contentRect.width),
        backColor: getComputedStyle(back).color,
        iconColor: getComputedStyle(icon).color,
        headerToBackGap: backRect.top - headerRect.top,
        backToHeadingGap: headingRect.top - backRect.bottom,
      };
    });
    assert.deepEqual(
      {
        display: newCourseHeader.display,
        hasActionsClass: newCourseHeader.hasActionsClass,
        actionCount: newCourseHeader.actionCount,
        backColor: newCourseHeader.backColor,
        iconColor: newCourseHeader.iconColor,
      },
      {
        display: "flex",
        hasActionsClass: false,
        actionCount: 0,
        backColor: "rgb(20, 20, 20)",
        iconColor: "rgb(20, 20, 20)",
      },
    );
    assert.ok(newCourseHeader.contentOwnsInnerWidth < 0.5);
    assert.ok(newCourseHeader.titleOwnsContentWidth < 0.5);
    assert.ok(Math.abs(newCourseHeader.headerToBackGap - 20) < 0.5);
    assert.ok(Math.abs(newCourseHeader.backToHeadingGap - 20) < 0.5);

    const aboutTab = runtime.page.getByRole("tab", {
      name: "О курсе",
      exact: true,
    });
    assert.equal(
      await runtime.page.evaluate(
        () =>
          document
            .querySelector('[role="tab"][aria-selected="true"]')
            ?.textContent?.trim() ?? "",
      ),
      "О курсе",
    );

    const titleInput = runtime.page.getByLabel("Название");
    await titleInput.fill("Черновик нового курса");
    await runtime.page
      .getByRole("tab", { name: "Материалы", exact: true })
      .click();
    await runtime.page
      .getByRole("heading", {
        name: "Файлы и изображения",
        exact: true,
        level: 2,
      })
      .waitFor();
    await runtime.page.getByRole("tab", { name: "Уроки", exact: true }).click();
    await runtime.page
      .getByRole("heading", {
        name: "Уроки появятся после сохранения",
        exact: true,
        level: 2,
      })
      .waitFor();
    await aboutTab.click();
    assert.equal(await titleInput.inputValue(), "Черновик нового курса");
  } finally {
    await runtime.close();
  }
});

test("browser smoke: course opens lesson workspace and returns to the course", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eSecondCourseVisible = true;
  e2eSecondLessonVisible = true;
  e2eComponentLearnerVisible = false;
  e2eStudentScreenRpcPayloads.length = 0;
  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.goto("/courses", { waitUntil: "networkidle" });
    const courseLink = runtime.page.getByRole("link", {
      name: E2E_COURSE_TITLE,
      exact: true,
    });
    await courseLink.waitFor();
    const coursesVisual = await runtime.page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".course-demo-shell");
      const topNav = document.querySelector<HTMLElement>(".course-top-nav");
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeaderContent = pageHeader?.querySelector<HTMLElement>(
        ".app-page-header-content",
      );
      const backSlot = pageHeader?.querySelector<HTMLElement>(
        ".app-page-back-slot",
      );
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
      const titleRow = pageHeading?.querySelector<HTMLElement>(
        ".app-page-title-row",
      );
      const header = document.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );
      const title = document.querySelector<HTMLElement>(".app-page-title");
      const description = document.querySelector<HTMLElement>(
        ".app-page-description",
      );
      const headerActions =
        pageHeader?.querySelector<HTMLElement>(".app-page-actions");
      const primaryButton = pageHeader?.querySelector<HTMLElement>(
        ".product-btn-primary",
      );
      const navPill = document.querySelector<HTMLElement>(
        ".site-header-shell-demo .site-header-nav-pill",
      );
      const userTrigger = document.querySelector<HTMLElement>(
        ".site-header-shell-demo .nav-profile-link",
      );
      const toolbar = document.querySelector<HTMLElement>(
        ".course-index-toolbar",
      );
      const toolbarSearch = toolbar?.querySelector<HTMLElement>(
        ".compact-toolbar-search",
      );
      const toolbarSearchInput = toolbarSearch?.querySelector<HTMLInputElement>(
        "input.product-control-search",
      );
      const toolbarSearchIcon = toolbarSearch?.querySelector<SVGElement>(
        ".product-search-icon",
      );
      const toolbarRail = toolbar?.querySelector<HTMLElement>(
        ".compact-toolbar-rail",
      );
      const viewSwitch = toolbar?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Вид списка курсов"]',
      );
      const activeViewButton = viewSwitch?.querySelector<HTMLElement>(
        'button[aria-pressed="true"]',
      );

      if (
        !shell ||
        !topNav ||
        !pageHeader ||
        !pageHeaderContent ||
        !backSlot ||
        !pageHeading ||
        !titleRow ||
        !header ||
        !title ||
        !headerActions ||
        !primaryButton ||
        !navPill ||
        !userTrigger ||
        !toolbar ||
        !toolbarSearch ||
        !toolbarSearchInput ||
        !toolbarSearchIcon ||
        !toolbarRail ||
        !viewSwitch ||
        !activeViewButton
      ) {
        throw new Error("Course visual contract elements are missing");
      }

      const shellStyle = getComputedStyle(shell);
      const pageHeaderStyle = getComputedStyle(pageHeader);
      const backSlotStyle = getComputedStyle(backSlot);
      const titleStyle = getComputedStyle(title);
      const buttonStyle = getComputedStyle(primaryButton);
      const headerStyle = getComputedStyle(header);
      const navPillStyle = getComputedStyle(navPill);
      const userTriggerStyle = getComputedStyle(userTrigger);
      const toolbarStyle = getComputedStyle(toolbar);
      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarSearchRect = toolbarSearch.getBoundingClientRect();
      const toolbarRailRect = toolbarRail.getBoundingClientRect();
      const toolbarSearchInputStyle = getComputedStyle(toolbarSearchInput);
      const toolbarSearchPlaceholderStyle = getComputedStyle(
        toolbarSearchInput,
        "::placeholder",
      );
      const toolbarSearchIconStyle = getComputedStyle(toolbarSearchIcon);
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const backSlotRect = backSlot.getBoundingClientRect();
      const pageHeadingRect = pageHeading.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();
      const primaryButtonRect = primaryButton.getBoundingClientRect();

      return {
        shellBackgroundColor: shellStyle.backgroundColor,
        shellBackgroundImage: shellStyle.backgroundImage,
        topNavPosition: getComputedStyle(topNav).position,
        headerHeight: headerStyle.height,
        headerPaddingTop: headerStyle.paddingTop,
        headerPaddingBottom: headerStyle.paddingBottom,
        headerRadius: headerStyle.borderRadius,
        headerBoxShadow: headerStyle.boxShadow,
        titleFontFamily: titleStyle.fontFamily,
        titleFontSize: titleStyle.fontSize,
        titleFontWeight: titleStyle.fontWeight,
        hasDescription: Boolean(description),
        pageHeaderLayout: {
          minHeight: pageHeaderStyle.minHeight,
          height: pageHeaderRect.height,
          actionsShareTitleRow:
            title.parentElement === titleRow &&
            headerActions.parentElement === titleRow &&
            headerActionsRect.top < titleRect.bottom &&
            headerActionsRect.bottom > titleRect.top,
          titleActionBottomDelta: Math.abs(
            headerActionsRect.bottom - titleRect.bottom,
          ),
          actionControlBottomDelta: Math.abs(
            primaryButtonRect.bottom - titleRect.bottom,
          ),
          backSlotHeight: backSlotRect.height,
          backSlotLineHeight: backSlotStyle.lineHeight,
          backControlCount: backSlot.querySelectorAll("a, button").length,
          headerToBackSlotGap: backSlotRect.top - pageHeaderRect.top,
          backSlotToHeadingGap: pageHeadingRect.top - backSlotRect.bottom,
        },
        headerSignature: {
          titleFontFamily: titleStyle.fontFamily,
          titleFontSize: titleStyle.fontSize,
          titleFontWeight: titleStyle.fontWeight,
          titleLineHeight: titleStyle.lineHeight,
          titleLetterSpacing: titleStyle.letterSpacing,
        },
        bodyFontFamily: getComputedStyle(document.body).fontFamily,
        buttonRadius: buttonStyle.borderRadius,
        buttonFontSize: buttonStyle.fontSize,
        buttonFontWeight: buttonStyle.fontWeight,
        navPillRadius: navPillStyle.borderRadius,
        navPillHeight: navPillStyle.height,
        navPillFontWeight: navPillStyle.fontWeight,
        userTriggerRadius: userTriggerStyle.borderRadius,
        userTriggerFontWeight: userTriggerStyle.fontWeight,
        toolbarSurface: {
          backgroundColor: toolbarStyle.backgroundColor,
          borderTopWidth: toolbarStyle.borderTopWidth,
          boxShadow: toolbarStyle.boxShadow,
          paddingTop: toolbarStyle.paddingTop,
          paddingLeft: toolbarStyle.paddingLeft,
          paddingRight: toolbarStyle.paddingRight,
        },
        toolbarAlignment: {
          searchStartInset: toolbarSearchRect.left - toolbarRect.left,
          railEndInset: toolbarRect.right - toolbarRailRect.right,
        },
        searchControl: {
          boxShadow: toolbarSearchInputStyle.boxShadow,
          color: toolbarSearchInputStyle.color,
          fontSize: toolbarSearchInputStyle.fontSize,
          fontWeight: toolbarSearchInputStyle.fontWeight,
          lineHeight: toolbarSearchInputStyle.lineHeight,
          placeholderColor: toolbarSearchPlaceholderStyle.color,
          placeholderOpacity: toolbarSearchPlaceholderStyle.opacity,
          iconColor: toolbarSearchIconStyle.color,
          iconOpacity: toolbarSearchIconStyle.opacity,
        },
        viewGeometry: {
          shellHeight: getComputedStyle(viewSwitch).height,
          shellWidth: viewSwitch.getBoundingClientRect().width,
          shellPadding: getComputedStyle(viewSwitch).padding,
          shellGap: getComputedStyle(viewSwitch).gap,
          shellBorderTopWidth: getComputedStyle(viewSwitch).borderTopWidth,
          shellBorderTopStyle: getComputedStyle(viewSwitch).borderTopStyle,
          shellBorderTopColor: getComputedStyle(viewSwitch).borderTopColor,
          shellBackgroundClip: getComputedStyle(viewSwitch).backgroundClip,
          activeButtonHeight: getComputedStyle(activeViewButton).height,
        },
        viewButtons: Array.from(viewSwitch.querySelectorAll("button")).map(
          (button) => ({
            label: button.getAttribute("aria-label"),
            pressed: button.getAttribute("aria-pressed"),
          }),
        ),
      };
    });

    assert.equal(coursesVisual.shellBackgroundColor, "rgb(245, 241, 232)");
    assert.equal(coursesVisual.shellBackgroundImage, "none");
    assert.equal(coursesVisual.topNavPosition, "relative");
    assert.equal(coursesVisual.headerHeight, "64px");
    assert.equal(coursesVisual.headerPaddingTop, "12px");
    assert.equal(coursesVisual.headerPaddingBottom, "12px");
    assert.equal(coursesVisual.headerRadius, "20px");
    assert.equal(coursesVisual.headerBoxShadow, E2E_PRODUCT_HEADER_SHADOW);
    assert.equal(coursesVisual.titleFontFamily, coursesVisual.bodyFontFamily);
    assert.equal(coursesVisual.titleFontSize, "48px");
    assert.equal(coursesVisual.titleFontWeight, "400");
    assert.equal(coursesVisual.hasDescription, false);
    assert.ok(
      ["auto", "0px"].includes(coursesVisual.pageHeaderLayout.minHeight),
    );
    assert.ok(coursesVisual.pageHeaderLayout.height > 0);
    assert.ok(coursesVisual.pageHeaderLayout.height < 200);
    assert.equal(coursesVisual.pageHeaderLayout.actionsShareTitleRow, true);
    assert.ok(coursesVisual.pageHeaderLayout.titleActionBottomDelta < 0.5);
    assert.ok(coursesVisual.pageHeaderLayout.actionControlBottomDelta < 0.5);
    assert.ok(
      Math.abs(
        coursesVisual.pageHeaderLayout.backSlotHeight -
          Number.parseFloat(coursesVisual.pageHeaderLayout.backSlotLineHeight),
      ) < 0.5,
    );
    assert.equal(coursesVisual.pageHeaderLayout.backControlCount, 0);
    assert.ok(
      Math.abs(coursesVisual.pageHeaderLayout.headerToBackSlotGap - 20) < 0.5,
    );
    assert.ok(
      Math.abs(coursesVisual.pageHeaderLayout.backSlotToHeadingGap - 20) < 0.5,
    );
    assert.equal(coursesVisual.buttonRadius, "12px");
    assert.equal(coursesVisual.buttonFontWeight, "400");
    assert.equal(coursesVisual.navPillRadius, "12px");
    assert.equal(coursesVisual.navPillHeight, "40px");
    assert.equal(coursesVisual.navPillFontWeight, "400");
    assert.equal(coursesVisual.userTriggerRadius, "12px");
    assert.equal(coursesVisual.userTriggerFontWeight, "400");
    assert.deepEqual(coursesVisual.toolbarSurface, {
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderTopWidth: "0px",
      boxShadow: "none",
      paddingTop: "0px",
      paddingLeft: "0px",
      paddingRight: "0px",
    });
    assert.ok(Math.abs(coursesVisual.toolbarAlignment.searchStartInset) < 0.5);
    assert.ok(Math.abs(coursesVisual.toolbarAlignment.railEndInset) < 0.5);
    assert.deepEqual(coursesVisual.searchControl, {
      boxShadow: E2E_ENTRY_CONTROL_SHADOW,
      color: "rgb(20, 20, 20)",
      fontSize: "14.08px",
      fontWeight: "400",
      lineHeight: "16.896px",
      placeholderColor: "rgb(20, 20, 20)",
      placeholderOpacity: "1",
      iconColor: "rgb(20, 20, 20)",
      iconOpacity: "1",
    });
    assert.deepEqual(coursesVisual.viewGeometry, {
      shellHeight: "40px",
      shellWidth: 80,
      shellPadding: "0px",
      shellGap: "2px",
      shellBorderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      shellBorderTopStyle: "solid",
      shellBorderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
      shellBackgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      activeButtonHeight: "38px",
    });
    assert.deepEqual(coursesVisual.viewButtons, [
      { label: "Показать таблицей", pressed: "true" },
      { label: "Показать карточками", pressed: "false" },
    ]);

    const topNavScrollContract = await runtime.page.evaluate(async () => {
      const topNav = document.querySelector<HTMLElement>(".course-top-nav");
      if (!topNav) throw new Error("Product TopNav is missing");

      const spacer = document.createElement("div");
      spacer.style.height = "200vh";
      spacer.setAttribute("data-e2e-scroll-spacer", "");
      document.body.append(spacer);

      const initialBottom = topNav.getBoundingClientRect().bottom;
      window.scrollTo(0, initialBottom + window.scrollY + 1);
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolve()),
        ),
      );
      const scrolledBottom = topNav.getBoundingClientRect().bottom;
      const scrollY = window.scrollY;

      window.scrollTo(0, 0);
      spacer.remove();
      return { initialBottom, scrolledBottom, scrollY };
    });
    assert.ok(topNavScrollContract.initialBottom > 0);
    assert.ok(topNavScrollContract.scrollY > 0);
    assert.ok(
      topNavScrollContract.scrolledBottom < 0,
      "Normal-flow product TopNav must leave the viewport with page content",
    );
    assert.ok(
      Math.abs(Number.parseFloat(coursesVisual.buttonFontSize) - 14.08) < 0.1,
    );

    assert.equal(
      await runtime.page
        .locator(".course-index-toolbar .course-filter-menu")
        .count(),
      0,
    );
    assert.equal(
      await runtime.page.locator(".course-index-toolbar select").count(),
      0,
    );

    await runtime.page
      .getByRole("tab", { name: "Каталог", exact: true })
      .click();
    await runtime.page.waitForURL(/\/courses\?tab=catalog$/);
    const catalogPanel = runtime.page.getByRole("tabpanel", {
      name: "Каталог",
      exact: true,
    });
    await runtime.page.locator(".course-catalog-toolbar").waitFor();
    const catalogToolbarContract = await runtime.page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(
        ".course-catalog-toolbar",
      );
      const search = toolbar?.querySelector<HTMLElement>(
        ".compact-toolbar-search",
      );
      const audience = toolbar?.querySelector<HTMLElement>(
        ".course-catalog-audience-control",
      );
      const rail = toolbar?.querySelector<HTMLElement>(".compact-toolbar-rail");
      const view = rail?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Вид каталога курсов"]',
      );
      if (!toolbar || !search || !audience || !rail || !view) {
        throw new Error("Catalog toolbar contract is missing");
      }
      const style = getComputedStyle(toolbar);
      const rect = toolbar.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();
      const audienceRect = audience.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const viewRect = view.getBoundingClientRect();
      const centerY = (elementRect: DOMRect) =>
        elementRect.top + elementRect.height / 2;
      return {
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        searchStartInset: searchRect.left - rect.left,
        audienceViewGap: viewRect.left - audienceRect.right,
        audienceViewCenterDelta: centerY(audienceRect) - centerY(viewRect),
        railEndInset: rect.right - railRect.right,
        searchBeforeRail: Boolean(
          search.compareDocumentPosition(rail) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        audienceBeforeView: Boolean(
          audience.compareDocumentPosition(view) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      };
    });
    assert.equal(catalogToolbarContract.paddingLeft, "0px");
    assert.equal(catalogToolbarContract.paddingRight, "0px");
    assert.ok(Math.abs(catalogToolbarContract.searchStartInset) < 0.5);
    assert.ok(catalogToolbarContract.audienceViewGap >= 0);
    assert.ok(Math.abs(catalogToolbarContract.audienceViewCenterDelta) < 0.5);
    assert.ok(Math.abs(catalogToolbarContract.railEndInset) < 0.5);
    assert.equal(catalogToolbarContract.searchBeforeRail, true);
    assert.equal(catalogToolbarContract.audienceBeforeView, true);
    assert.equal(
      await runtime.page
        .locator(".course-catalog-toolbar .course-filter-menu")
        .count(),
      0,
    );
    assert.equal(
      await runtime.page.locator(".course-catalog-toolbar select").count(),
      0,
    );
    assert.equal(
      await catalogPanel.getByText("Готовые курсы", { exact: true }).count(),
      0,
    );
    assert.equal(
      await catalogPanel
        .getByText("Добавьте курс себе и измените уроки так, как вам нужно.", {
          exact: true,
        })
        .count(),
      0,
    );
    assert.equal(
      await runtime.page
        .locator("#courses-index-panel-catalog .compact-toolbar-result")
        .count(),
      0,
    );
    const catalogView = catalogPanel.getByRole("group", {
      name: "Вид каталога курсов",
      exact: true,
    });
    assert.equal(await catalogView.getByRole("button").count(), 2);
    assert.deepEqual(
      await runtime.page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '[role="group"][aria-label="Вид каталога курсов"] button',
          ),
        ).map((button) => ({
          label: button.getAttribute("aria-label"),
          pressed: button.getAttribute("aria-pressed"),
        })),
      ),
      [
        { label: "Показать таблицей", pressed: "true" },
        { label: "Показать карточками", pressed: "false" },
      ],
    );
    await runtime.page
      .getByRole("heading", {
        name: "В каталоге пока нет курсов",
        exact: true,
      })
      .waitFor();

    const audienceControl = catalogPanel.getByRole("group", {
      name: "Направление обучения",
      exact: true,
    });
    await audienceControl
      .getByRole("button", { name: "Обучение педагогов", exact: true })
      .click();
    await runtime.page.waitForURL(/\/courses\?tab=catalog&audience=educators$/);
    await catalogPanel
      .getByRole("button", {
        name: E2E_EDUCATOR_COURSE_TITLE,
        exact: true,
      })
      .waitFor();
    await assertCanonicalFirstBodyRowTypography(
      catalogPanel.locator(".course-index-catalog-table"),
      "Каталог",
    );
    await assertCourseTableFitsAndTruncates(
      catalogPanel.locator(".course-index-catalog-table"),
      "Каталог",
    );
    assert.equal(
      await audienceControl
        .getByRole("button", { name: "Обучение педагогов", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await runtime.page.goto("/courses?tab=catalog&audience=educators", {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByRole("tabpanel", { name: "Каталог", exact: true })
      .getByRole("button", {
        name: E2E_EDUCATOR_COURSE_TITLE,
        exact: true,
      })
      .waitFor();
    assert.equal(
      await runtime.page
        .getByText("Не удалось связаться с каталогом курсов.", { exact: true })
        .count(),
      0,
    );

    await catalogPanel
      .getByRole("button", {
        name: E2E_EDUCATOR_COURSE_TITLE,
        exact: true,
      })
      .click();
    await runtime.page.waitForURL(
      new RegExp(
        `/courses/catalog/${E2E_EDUCATOR_PUBLICATION_ID}\\?audience=educators$`,
      ),
    );
    await runtime.page
      .getByRole("heading", {
        name: E2E_EDUCATOR_COURSE_TITLE,
        exact: true,
        level: 1,
      })
      .waitFor();
    assert.equal(
      await runtime.page
        .getByRole("group", { name: "Направление обучения", exact: true })
        .count(),
      0,
    );
    for (const tabName of ["Уроки", "О курсе", "Материалы", "Аттестация"]) {
      await runtime.page
        .getByRole("tab", { name: new RegExp(`^${tabName}`) })
        .waitFor();
    }
    const publishedHeaderMeta = runtime.page.locator(
      ".published-course-workspace .app-page-meta",
    );
    assert.equal(
      await runtime.page
        .locator(".published-course-workspace .app-page-eyebrow")
        .count(),
      0,
    );
    assert.equal(
      await publishedHeaderMeta.getByText("ShiDao", { exact: true }).count(),
      0,
    );
    await publishedHeaderMeta
      .getByText("Автор: adult-e2e@example.test", { exact: true })
      .waitFor();
    await publishedHeaderMeta
      .getByText("Аттестован", { exact: true })
      .waitFor();
    assert.equal(
      await runtime.page
        .locator(".published-course-workspace .app-page-actions")
        .count(),
      0,
    );
    const publishedHeaderGeometry = await runtime.page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(
        ".published-course-workspace .app-page-header",
      );
      const content = header?.querySelector<HTMLElement>(
        ".app-page-header-content",
      );
      const title = header?.querySelector<HTMLElement>(".app-page-title");
      const meta = header?.querySelector<HTMLElement>(".app-page-meta");
      const actions = header?.querySelector<HTMLElement>(".app-page-actions");
      const attestation = meta?.querySelector<HTMLElement>(
        ".published-course-header-status",
      );
      const author = meta?.querySelector<HTMLElement>(
        ".published-course-header-author",
      );
      if (!header || !content || !title || !meta || !attestation || !author) {
        throw new Error("Published Course header geometry is missing");
      }

      const headerStyle = getComputedStyle(header);
      const headerRect = header.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const attestationRect = attestation.getBoundingClientRect();
      const authorRect = author.getBoundingClientRect();

      return {
        titleUsesHeadingColumn: Math.abs(titleRect.width - contentRect.width),
        metaInsideContent: content.contains(meta),
        hasActions: Boolean(actions),
        attestationAboveAuthor: attestationRect.bottom <= authorRect.top,
        contentWidthDelta: Math.abs(
          contentRect.width -
            (headerRect.width -
              Number.parseFloat(headerStyle.paddingLeft) -
              Number.parseFloat(headerStyle.paddingRight)),
        ),
      };
    });
    assert.ok(publishedHeaderGeometry.titleUsesHeadingColumn < 0.5);
    assert.equal(publishedHeaderGeometry.metaInsideContent, true);
    assert.equal(publishedHeaderGeometry.hasActions, false);
    assert.equal(publishedHeaderGeometry.attestationAboveAuthor, true);
    assert.ok(publishedHeaderGeometry.contentWidthDelta < 0.5);
    assert.equal(
      await runtime.page
        .getByRole("button", { name: "Добавить в мои курсы", exact: true })
        .count(),
      0,
    );
    await runtime.page
      .getByRole("button", { name: "Продолжить", exact: true })
      .click();
    await runtime.page
      .getByText(E2E_EDUCATOR_LEARNER_TEXT, { exact: true })
      .waitFor();
    const publishedLessonHeading = runtime.page.getByRole("heading", {
      name: E2E_EDUCATOR_LESSON_TITLE,
      exact: true,
      level: 2,
    });
    await publishedLessonHeading.waitFor();
    await runtime.page
      .locator(".published-course-lesson-heading h2:focus")
      .waitFor();
    assert.equal(
      await publishedLessonHeading.evaluate(
        (node) => node === document.activeElement,
      ),
      true,
    );
    assert.equal(
      await runtime.page
        .getByRole("button", {
          name: `Снять отметку о прохождении урока «${E2E_EDUCATOR_LESSON_TITLE}»`,
          exact: true,
        })
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await runtime.page.getByText(E2E_EDUCATOR_PRIVATE_TEXT).count(),
      0,
    );
    await runtime.page
      .getByRole("tab", { name: "Аттестация", exact: true })
      .click();
    await runtime.page
      .getByText("Аттестация пройдена", { exact: true })
      .waitFor();
    assert.equal(
      await runtime.page
        .getByText("Не удалось выполнить операцию с курсом.", { exact: true })
        .count(),
      0,
    );
    await runtime.page
      .getByRole("link", { name: "Вернуться: Каталог", exact: true })
      .click();
    await runtime.page.waitForURL(/\/courses\?tab=catalog&audience=educators$/);

    await runtime.page.getByRole("tab", { name: "Мои", exact: true }).click();
    await runtime.page.waitForURL(/\/courses$/);
    await courseLink.waitFor();

    const courseSearch = runtime.page.getByRole("searchbox", {
      name: "Поиск",
      exact: true,
    });
    await courseSearch.fill("курс которого нет");
    await runtime.page
      .getByRole("heading", { name: "Ничего не найдено", exact: true })
      .waitFor();
    await runtime.page
      .locator(".course-index-toolbar .compact-toolbar-reset")
      .click();
    await courseLink.waitFor();

    await runtime.page
      .getByRole("button", { name: "Показать таблицей", exact: true })
      .click();
    await runtime.page
      .getByRole("region", { name: "Таблица курсов", exact: true })
      .waitFor();
    await assertCanonicalFirstBodyRowTypography(
      runtime.page.locator(".course-index-owned-table"),
      "Мои курсы",
    );
    await assertCourseTableFitsAndTruncates(
      runtime.page.locator(".course-index-owned-table"),
      "Мои курсы",
    );
    const ownedCourseTableSurface = await runtime.page.evaluate(() => {
      const wrapper = document.querySelector<HTMLElement>(
        '[aria-label="Таблица курсов"].product-table-wrap',
      );
      const table = wrapper?.querySelector<HTMLTableElement>(".product-table");
      if (!wrapper || !table) {
        throw new Error("Owned Course table surface is missing");
      }
      const wrapperStyle = getComputedStyle(wrapper);
      const headerRow = table.tHead?.rows[0];
      const firstRow = table.tBodies[0]?.rows[0];
      const firstCell = firstRow?.cells[0];
      const actionCell = firstRow?.cells[firstRow.cells.length - 1];
      if (!headerRow || !firstRow || !firstCell || !actionCell) {
        throw new Error("Owned Course table geometry is missing");
      }
      return {
        wrapperBackgroundColor: wrapperStyle.backgroundColor,
        tableBackgroundColor: getComputedStyle(table).backgroundColor,
        wrapperBorderWidths: [
          wrapperStyle.borderTopWidth,
          wrapperStyle.borderRightWidth,
          wrapperStyle.borderBottomWidth,
          wrapperStyle.borderLeftWidth,
        ],
        wrapperBorderRadius: wrapperStyle.borderRadius,
        wrapperBoxShadow: wrapperStyle.boxShadow,
        wrapperTransform: wrapperStyle.transform,
        headerHeight: headerRow.getBoundingClientRect().height,
        rowHeights: Array.from(table.tBodies[0]?.rows ?? []).map(
          (row) => row.getBoundingClientRect().height,
        ),
        firstCellPaddingLeft: getComputedStyle(firstCell).paddingLeft,
        firstCellPaddingRight: getComputedStyle(firstCell).paddingRight,
        actionCellPaddingLeft: getComputedStyle(actionCell).paddingLeft,
        actionCellPaddingRight: getComputedStyle(actionCell).paddingRight,
        headerDivider: getComputedStyle(headerRow.cells[0]!).borderBottomColor,
        bodyDivider: getComputedStyle(firstRow).borderTopColor,
      };
    });
    assert.equal(
      ownedCourseTableSurface.wrapperBackgroundColor,
      "rgb(255, 255, 255)",
    );
    assert.equal(
      ownedCourseTableSurface.tableBackgroundColor,
      "rgb(255, 255, 255)",
    );
    assert.deepEqual(ownedCourseTableSurface.wrapperBorderWidths, [
      "1px",
      "1px",
      "1px",
      "1px",
    ]);
    assert.equal(ownedCourseTableSurface.wrapperBorderRadius, "12px");
    assert.equal(
      ownedCourseTableSurface.wrapperBoxShadow,
      E2E_RAISED_SURFACE_SHADOW,
    );
    assert.equal(ownedCourseTableSurface.wrapperTransform, "none");
    assert.ok(Math.abs(ownedCourseTableSurface.headerHeight - 40) < 0.5);
    assert.ok(
      ownedCourseTableSurface.rowHeights.every(
        (height) => Math.abs(height - 40) < 0.5,
      ),
    );
    assert.equal(ownedCourseTableSurface.firstCellPaddingLeft, "12px");
    assert.equal(ownedCourseTableSurface.firstCellPaddingRight, "12px");
    assert.equal(ownedCourseTableSurface.actionCellPaddingLeft, "4px");
    assert.equal(ownedCourseTableSurface.actionCellPaddingRight, "4px");
    assert.equal(
      ownedCourseTableSurface.headerDivider,
      ownedCourseTableSurface.bodyDivider,
    );
    const ownedCourseTableWrapper = runtime.page.locator(
      '[aria-label="Таблица курсов"].product-table-wrap',
    );
    await ownedCourseTableWrapper.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await ownedCourseTableWrapper.evaluate((surface) => {
        const style = getComputedStyle(surface);
        return {
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      { boxShadow: E2E_RAISED_SURFACE_SHADOW, transform: "none" },
    );
    assert.equal(
      await runtime.page
        .getByRole("button", { name: "Показать таблицей", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );

    const titleHeader = runtime.page.getByRole("columnheader", {
      name: "Курс",
      exact: true,
    });
    assert.equal(await titleHeader.getAttribute("aria-sort"), "none");
    await titleHeader
      .getByRole("button", { name: "Курс", exact: true })
      .click();
    assert.equal(await titleHeader.getAttribute("aria-sort"), "ascending");
    assert.deepEqual(
      await runtime.page
        .locator('[aria-label="Таблица курсов"] tbody tr td:first-child')
        .allTextContents(),
      [E2E_COURSE_TITLE, E2E_SECOND_COURSE_ROW.title],
    );
    await titleHeader
      .getByRole("button", { name: "Курс", exact: true })
      .click();
    assert.equal(await titleHeader.getAttribute("aria-sort"), "descending");
    assert.deepEqual(
      await runtime.page
        .locator('[aria-label="Таблица курсов"] tbody tr td:first-child')
        .allTextContents(),
      [E2E_SECOND_COURSE_ROW.title, E2E_COURSE_TITLE],
    );

    const ownedCourseRow = runtime.page.locator(
      `[aria-label="Таблица курсов"] tbody tr:has-text("${E2E_COURSE_TITLE}")`,
    );
    const courseActionsTrigger = ownedCourseRow.getByRole("button", {
      name: `Действия с курсом «${E2E_COURSE_TITLE}»`,
      exact: true,
    });
    assert.equal(
      await courseActionsTrigger.locator(".lucide-ellipsis-vertical").count(),
      1,
    );
    await courseActionsTrigger.click();
    const courseActionMenu = runtime.page.locator(
      "body > .action-menu-panel-portal",
    );
    await courseActionMenu.waitFor();
    for (const label of ["Дублировать", "Опубликовать", "Удалить"]) {
      await courseActionMenu
        .getByRole("menuitem", { name: label, exact: true })
        .waitFor();
    }
    const courseActionMenuSurface = await courseActionMenu.evaluate((menu) => {
      const style = getComputedStyle(menu);
      return {
        borderWidths: [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ],
        borderRadius: style.borderRadius,
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        separatorCount: menu.querySelectorAll(
          '[role="separator"], .action-menu-separator',
        ).length,
      };
    });
    assert.deepEqual(courseActionMenuSurface, {
      borderWidths: ["0px", "0px", "0px", "0px"],
      borderRadius: "12px",
      backgroundColor: "rgb(255, 255, 255)",
      boxShadow: E2E_DROPDOWN_SHADOW,
      separatorCount: 0,
    });
    await courseActionMenu
      .getByRole("menuitem", { name: "Удалить", exact: true })
      .click();
    const deleteCourseDialog = runtime.page.getByRole("dialog", {
      name: "Удалить курс из списка?",
      exact: true,
    });
    await deleteCourseDialog.waitFor();
    assert.equal(
      await runtime.page.locator("body > .dialog-shell-overlay").count(),
      1,
    );
    await deleteCourseDialog
      .getByRole("button", { name: "Отмена", exact: true })
      .click();
    await ownedCourseRow.waitFor();
    assert.equal(
      await courseActionsTrigger.evaluate(
        (node) => node === document.activeElement,
      ),
      true,
    );

    const secondCourseRow = runtime.page.locator(
      `[aria-label="Таблица курсов"] tbody tr:has-text("${E2E_SECOND_COURSE_ROW.title}")`,
    );
    await secondCourseRow
      .getByRole("button", {
        name: `Действия с курсом «${E2E_SECOND_COURSE_ROW.title}»`,
        exact: true,
      })
      .click();
    await runtime.page
      .getByRole("menuitem", { name: "Удалить", exact: true })
      .click();
    const confirmSecondCourseDelete = runtime.page.getByRole("dialog", {
      name: "Удалить курс из списка?",
      exact: true,
    });
    await confirmSecondCourseDelete.waitFor();
    await confirmSecondCourseDelete
      .getByRole("button", { name: "Удалить", exact: true })
      .click();
    await secondCourseRow.waitFor({ state: "detached" });
    await ownedCourseRow.waitFor();

    await runtime.page
      .getByRole("button", { name: "Показать карточками", exact: true })
      .click();
    await courseLink.waitFor();

    await runtime.page.evaluate(() => {
      const deprecatedLoaderText =
        "Загружаем курс, уроки и компоненты из базы…";
      const testWindow = window as typeof window & {
        __e2eDeprecatedCourseLoaderSeen?: boolean;
        __e2eDeprecatedCourseLoaderObserver?: MutationObserver;
      };
      testWindow.__e2eDeprecatedCourseLoaderObserver?.disconnect();
      testWindow.__e2eDeprecatedCourseLoaderSeen =
        document.body.textContent?.includes(deprecatedLoaderText) ?? false;
      const observer = new MutationObserver((records) => {
        const mutationIncludesDeprecatedLoader = records.some(
          (record) =>
            record.oldValue?.includes(deprecatedLoaderText) ||
            record.target.textContent?.includes(deprecatedLoaderText) ||
            Array.from(record.addedNodes).some((node) =>
              node.textContent?.includes(deprecatedLoaderText),
            ),
        );
        if (
          mutationIncludesDeprecatedLoader ||
          document.body.textContent?.includes(deprecatedLoaderText)
        ) {
          testWindow.__e2eDeprecatedCourseLoaderSeen = true;
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: true,
      });
      testWindow.__e2eDeprecatedCourseLoaderObserver = observer;
    });

    const forwardPageTransition = runtime.page.locator(
      'html[data-page-transition-direction="forward"]',
    );
    await forwardPageTransition.waitFor({ state: "detached" });
    await Promise.all([
      runtime.page.waitForURL(new RegExp(`/courses/${E2E_COURSE_ID}$`)),
      forwardPageTransition.waitFor(),
      courseLink.click(),
    ]);

    const courseHeading = runtime.page.getByRole("heading", {
      name: E2E_COURSE_TITLE,
      exact: true,
      level: 1,
    });
    await courseHeading.waitFor();
    await forwardPageTransition.waitFor({ state: "detached" });
    const courseLoaderTransitionContract = await runtime.page.evaluate(() => {
      const deprecatedLoaderText =
        "Загружаем курс, уроки и компоненты из базы…";
      const testWindow = window as typeof window & {
        __e2eDeprecatedCourseLoaderSeen?: boolean;
        __e2eDeprecatedCourseLoaderObserver?: MutationObserver;
      };
      const pendingRecords =
        testWindow.__e2eDeprecatedCourseLoaderObserver?.takeRecords() ?? [];
      if (
        pendingRecords.some(
          (record) =>
            record.oldValue?.includes(deprecatedLoaderText) ||
            record.target.textContent?.includes(deprecatedLoaderText) ||
            Array.from(record.addedNodes).some((node) =>
              node.textContent?.includes(deprecatedLoaderText),
            ),
        )
      ) {
        testWindow.__e2eDeprecatedCourseLoaderSeen = true;
      }
      testWindow.__e2eDeprecatedCourseLoaderObserver?.disconnect();
      delete testWindow.__e2eDeprecatedCourseLoaderObserver;

      const header = document.querySelector<HTMLElement>(".app-page-header");
      const title = header?.querySelector<HTMLElement>(".app-page-title");
      const metric = header?.querySelector<HTMLElement>(".app-page-metric");
      const actions = header?.querySelector<HTMLElement>(".app-page-actions");
      const action = actions?.querySelector<HTMLButtonElement>("button");
      if (!header || !title || !metric || !actions || !action) {
        throw new Error("Resolved Course header contract is missing");
      }
      return {
        deprecatedLoaderSeen:
          testWindow.__e2eDeprecatedCourseLoaderSeen === true,
        deprecatedLoaderPresent:
          document.body.textContent?.includes(deprecatedLoaderText) ?? false,
        pending: header.hasAttribute("data-page-header-pending"),
        title: title.textContent?.trim() ?? "",
        metric: metric.textContent?.trim() ?? "",
        metricPlaceholder: metric.hasAttribute(
          "data-page-header-metric-placeholder",
        ),
        actionLabel: action.getAttribute("aria-label"),
        titleVisible: getComputedStyle(title).visibility,
        metricVisible: getComputedStyle(metric).visibility,
        actionsVisible: getComputedStyle(actions).visibility,
      };
    });
    assert.deepEqual(
      {
        deprecatedLoaderSeen:
          courseLoaderTransitionContract.deprecatedLoaderSeen,
        deprecatedLoaderPresent:
          courseLoaderTransitionContract.deprecatedLoaderPresent,
        pending: courseLoaderTransitionContract.pending,
        title: courseLoaderTransitionContract.title,
        metricPlaceholder: courseLoaderTransitionContract.metricPlaceholder,
        actionLabel: courseLoaderTransitionContract.actionLabel,
        titleVisible: courseLoaderTransitionContract.titleVisible,
        metricVisible: courseLoaderTransitionContract.metricVisible,
        actionsVisible: courseLoaderTransitionContract.actionsVisible,
      },
      {
        deprecatedLoaderSeen: false,
        deprecatedLoaderPresent: false,
        pending: false,
        title: E2E_COURSE_TITLE,
        metricPlaceholder: false,
        actionLabel: `Действия с курсом «${E2E_COURSE_TITLE}»`,
        titleVisible: "visible",
        metricVisible: "visible",
        actionsVisible: "visible",
      },
    );
    assert.match(
      courseLoaderTransitionContract.metric,
      /^Уроков: \d+ из \d+ · учеников: \d+ · вложений: \d+$/,
    );
    await runtime.page
      .locator('.workspace-tabs-indicator[data-motion-ready="true"]')
      .waitFor();
    await runtime.page.evaluate(async () => {
      const indicator = document.querySelector<HTMLElement>(
        ".workspace-tabs-indicator",
      );
      await Promise.all(
        (indicator?.getAnimations() ?? []).map((animation) =>
          animation.finished.catch(() => undefined),
        ),
      );
    });
    const courseVisual = await runtime.page.evaluate(() => {
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
      const titleRow = pageHeading?.querySelector<HTMLElement>(
        ".app-page-title-row",
      );
      const pageHeaderContent = pageHeader?.querySelector<HTMLElement>(
        ".app-page-header-content",
      );
      const title = pageHeader?.querySelector<HTMLElement>(".app-page-title");
      const description = pageHeader?.querySelector<HTMLElement>(
        ".app-page-description",
      );
      const tab = document.querySelector<HTMLElement>(".workspace-tab-active");
      const inactiveTab = document.querySelector<HTMLElement>(
        ".workspace-tab:not(.workspace-tab-active)",
      );
      const tabs = document.querySelector<HTMLElement>(".workspace-tabs");
      const indicator = tabs?.querySelector<HTMLElement>(
        ".workspace-tabs-indicator",
      );
      const headerActions =
        pageHeader?.querySelector<HTMLElement>(".app-page-actions");
      const backLink = pageHeader?.querySelector<HTMLElement>(
        ".app-page-back-link",
      );
      const backIcon = backLink?.querySelector<HTMLElement>(
        ".app-page-back-link-icon",
      );
      const backLabel = backLink?.querySelector<HTMLElement>(
        ".app-page-back-link-label",
      );
      const siteHeader = document.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );

      if (
        !pageHeader ||
        !pageHeading ||
        !titleRow ||
        !pageHeaderContent ||
        !title ||
        !description ||
        !tab ||
        !inactiveTab ||
        !tabs ||
        !indicator ||
        !headerActions ||
        !backLink ||
        !backIcon ||
        !backLabel ||
        !siteHeader
      ) {
        const missing = [
          ["pageHeader", pageHeader],
          ["pageHeading", pageHeading],
          ["titleRow", titleRow],
          ["pageHeaderContent", pageHeaderContent],
          ["title", title],
          ["description", description],
          ["tab", tab],
          ["inactiveTab", inactiveTab],
          ["tabs", tabs],
          ["indicator", indicator],
          ["headerActions", headerActions],
          ["backLink", backLink],
          ["backIcon", backIcon],
          ["backLabel", backLabel],
          ["siteHeader", siteHeader],
        ]
          .filter(([, element]) => !element)
          .map(([name]) => name)
          .join(", ");
        throw new Error(`Course workspace elements missing: ${missing}`);
      }

      const headerStyle = getComputedStyle(pageHeader);
      const headingStyle = getComputedStyle(pageHeading);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const tabsStyle = getComputedStyle(tabs);
      const tabStyle = getComputedStyle(tab);
      const inactiveTabStyle = getComputedStyle(inactiveTab);
      const markerStyle = getComputedStyle(tab, "::after");
      const indicatorStyle = getComputedStyle(indicator);
      const baselineStyle = getComputedStyle(tabs, "::before");
      const baselineScaleY = new DOMMatrixReadOnly(baselineStyle.transform).m22;
      const tabRect = tab.getBoundingClientRect();
      const tabsRect = tabs.getBoundingClientRect();
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const pageHeaderContentRect = pageHeaderContent.getBoundingClientRect();
      const pageHeadingRect = pageHeading.getBoundingClientRect();
      const titleRowRect = titleRow.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();
      const backLinkRect = backLink.getBoundingClientRect();
      const siteHeaderRect = siteHeader.getBoundingClientRect();
      const actionChildRects = Array.from(headerActions.children)
        .map((child) => child.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const actionControlRects = Array.from(
        headerActions.querySelectorAll<HTMLElement>(".product-btn"),
      ).map((control) => control.getBoundingClientRect());
      const actionsContentWidth = actionChildRects.length
        ? Math.max(...actionChildRects.map((rect) => rect.right)) -
          Math.min(...actionChildRects.map((rect) => rect.left))
        : 0;

      return {
        headerBackgroundColor: headerStyle.backgroundColor,
        headerBackgroundImage: headerStyle.backgroundImage,
        headerBorderWidth: headerStyle.borderWidth,
        headerShadow: headerStyle.boxShadow,
        headerLayout: {
          minHeight: headerStyle.minHeight,
          height: pageHeaderRect.height,
          headingMinWidth: headingStyle.minWidth,
          headingWidth: pageHeadingRect.width,
          titleRowOwnsContentWidth: Math.abs(
            titleRowRect.width - pageHeaderContentRect.width,
          ),
          actionsWidth: headerActionsRect.width,
          actionsContentWidth,
          actionsFitContentDelta: Math.abs(
            headerActionsRect.width - actionsContentWidth,
          ),
          actionsRightDelta: Math.abs(
            pageHeaderRect.right -
              Number.parseFloat(headerStyle.paddingRight) -
              headerActionsRect.right,
          ),
          columnGap: headerActionsRect.left - titleRect.right,
          remainingWidthDelta: Math.abs(
            titleRect.width -
              (titleRowRect.width - headerActionsRect.width - 24),
          ),
          actionsShareTitleRow:
            title.parentElement === titleRow &&
            headerActions.parentElement === titleRow &&
            headerActionsRect.top < titleRect.bottom &&
            headerActionsRect.bottom > titleRect.top,
          titleActionBottomDelta: Math.abs(
            headerActionsRect.bottom - titleRect.bottom,
          ),
          actionControlBottomDeltas: actionControlRects.map((rect) =>
            Math.abs(rect.bottom - titleRect.bottom),
          ),
          metricBelowTitleRow: descriptionRect.top >= titleRowRect.bottom - 0.5,
          metricGapDelta: Math.abs(
            descriptionRect.top -
              titleRowRect.bottom -
              Number.parseFloat(headingStyle.rowGap),
          ),
          backLink: {
            color: getComputedStyle(backLink).color,
            iconColor: getComputedStyle(backIcon).color,
            labelWhiteSpace: getComputedStyle(backLabel).whiteSpace,
            headerToBackGap: backLinkRect.top - siteHeaderRect.bottom,
            backToHeadingGap: pageHeadingRect.top - backLinkRect.bottom,
          },
        },
        headerSignature: {
          titleFontFamily: titleStyle.fontFamily,
          titleFontSize: titleStyle.fontSize,
          titleFontWeight: titleStyle.fontWeight,
          titleLineHeight: titleStyle.lineHeight,
          titleLetterSpacing: titleStyle.letterSpacing,
          descriptionFontSize: descriptionStyle.fontSize,
          descriptionLineHeight: descriptionStyle.lineHeight,
          descriptionColor: descriptionStyle.color,
        },
        tabSignature: {
          height: tabStyle.height,
          radius: tabStyle.borderRadius,
          fontWeight: tabStyle.fontWeight,
          activeColor: tabStyle.color,
          inactiveColor: inactiveTabStyle.color,
          gap: tabsStyle.columnGap,
          tabZIndex: tabStyle.zIndex,
          baselinePaintHeight: baselineStyle.height,
          baselineScaleY,
          baselineVisualHeight: Number(
            (
              Number.parseFloat(baselineStyle.height) * Math.abs(baselineScaleY)
            ).toFixed(3),
          ),
          baselineColor: baselineStyle.backgroundColor,
          baselineZIndex: baselineStyle.zIndex,
          baselinePointerEvents: baselineStyle.pointerEvents,
          baselineLeft: baselineStyle.left,
          baselineRight: baselineStyle.right,
          tabsPaddingLeft: tabsStyle.paddingLeft,
          tabsPaddingRight: tabsStyle.paddingRight,
          markerHeight: markerStyle.height,
          markerColor: markerStyle.backgroundColor,
          markerZIndex: markerStyle.zIndex,
          markerRadius: markerStyle.borderRadius,
          markerBottom: markerStyle.bottom,
          markerDisplay: markerStyle.display,
          indicatorHeight: indicatorStyle.height,
          indicatorColor: indicatorStyle.backgroundColor,
          indicatorZIndex: indicatorStyle.zIndex,
          indicatorRadius: indicatorStyle.borderRadius,
          indicatorBottom: indicatorStyle.bottom,
          indicatorReady: indicator.dataset.ready,
          indicatorTransitionProperty: indicatorStyle.transitionProperty,
          indicatorTransitionDuration: indicatorStyle.transitionDuration,
          allTabsHaveIcons: Array.from(
            tabs.querySelectorAll<HTMLElement>(".workspace-tab"),
          ).every((item) => Boolean(item.querySelector(".workspace-tab-icon"))),
        },
        tabBottom: tabRect.bottom,
        tabsBottom: tabsRect.bottom,
      };
    });

    assert.equal(courseVisual.headerBackgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(courseVisual.headerBackgroundImage, "none");
    assert.equal(courseVisual.headerBorderWidth, "0px");
    assert.equal(courseVisual.headerShadow, "none");
    assert.ok(["auto", "0px"].includes(courseVisual.headerLayout.minHeight));
    assert.ok(courseVisual.headerLayout.height > 0);
    assert.ok(courseVisual.headerLayout.height < 200);
    assert.equal(courseVisual.headerLayout.actionsShareTitleRow, true);
    assert.ok(courseVisual.headerLayout.titleActionBottomDelta < 0.5);
    assert.equal(
      courseVisual.headerLayout.actionControlBottomDeltas.every(
        (delta) => delta < 0.5,
      ),
      true,
    );
    assert.equal(courseVisual.headerLayout.metricBelowTitleRow, true);
    assert.ok(courseVisual.headerLayout.metricGapDelta < 0.5);
    assert.equal(courseVisual.headerLayout.headingMinWidth, "0px");
    assert.ok(
      courseVisual.headerLayout.headingWidth >
        courseVisual.headerLayout.actionsWidth,
    );
    assert.ok(courseVisual.headerLayout.actionsContentWidth > 0);
    assert.ok(courseVisual.headerLayout.actionsFitContentDelta < 0.5);
    assert.ok(courseVisual.headerLayout.actionsRightDelta < 0.5);
    assert.ok(courseVisual.headerLayout.titleRowOwnsContentWidth < 0.5);
    assert.ok(courseVisual.headerLayout.remainingWidthDelta < 0.5);
    assert.ok(Math.abs(courseVisual.headerLayout.columnGap - 24) < 0.5);
    assert.deepEqual(
      {
        color: courseVisual.headerLayout.backLink.color,
        iconColor: courseVisual.headerLayout.backLink.iconColor,
        labelWhiteSpace: courseVisual.headerLayout.backLink.labelWhiteSpace,
      },
      {
        color: "rgb(20, 20, 20)",
        iconColor: "rgb(20, 20, 20)",
        labelWhiteSpace: "nowrap",
      },
    );
    assert.ok(
      Math.abs(courseVisual.headerLayout.backLink.headerToBackGap - 20) < 0.5,
    );
    assert.ok(
      Math.abs(courseVisual.headerLayout.backLink.backToHeadingGap - 20) < 0.5,
    );
    assert.ok(
      Math.abs(
        courseVisual.headerLayout.backLink.headerToBackGap -
          courseVisual.headerLayout.backLink.backToHeadingGap,
      ) < 0.5,
    );
    assert.deepEqual(
      {
        titleFontFamily: courseVisual.headerSignature.titleFontFamily,
        titleFontSize: courseVisual.headerSignature.titleFontSize,
        titleFontWeight: courseVisual.headerSignature.titleFontWeight,
        titleLineHeight: courseVisual.headerSignature.titleLineHeight,
        titleLetterSpacing: courseVisual.headerSignature.titleLetterSpacing,
      },
      coursesVisual.headerSignature,
    );
    assert.deepEqual(courseVisual.tabSignature, {
      height: "40px",
      radius: "12px 12px 0px 0px",
      fontWeight: "400",
      activeColor: "rgb(20, 20, 20)",
      inactiveColor: E2E_MUTED_FOREGROUND,
      gap: "12px",
      tabZIndex: "auto",
      baselinePaintHeight: "3px",
      baselineScaleY: 0.4,
      baselineVisualHeight: 1.2,
      baselineColor: E2E_WORKSPACE_TABS_DIVIDER,
      baselineZIndex: "1",
      baselinePointerEvents: "none",
      baselineLeft: "0px",
      baselineRight: "0px",
      tabsPaddingLeft: "0px",
      tabsPaddingRight: "0px",
      markerHeight: "4px",
      markerColor: "rgb(20, 20, 20)",
      markerZIndex: "2",
      markerRadius: "0px",
      markerBottom: "0px",
      markerDisplay: "none",
      indicatorHeight: "4px",
      indicatorColor: "rgb(20, 20, 20)",
      indicatorZIndex: "2",
      indicatorRadius: "0px",
      indicatorBottom: "0px",
      indicatorReady: "true",
      indicatorTransitionProperty: "width, transform, opacity",
      indicatorTransitionDuration: "0.36s, 0.36s, 0.12s",
      allTabsHaveIcons: true,
    });
    assert.ok(Math.abs(courseVisual.tabBottom - courseVisual.tabsBottom) < 0.5);

    await assertCanonicalFirstBodyRowTypography(
      runtime.page.locator(".course-lessons-table"),
      "Уроки курса",
    );
    const courseLessonsVisual = await runtime.page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(
        ".course-lessons-toolbar",
      );
      const search = toolbar?.querySelector<HTMLElement>(
        ".compact-toolbar-search",
      );
      const rail = toolbar?.querySelector<HTMLElement>(".compact-toolbar-rail");
      const wrapper = document.querySelector<HTMLElement>(
        ".course-lessons-table-wrap",
      );
      const table = wrapper?.querySelector<HTMLElement>(
        ".course-lessons-table",
      );
      const headerRow = table?.querySelector<HTMLElement>("thead tr");
      const firstRow = table?.querySelector<HTMLElement>("tbody tr");
      const secondRow = table?.querySelector<HTMLElement>(
        "tbody tr:nth-child(2)",
      );
      const firstCell = firstRow?.querySelector<HTMLElement>("td:first-child");
      const actionCell = firstRow?.querySelector<HTMLElement>("td:last-child");
      const actionTrigger = actionCell?.querySelector<HTMLElement>(
        ".action-menu-trigger",
      );
      const headerCell = table?.querySelector<HTMLElement>("thead th");
      if (
        !toolbar ||
        !search ||
        !rail ||
        !wrapper ||
        !table ||
        !headerRow ||
        !firstRow ||
        !secondRow ||
        !firstCell ||
        !actionCell ||
        !actionTrigger ||
        !headerCell
      ) {
        throw new Error("Course Lessons canonical table is missing");
      }

      const toolbarRect = toolbar.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const wrapperStyle = getComputedStyle(wrapper);
      const firstCellStyle = getComputedStyle(firstCell);
      const actionCellStyle = getComputedStyle(actionCell);
      const actionTriggerRect = actionTrigger.getBoundingClientRect();
      return {
        toolbarPaddingLeft: getComputedStyle(toolbar).paddingLeft,
        toolbarPaddingRight: getComputedStyle(toolbar).paddingRight,
        searchStartInset: searchRect.left - toolbarRect.left,
        railEndInset: toolbarRect.right - railRect.right,
        wrapperBackgroundColor: wrapperStyle.backgroundColor,
        wrapperBorderWidths: [
          wrapperStyle.borderTopWidth,
          wrapperStyle.borderRightWidth,
          wrapperStyle.borderBottomWidth,
          wrapperStyle.borderLeftWidth,
        ],
        wrapperBorderRadius: wrapperStyle.borderRadius,
        wrapperBoxShadow: wrapperStyle.boxShadow,
        wrapperTransform: wrapperStyle.transform,
        wrapperOverflowX: wrapperStyle.overflowX,
        tableBackgroundColor: getComputedStyle(table).backgroundColor,
        headerHeight: headerRow.getBoundingClientRect().height,
        headerCellCount: table.querySelectorAll("thead th").length,
        rowHeights: Array.from(
          table.querySelectorAll("tbody tr"),
          (row) => row.getBoundingClientRect().height,
        ),
        firstCellPaddingLeft: firstCellStyle.paddingLeft,
        firstCellPaddingRight: firstCellStyle.paddingRight,
        actionCellPaddingLeft: actionCellStyle.paddingLeft,
        actionCellPaddingRight: actionCellStyle.paddingRight,
        actionTriggerWidth: actionTriggerRect.width,
        actionTriggerHeight: actionTriggerRect.height,
        headerDivider: getComputedStyle(headerCell).borderBottomColor,
        bodyDivider: getComputedStyle(secondRow).borderTopColor,
      };
    });
    assert.deepEqual(
      {
        toolbarPaddingLeft: courseLessonsVisual.toolbarPaddingLeft,
        toolbarPaddingRight: courseLessonsVisual.toolbarPaddingRight,
        searchStartInset: courseLessonsVisual.searchStartInset,
        railEndInset: courseLessonsVisual.railEndInset,
      },
      {
        toolbarPaddingLeft: "0px",
        toolbarPaddingRight: "0px",
        searchStartInset: 0,
        railEndInset: 0,
      },
    );
    assert.equal(
      courseLessonsVisual.wrapperBackgroundColor,
      "rgb(255, 255, 255)",
    );
    assert.deepEqual(courseLessonsVisual.wrapperBorderWidths, [
      "1px",
      "1px",
      "1px",
      "1px",
    ]);
    assert.equal(courseLessonsVisual.wrapperBorderRadius, "12px");
    assert.equal(
      courseLessonsVisual.wrapperBoxShadow,
      E2E_RAISED_SURFACE_SHADOW,
    );
    assert.equal(courseLessonsVisual.wrapperTransform, "none");
    assert.equal(courseLessonsVisual.wrapperOverflowX, "auto");
    assert.equal(
      courseLessonsVisual.tableBackgroundColor,
      "rgb(255, 255, 255)",
    );
    assert.ok(Math.abs(courseLessonsVisual.headerHeight - 40) < 0.5);
    assert.equal(courseLessonsVisual.headerCellCount, 7);
    assert.ok(
      courseLessonsVisual.rowHeights.every(
        (height) => Math.abs(height - 40) < 0.5,
      ),
    );
    assert.equal(courseLessonsVisual.firstCellPaddingLeft, "12px");
    assert.equal(courseLessonsVisual.firstCellPaddingRight, "12px");
    assert.equal(courseLessonsVisual.actionCellPaddingLeft, "4px");
    assert.equal(courseLessonsVisual.actionCellPaddingRight, "4px");
    assert.ok(Math.abs(courseLessonsVisual.actionTriggerWidth - 32) < 0.5);
    assert.ok(Math.abs(courseLessonsVisual.actionTriggerHeight - 32) < 0.5);
    assert.equal(
      courseLessonsVisual.headerDivider,
      courseLessonsVisual.bodyDivider,
    );

    const lessonPositionHeader = runtime.page.getByRole("columnheader", {
      name: "№",
      exact: true,
    });
    const lessonTitleHeader = runtime.page.getByRole("columnheader", {
      name: "Урок",
      exact: true,
    });
    assert.equal(
      await lessonPositionHeader.getAttribute("aria-sort"),
      "ascending",
    );
    assert.equal(await lessonTitleHeader.getAttribute("aria-sort"), "none");
    assert.deepEqual(
      await runtime.page
        .locator('[aria-label="Таблица уроков курса"] tbody tr td:first-child')
        .allTextContents(),
      ["2", "4"],
    );
    await lessonTitleHeader
      .getByRole("button", { name: "Урок", exact: true })
      .click();
    assert.equal(
      await lessonTitleHeader.getAttribute("aria-sort"),
      "ascending",
    );
    assert.deepEqual(
      await runtime.page
        .locator('[aria-label="Таблица уроков курса"] tbody tr td:nth-child(2)')
        .allTextContents(),
      [E2E_LESSON_TITLE, E2E_SECOND_LESSON_ROW.title],
    );
    await lessonTitleHeader
      .getByRole("button", { name: "Урок", exact: true })
      .click();
    assert.equal(
      await lessonTitleHeader.getAttribute("aria-sort"),
      "descending",
    );
    assert.deepEqual(
      await runtime.page
        .locator('[aria-label="Таблица уроков курса"] tbody tr td:nth-child(2)')
        .allTextContents(),
      [E2E_SECOND_LESSON_ROW.title, E2E_LESSON_TITLE],
    );

    const lessonSearch = runtime.page.getByRole("searchbox", {
      name: "Поиск уроков",
      exact: true,
    });
    await lessonSearch.fill("airport");
    assert.deepEqual(
      await runtime.page
        .locator('[aria-label="Таблица уроков курса"] tbody tr td:nth-child(2)')
        .allTextContents(),
      [E2E_SECOND_LESSON_ROW.title],
    );
    await lessonSearch.fill("");

    const lessonRow = runtime.page.locator(
      `[aria-label="Таблица уроков курса"] tbody tr:has-text("${E2E_LESSON_TITLE}")`,
    );
    const lessonActionTrigger = lessonRow.getByRole("button", {
      name: `Действия с уроком «${E2E_LESSON_TITLE}»`,
      exact: true,
    });
    assert.equal(
      await lessonActionTrigger.locator(".lucide-ellipsis-vertical").count(),
      1,
    );
    await lessonActionTrigger.click();
    const lessonActionMenu = runtime.page.locator(
      "body > .action-menu-panel-portal",
    );
    await lessonActionMenu
      .getByRole("menuitem", { name: "Открыть урок", exact: true })
      .waitFor();
    assert.equal(await lessonActionMenu.getByRole("menuitem").count(), 2);
    const lessonActionMenuSurface = await lessonActionMenu.evaluate((menu) => {
      const style = getComputedStyle(menu);
      return {
        borderWidths: [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ],
        borderRadius: style.borderRadius,
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        separatorCount: menu.querySelectorAll(
          '[role="separator"], .action-menu-separator',
        ).length,
      };
    });
    assert.deepEqual(lessonActionMenuSurface, courseActionMenuSurface);
    await lessonActionMenu
      .getByRole("menuitem", { name: "Открыть урок", exact: true })
      .press("Escape");
    await lessonActionMenu.waitFor({ state: "detached" });
    await lessonRow
      .locator(".course-lessons-table-action-menu .action-menu-trigger:focus")
      .waitFor();
    assert.equal(
      await lessonActionTrigger.evaluate(
        (node) => node === document.activeElement,
      ),
      true,
    );

    let html = await runtime.page.content();
    assert.match(html, /aria-label="Разделы курса"/);
    assert.match(html, /Уроки/);
    assert.match(html, /О курсе/);
    assert.match(html, /Материалы/);
    assert.match(html, /История/);

    await runtime.page
      .getByRole("tab", { name: "О курсе", exact: true })
      .click();
    await runtime.page
      .getByRole("heading", { name: "Настройки курса", exact: true, level: 2 })
      .waitFor();
    await runtime.page
      .getByRole("heading", {
        name: "Ученики и группы курса",
        exact: true,
        level: 2,
      })
      .waitFor();
    await runtime.page
      .getByRole("heading", { name: "Источники", exact: true, level: 2 })
      .waitFor();
    const aboutLayout = await runtime.page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(".course-about-panel");
      if (!panel) throw new Error("Course About panel is missing");
      const style = getComputedStyle(panel);
      return {
        maxHeight: style.maxHeight,
        overflowY: style.overflowY,
      };
    });
    assert.equal(aboutLayout.maxHeight, "none");
    assert.equal(aboutLayout.overflowY, "visible");
    assert.equal(
      await runtime.page
        .getByRole("heading", { name: "Материалы", exact: true, level: 2 })
        .count(),
      0,
    );
    await runtime.page.getByRole("tab", { name: /^Материалы/ }).click();
    await runtime.page
      .getByRole("heading", { name: "Материалы", exact: true, level: 2 })
      .waitFor();
    const lessonLink = runtime.page.getByRole("link", {
      name: `4. ${E2E_LESSON_TITLE}`,
      exact: true,
    });
    await forwardPageTransition.waitFor({ state: "detached" });
    await Promise.all([forwardPageTransition.waitFor(), lessonLink.click()]);

    const lessonHeading = runtime.page.getByRole("heading", {
      name: `Урок 4. ${E2E_LESSON_TITLE}`,
      exact: true,
      level: 1,
    });
    await lessonHeading.waitFor();
    await forwardPageTransition.waitFor({ state: "detached" });
    await runtime.page
      .locator('.workspace-tabs-indicator[data-motion-ready="true"]')
      .waitFor();
    await runtime.page.evaluate(async () => {
      const indicator = document.querySelector<HTMLElement>(
        ".workspace-tabs-indicator",
      );
      await Promise.all(
        (indicator?.getAnimations() ?? []).map((animation) =>
          animation.finished.catch(() => undefined),
        ),
      );
    });
    const lessonVisual = await runtime.page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".course-demo-shell");
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
      const titleRow = pageHeading?.querySelector<HTMLElement>(
        ".app-page-title-row",
      );
      const title = pageHeader?.querySelector<HTMLElement>(".app-page-title");
      const description = pageHeader?.querySelector<HTMLElement>(
        ".app-page-description",
      );
      const headerActions =
        pageHeader?.querySelector<HTMLElement>(".app-page-actions");
      const tab = document.querySelector<HTMLElement>(".workspace-tab-active");
      const inactiveTab = document.querySelector<HTMLElement>(
        ".workspace-tab:not(.workspace-tab-active)",
      );
      const tabs = document.querySelector<HTMLElement>(".workspace-tabs");
      const indicator = tabs?.querySelector<HTMLElement>(
        ".workspace-tabs-indicator",
      );
      const primaryAction = headerActions?.querySelector<HTMLButtonElement>(
        ".product-btn-primary",
      );
      const overflowAction = headerActions?.querySelector<HTMLButtonElement>(
        ".app-page-overflow-menu .action-menu-trigger",
      );
      const overflowIcon = overflowAction?.querySelector<SVGElement>("svg");

      if (
        !shell ||
        !pageHeader ||
        !pageHeading ||
        !titleRow ||
        !title ||
        !description ||
        !headerActions ||
        !tab ||
        !inactiveTab ||
        !tabs ||
        !indicator ||
        !primaryAction ||
        !overflowAction ||
        !overflowIcon
      ) {
        throw new Error("Lesson visual contract elements are missing");
      }

      const pageHeaderStyle = getComputedStyle(pageHeader);
      const pageHeadingStyle = getComputedStyle(pageHeading);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const tabsStyle = getComputedStyle(tabs);
      const tabStyle = getComputedStyle(tab);
      const inactiveTabStyle = getComputedStyle(inactiveTab);
      const markerStyle = getComputedStyle(tab, "::after");
      const indicatorStyle = getComputedStyle(indicator);
      const baselineStyle = getComputedStyle(tabs, "::before");
      const baselineScaleY = new DOMMatrixReadOnly(baselineStyle.transform).m22;
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const titleRowRect = titleRow.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();
      const primaryActionRect = primaryAction.getBoundingClientRect();
      const overflowActionRect = overflowAction.getBoundingClientRect();
      const primaryActionStyle = getComputedStyle(primaryAction);
      const overflowActionStyle = getComputedStyle(overflowAction);
      const overflowIconStyle = getComputedStyle(overflowIcon);
      return {
        shellBackgroundImage: getComputedStyle(shell).backgroundImage,
        headerLayout: {
          minHeight: pageHeaderStyle.minHeight,
          height: pageHeaderRect.height,
          actionsShareTitleRow:
            title.parentElement === titleRow &&
            headerActions.parentElement === titleRow &&
            headerActionsRect.top < titleRect.bottom &&
            headerActionsRect.bottom > titleRect.top,
          titleActionBottomDelta: Math.abs(
            headerActionsRect.bottom - titleRect.bottom,
          ),
          actionControlBottomDeltas: [
            Math.abs(primaryActionRect.bottom - titleRect.bottom),
            Math.abs(overflowActionRect.bottom - titleRect.bottom),
          ],
          metricBelowTitleRow: descriptionRect.top >= titleRowRect.bottom - 0.5,
          metricGapDelta: Math.abs(
            descriptionRect.top -
              titleRowRect.bottom -
              Number.parseFloat(pageHeadingStyle.rowGap),
          ),
        },
        headerSignature: {
          titleFontFamily: titleStyle.fontFamily,
          titleFontSize: titleStyle.fontSize,
          titleFontWeight: titleStyle.fontWeight,
          titleLineHeight: titleStyle.lineHeight,
          titleLetterSpacing: titleStyle.letterSpacing,
          descriptionFontSize: descriptionStyle.fontSize,
          descriptionLineHeight: descriptionStyle.lineHeight,
          descriptionColor: descriptionStyle.color,
        },
        metric: description.textContent?.trim() ?? "",
        actionButtonCount:
          headerActions.querySelectorAll<HTMLButtonElement>(".product-btn")
            .length,
        primaryAction: {
          label: primaryAction.textContent?.trim().replace(/\s+/g, " ") ?? "",
          height: primaryActionStyle.height,
          clientHeight: primaryAction.clientHeight,
          borderTopWidth: primaryActionStyle.borderTopWidth,
          backgroundClip: primaryActionStyle.backgroundClip,
          backgroundColor: primaryActionStyle.backgroundColor,
          boxShadow: primaryActionStyle.boxShadow,
        },
        overflowAction: {
          label: overflowAction.getAttribute("aria-label"),
          hasPopup: overflowAction.getAttribute("aria-haspopup"),
          height: overflowActionStyle.height,
          clientHeight: overflowAction.clientHeight,
          width: overflowActionStyle.width,
          borderTopWidth: overflowActionStyle.borderTopWidth,
          backgroundClip: overflowActionStyle.backgroundClip,
          backgroundColor: overflowActionStyle.backgroundColor,
          boxShadow: overflowActionStyle.boxShadow,
          iconClass: overflowIcon.getAttribute("class"),
          iconWidth: overflowIconStyle.width,
          iconHeight: overflowIconStyle.height,
        },
        tabSignature: {
          height: tabStyle.height,
          radius: tabStyle.borderRadius,
          fontWeight: tabStyle.fontWeight,
          activeColor: tabStyle.color,
          inactiveColor: inactiveTabStyle.color,
          gap: tabsStyle.columnGap,
          tabZIndex: tabStyle.zIndex,
          baselinePaintHeight: baselineStyle.height,
          baselineScaleY,
          baselineVisualHeight: Number(
            (
              Number.parseFloat(baselineStyle.height) * Math.abs(baselineScaleY)
            ).toFixed(3),
          ),
          baselineColor: baselineStyle.backgroundColor,
          baselineZIndex: baselineStyle.zIndex,
          baselinePointerEvents: baselineStyle.pointerEvents,
          baselineLeft: baselineStyle.left,
          baselineRight: baselineStyle.right,
          tabsPaddingLeft: tabsStyle.paddingLeft,
          tabsPaddingRight: tabsStyle.paddingRight,
          markerHeight: markerStyle.height,
          markerColor: markerStyle.backgroundColor,
          markerZIndex: markerStyle.zIndex,
          markerRadius: markerStyle.borderRadius,
          markerBottom: markerStyle.bottom,
          markerDisplay: markerStyle.display,
          indicatorHeight: indicatorStyle.height,
          indicatorColor: indicatorStyle.backgroundColor,
          indicatorZIndex: indicatorStyle.zIndex,
          indicatorRadius: indicatorStyle.borderRadius,
          indicatorBottom: indicatorStyle.bottom,
          indicatorReady: indicator.dataset.ready,
          indicatorTransitionProperty: indicatorStyle.transitionProperty,
          indicatorTransitionDuration: indicatorStyle.transitionDuration,
          allTabsHaveIcons: Array.from(
            tabs.querySelectorAll<HTMLElement>(".workspace-tab"),
          ).every((item) => Boolean(item.querySelector(".workspace-tab-icon"))),
        },
      };
    });

    assert.equal(lessonVisual.shellBackgroundImage, "none");
    assert.ok(["auto", "0px"].includes(lessonVisual.headerLayout.minHeight));
    assert.ok(lessonVisual.headerLayout.height > 0);
    assert.ok(lessonVisual.headerLayout.height < 200);
    assert.equal(lessonVisual.headerLayout.actionsShareTitleRow, true);
    assert.ok(lessonVisual.headerLayout.titleActionBottomDelta < 0.5);
    assert.equal(
      lessonVisual.headerLayout.actionControlBottomDeltas.every(
        (delta) => delta < 0.5,
      ),
      true,
    );
    assert.equal(lessonVisual.headerLayout.metricBelowTitleRow, true);
    assert.ok(lessonVisual.headerLayout.metricGapDelta < 0.5);
    assert.deepEqual(
      {
        titleFontFamily: lessonVisual.headerSignature.titleFontFamily,
        titleFontSize: lessonVisual.headerSignature.titleFontSize,
        titleFontWeight: lessonVisual.headerSignature.titleFontWeight,
        titleLineHeight: lessonVisual.headerSignature.titleLineHeight,
        titleLetterSpacing: lessonVisual.headerSignature.titleLetterSpacing,
      },
      coursesVisual.headerSignature,
    );
    assert.equal(
      lessonVisual.metric,
      "Компонентов: 1 · слайдов: 0 · проведений: 0",
    );
    assert.equal(lessonVisual.actionButtonCount, 2);
    assert.deepEqual(lessonVisual.primaryAction, {
      label: "Назначить",
      height: "40px",
      clientHeight: 38,
      borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      backgroundColor: "rgb(255, 255, 255)",
      boxShadow: E2E_RAISED_CONTROL_SHADOW,
    });
    assert.deepEqual(
      {
        ...lessonVisual.overflowAction,
        iconClass: undefined,
      },
      {
        label: `Другие действия с уроком «${E2E_LESSON_TITLE}»`,
        hasPopup: "menu",
        height: "40px",
        clientHeight: 38,
        width: "40px",
        borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
        backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
        backgroundColor: "rgb(255, 255, 255)",
        boxShadow: E2E_RAISED_CONTROL_SHADOW,
        iconClass: undefined,
        iconWidth: "16px",
        iconHeight: "16px",
      },
    );
    assert.match(
      lessonVisual.overflowAction.iconClass ?? "",
      /\blucide-ellipsis-vertical\b/,
    );

    const lessonOverflowTrigger = runtime.page.getByRole("button", {
      name: `Другие действия с уроком «${E2E_LESSON_TITLE}»`,
      exact: true,
    });
    await lessonOverflowTrigger.click();
    const lessonHeaderActionMenu = runtime.page.locator(
      "body > .action-menu-panel-portal",
    );
    await lessonHeaderActionMenu
      .getByRole("menuitem", { name: "Дополнить с ИИ", exact: true })
      .waitFor();
    assert.deepEqual(
      (
        await lessonHeaderActionMenu.getByRole("menuitem").allTextContents()
      ).map((label) => label.trim()),
      ["Дополнить с ИИ", "Настройки урока", "Удалить"],
    );
    assert.equal(
      await lessonHeaderActionMenu
        .getByRole("menuitem", { name: "Удалить", exact: true })
        .evaluate((item) => getComputedStyle(item).color),
      "rgb(190, 18, 60)",
    );

    await lessonHeaderActionMenu
      .getByRole("menuitem", { name: "Дополнить с ИИ", exact: true })
      .click();
    const aiLessonDialog = runtime.page.getByRole("dialog", {
      name: "Дополнить урок с помощью ИИ",
      exact: true,
    });
    await aiLessonDialog.waitFor();
    await aiLessonDialog
      .getByRole("button", { name: "Закрыть", exact: true })
      .click();
    await aiLessonDialog.waitFor({ state: "detached" });

    await lessonOverflowTrigger.click();
    await lessonHeaderActionMenu
      .getByRole("menuitem", { name: "Настройки урока", exact: true })
      .click();
    const lessonSettingsDialog = runtime.page.getByRole("dialog", {
      name: "Редактировать урок",
      exact: true,
    });
    await lessonSettingsDialog.waitFor();
    await lessonSettingsDialog
      .getByRole("button", { name: "Закрыть", exact: true })
      .click();
    await lessonSettingsDialog.waitFor({ state: "detached" });

    await runtime.page.evaluate(() => {
      const state = window as typeof window & {
        __e2eLessonDeleteConfirm?: string;
        __e2eOriginalConfirm?: typeof window.confirm;
      };
      state.__e2eOriginalConfirm = window.confirm;
      window.confirm = (message?: string) => {
        state.__e2eLessonDeleteConfirm = String(message ?? "");
        return false;
      };
    });
    await lessonOverflowTrigger.click();
    await lessonHeaderActionMenu
      .getByRole("menuitem", { name: "Удалить", exact: true })
      .click();
    const lessonDeleteConfirm = await runtime.page.evaluate(() => {
      const state = window as typeof window & {
        __e2eLessonDeleteConfirm?: string;
        __e2eOriginalConfirm?: typeof window.confirm;
      };
      const message = state.__e2eLessonDeleteConfirm ?? "";
      if (state.__e2eOriginalConfirm) {
        window.confirm = state.__e2eOriginalConfirm;
        delete state.__e2eOriginalConfirm;
      }
      delete state.__e2eLessonDeleteConfirm;
      return message;
    });
    assert.match(
      lessonDeleteConfirm,
      new RegExp(`Удалить урок «${E2E_LESSON_TITLE}»\\?`),
    );
    assert.match(
      lessonDeleteConfirm,
      /Завершённые индивидуальные результаты сохранятся/,
    );
    await lessonHeading.waitFor();
    assert.deepEqual(lessonVisual.tabSignature, courseVisual.tabSignature);

    await runtime.page.setViewportSize({ width: 1120, height: 900 });
    const narrowLessonHeader = await runtime.page.evaluate(() => {
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
      const titleRow = pageHeading?.querySelector<HTMLElement>(
        ".app-page-title-row",
      );
      const pageHeaderContent = pageHeader?.querySelector<HTMLElement>(
        ".app-page-header-content",
      );
      const title = pageHeading?.querySelector<HTMLElement>(".app-page-title");
      const description = pageHeading?.querySelector<HTMLElement>(
        ".app-page-description",
      );
      const backLabel = pageHeader?.querySelector<HTMLElement>(
        ".app-page-back-link-label",
      );
      const backLink = pageHeader?.querySelector<HTMLElement>(
        ".app-page-back-link",
      );
      const backIcon = backLink?.querySelector<HTMLElement>(
        ".app-page-back-link-icon",
      );
      const actions =
        pageHeader?.querySelector<HTMLElement>(".app-page-actions");
      if (
        !pageHeader ||
        !pageHeading ||
        !titleRow ||
        !pageHeaderContent ||
        !title ||
        !description ||
        !backLabel ||
        !backLink ||
        !backIcon ||
        !actions
      ) {
        throw new Error("Narrow Lesson header contract is missing");
      }

      const originalTitle = title.textContent;
      const originalDescription = description.textContent;
      const originalBackLabel = backLabel.textContent;
      title.textContent = `Урок ${"БезПробелов".repeat(30)}`;
      description.textContent = "ОписаниеБезПробелов".repeat(35);
      backLabel.textContent = "КурсБезПробелов".repeat(25);

      const headerStyle = getComputedStyle(pageHeader);
      const headingStyle = getComputedStyle(pageHeading);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const backLabelStyle = getComputedStyle(backLabel);
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const pageHeadingRect = pageHeading.getBoundingClientRect();
      const titleRowRect = titleRow.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      const backLinkRect = backLink.getBoundingClientRect();
      const backLabelRect = backLabel.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      const contentWidth =
        pageHeaderRect.width -
        Number.parseFloat(headerStyle.paddingLeft) -
        Number.parseFloat(headerStyle.paddingRight);
      const contract = {
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        headerDisplay: headerStyle.display,
        headerDirection: headerStyle.flexDirection,
        headerWrap: headerStyle.flexWrap,
        headingOwnsContentDelta: Math.abs(pageHeadingRect.width - contentWidth),
        titleRowOwnsHeadingDelta: Math.abs(
          titleRowRect.width - pageHeadingRect.width,
        ),
        actionsInsideHeader:
          actionsRect.left >=
            pageHeaderRect.left +
              Number.parseFloat(headerStyle.paddingLeft) -
              0.5 &&
          actionsRect.right <=
            pageHeaderRect.right -
              Number.parseFloat(headerStyle.paddingRight) +
              0.5,
        actionsShareTitleRow:
          title.parentElement === titleRow &&
          actions.parentElement === titleRow &&
          actionsRect.top < titleRect.bottom &&
          actionsRect.bottom > titleRect.top,
        titleActionBottomDelta: Math.abs(actionsRect.bottom - titleRect.bottom),
        metricBelowTitleRow: descriptionRect.top >= titleRowRect.bottom - 0.5,
        metricGapDelta: Math.abs(
          descriptionRect.top -
            titleRowRect.bottom -
            Number.parseFloat(headingStyle.rowGap),
        ),
        titleWrap: titleStyle.overflowWrap,
        descriptionWrap: descriptionStyle.overflowWrap,
        backLabelWrap: backLabelStyle.overflowWrap,
        backLabelOverflow: backLabelStyle.overflow,
        backLabelTextOverflow: backLabelStyle.textOverflow,
        backLabelWhiteSpace: backLabelStyle.whiteSpace,
        backLabelIsClipped: backLabel.scrollWidth > backLabel.clientWidth,
        backLabelSingleLineDelta: Math.abs(
          backLabelRect.height - Number.parseFloat(backLabelStyle.lineHeight),
        ),
        backColor: getComputedStyle(backLink).color,
        backIconColor: getComputedStyle(backIcon).color,
        backIconFlexShrink: getComputedStyle(backIcon).flexShrink,
        headerToBackGap: backLinkRect.top - pageHeaderRect.top,
        backToHeadingGap: pageHeadingRect.top - backLinkRect.bottom,
      };

      title.textContent = originalTitle;
      description.textContent = originalDescription;
      backLabel.textContent = originalBackLabel;
      return contract;
    });
    assert.deepEqual(
      {
        documentClientWidth: narrowLessonHeader.documentClientWidth,
        documentScrollWidth: narrowLessonHeader.documentScrollWidth,
        headerDisplay: narrowLessonHeader.headerDisplay,
        headerDirection: narrowLessonHeader.headerDirection,
        headerWrap: narrowLessonHeader.headerWrap,
        actionsInsideHeader: narrowLessonHeader.actionsInsideHeader,
        actionsShareTitleRow: narrowLessonHeader.actionsShareTitleRow,
        metricBelowTitleRow: narrowLessonHeader.metricBelowTitleRow,
        titleWrap: narrowLessonHeader.titleWrap,
        descriptionWrap: narrowLessonHeader.descriptionWrap,
        backLabelWrap: narrowLessonHeader.backLabelWrap,
        backLabelOverflow: narrowLessonHeader.backLabelOverflow,
        backLabelTextOverflow: narrowLessonHeader.backLabelTextOverflow,
        backLabelWhiteSpace: narrowLessonHeader.backLabelWhiteSpace,
        backLabelIsClipped: narrowLessonHeader.backLabelIsClipped,
        backColor: narrowLessonHeader.backColor,
        backIconColor: narrowLessonHeader.backIconColor,
        backIconFlexShrink: narrowLessonHeader.backIconFlexShrink,
      },
      {
        documentClientWidth: 1120,
        documentScrollWidth: 1120,
        headerDisplay: "flex",
        headerDirection: "column",
        headerWrap: "nowrap",
        actionsInsideHeader: true,
        actionsShareTitleRow: true,
        metricBelowTitleRow: true,
        titleWrap: "anywhere",
        descriptionWrap: "anywhere",
        backLabelWrap: "normal",
        backLabelOverflow: "hidden",
        backLabelTextOverflow: "ellipsis",
        backLabelWhiteSpace: "nowrap",
        backLabelIsClipped: true,
        backColor: "rgb(20, 20, 20)",
        backIconColor: "rgb(20, 20, 20)",
        backIconFlexShrink: "0",
      },
    );
    assert.ok(narrowLessonHeader.headingOwnsContentDelta < 0.5);
    assert.ok(narrowLessonHeader.titleRowOwnsHeadingDelta < 0.5);
    assert.ok(narrowLessonHeader.titleActionBottomDelta < 0.5);
    assert.ok(narrowLessonHeader.metricGapDelta < 0.5);
    assert.ok(narrowLessonHeader.backLabelSingleLineDelta < 0.5);
    assert.ok(Math.abs(narrowLessonHeader.headerToBackGap - 20) < 0.5);
    assert.ok(Math.abs(narrowLessonHeader.backToHeadingGap - 20) < 0.5);
    assert.ok(
      Math.abs(
        narrowLessonHeader.headerToBackGap -
          narrowLessonHeader.backToHeadingGap,
      ) < 0.5,
    );
    await runtime.page.setViewportSize({ width: 1280, height: 720 });

    html = await runtime.page.content();
    assert.match(html, /aria-label="Разделы урока"/);
    assert.match(html, /План/);
    assert.match(html, /Экран ученика/);
    assert.match(html, /Домашнее задание/);

    let componentCreateRequestCount = 0;
    await runtime.page.route(
      `**/api/v2/lessons/${E2E_LESSON_ID}/components`,
      async (route) => {
        componentCreateRequestCount += 1;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unexpected component persistence" }),
        });
      },
    );

    await runtime.page
      .getByRole("button", { name: "Компонент", exact: true })
      .click();
    const componentDialog = runtime.page.getByRole("dialog", {
      name: "Компоненты",
      exact: true,
    });
    await componentDialog.waitFor();
    const componentCategories = componentDialog.getByRole("group", {
      name: "Категории компонентов",
      exact: true,
    });
    const expectedComponentKeysByCategory = {
      Текст: ["rich_text", "callout", "quote"],
      Медиа: ["image", "video", "audio", "slideshow"],
      "Игры и активности": [
        "single_choice_poll",
        "matching_game",
        "choice_quiz",
        "fill_blanks",
        "word_bank",
        "sequence",
        "categorize",
        "free_response",
        "word_builder",
        "vocabulary_list",
      ],
      Ссылки: ["external_link"],
      Файлы: ["file"],
    } as const;
    const componentDialogLayouts: Array<{
      category: string;
      width: number;
      height: number;
      top: number;
      panelOverflowY: string;
      listOverflowY: string;
      categoriesBorderBottomWidth: string;
      categoryButtonCursors: string[];
      enabledCardCursors: string[];
      cardContentSizing: Array<{
        height: number;
        contentBottomInset: number;
        paddingBottom: number;
        borderBottomWidth: number;
      }>;
      lastCardBottomGap: number;
      closeBorderTopWidth: string;
      closeBackgroundColor: string;
    }> = [];

    for (const [category, expectedKeys] of Object.entries(
      expectedComponentKeysByCategory,
    )) {
      await componentCategories
        .getByRole("button", { name: category, exact: true })
        .click();
      const renderedKeys = await runtime.page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"] [data-component-type-key]',
          ),
          (node) => node.dataset.componentTypeKey ?? null,
        ),
      );
      assert.deepEqual(renderedKeys, expectedKeys);
      const renderedPreviewKeys = await runtime.page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"] [data-component-preview]',
          ),
          (node) => node.dataset.componentPreview ?? null,
        ),
      );
      assert.deepEqual(renderedPreviewKeys, expectedKeys);
      assert.equal(
        await componentDialog
          .getByRole("heading", { name: category, exact: true })
          .count(),
        0,
      );
      componentDialogLayouts.push(
        await runtime.page.evaluate(() => {
          const panel = document.querySelector<HTMLElement>(
            ".component-picker-dialog-panel",
          );
          if (!panel) throw new Error("Component dialog panel is missing");
          const list = panel.querySelector<HTMLElement>(
            ".component-picker-dialog-list",
          );
          const categories = panel.querySelector<HTMLElement>(
            ".component-picker-categories",
          );
          const close = panel.querySelector<HTMLElement>(
            '.dialog-shell-close[aria-label="Закрыть"]',
          );
          if (!list || !categories || !close) {
            throw new Error("Component dialog layout contract is missing");
          }
          const selectedCategory = panel
            .querySelector<HTMLElement>('[aria-pressed="true"]')
            ?.textContent?.trim();
          if (!selectedCategory) {
            throw new Error("Selected component category is missing");
          }
          const rect = panel.getBoundingClientRect();
          const panelStyle = getComputedStyle(panel);
          const listStyle = getComputedStyle(list);
          const categoriesStyle = getComputedStyle(categories);
          const closeStyle = getComputedStyle(close);
          const cards = Array.from(
            list.querySelectorAll<HTMLButtonElement>(
              ".component-picker-card:not(:disabled)",
            ),
          );
          const cardRects = cards.map((card) => card.getBoundingClientRect());
          return {
            category: selectedCategory,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            panelOverflowY: panelStyle.overflowY,
            listOverflowY: listStyle.overflowY,
            categoriesBorderBottomWidth: categoriesStyle.borderBottomWidth,
            categoryButtonCursors: Array.from(
              categories.querySelectorAll<HTMLElement>(
                ".component-picker-category",
              ),
              (button) => getComputedStyle(button).cursor,
            ),
            enabledCardCursors: cards.map(
              (card) => getComputedStyle(card).cursor,
            ),
            cardContentSizing: cards.map((card, index) => {
              const preview = card.querySelector<HTMLElement>(
                "[data-component-preview]",
              );
              if (!preview) {
                throw new Error("Component picker card preview is missing");
              }
              const cardStyle = getComputedStyle(card);
              return {
                height: cardRects[index].height,
                contentBottomInset:
                  cardRects[index].bottom -
                  preview.getBoundingClientRect().bottom,
                paddingBottom: Number.parseFloat(cardStyle.paddingBottom),
                borderBottomWidth: Number.parseFloat(
                  cardStyle.borderBottomWidth,
                ),
              };
            }),
            lastCardBottomGap:
              list.getBoundingClientRect().bottom -
              Math.max(...cardRects.map((cardRect) => cardRect.bottom)),
            closeBorderTopWidth: closeStyle.borderTopWidth,
            closeBackgroundColor: closeStyle.backgroundColor,
          };
        }),
      );
    }
    const componentDialogBaseline = componentDialogLayouts[0];
    for (const layout of componentDialogLayouts) {
      assert.ok(Math.abs(layout.width - componentDialogBaseline.width) < 0.5);
      assert.ok(Math.abs(layout.height - componentDialogBaseline.height) < 0.5);
      assert.ok(Math.abs(layout.top - componentDialogBaseline.top) < 0.5);
      assert.equal(layout.panelOverflowY, "hidden");
      assert.equal(layout.listOverflowY, "auto");
      assert.equal(layout.categoriesBorderBottomWidth, "0px");
      assert.ok(
        layout.categoryButtonCursors.every((cursor) => cursor === "pointer"),
      );
      assert.ok(
        layout.enabledCardCursors.every((cursor) => cursor === "pointer"),
      );
      assert.equal(layout.closeBorderTopWidth, "0px");
      assert.equal(layout.closeBackgroundColor, "rgba(0, 0, 0, 0)");
    }
    const textCategoryLayout = componentDialogLayouts.find(
      ({ category }) => category === "Текст",
    );
    assert.ok(textCategoryLayout, "Text component category layout is missing");
    assert.ok(textCategoryLayout.cardContentSizing.length > 0);
    assert.ok(
      textCategoryLayout.cardContentSizing.every(
        ({ height, contentBottomInset, paddingBottom, borderBottomWidth }) =>
          height > 0 &&
          Math.abs(contentBottomInset - paddingBottom - borderBottomWidth) <
            0.5,
      ),
    );
    assert.ok(textCategoryLayout.lastCardBottomGap > 0.5);
    await componentCategories
      .getByRole("button", { name: "Текст", exact: true })
      .click();
    const textPreviewContract = await runtime.page.evaluate(() => {
      const preview = (typeKey: string) => {
        const node = document.querySelector<HTMLElement>(
          `[role="dialog"] [data-component-preview="${typeKey}"]`,
        );
        if (!node) throw new Error(`Missing ${typeKey} component preview`);
        return node;
      };
      const richText = preview("rich_text");
      const callout = preview("callout");
      const quote = preview("quote");
      const richTextTitle = Array.from(
        richText.querySelectorAll<HTMLElement>("span"),
      ).find(
        (node) =>
          node.children.length === 0 &&
          node.textContent?.trim() === "Новая тема",
      );
      const calloutSample = callout.firstElementChild as HTMLElement | null;
      const quoteSample = quote.firstElementChild as HTMLElement | null;
      const quoteText = quoteSample?.firstElementChild as HTMLElement | null;
      if (!richTextTitle || !calloutSample || !quoteSample || !quoteText) {
        throw new Error("Text component preview structure is incomplete");
      }
      const richTextTitleStyle = getComputedStyle(richTextTitle);
      const calloutStyle = getComputedStyle(calloutSample);
      const quoteStyle = getComputedStyle(quoteSample);
      return {
        legacyHeadingCount: document.querySelectorAll(
          '[role="dialog"] [data-component-type-key="heading"]',
        ).length,
        richTextTitle: richTextTitle.textContent?.trim(),
        richTextTitleFontSize: richTextTitleStyle.fontSize,
        richTextTitleFontWeight: richTextTitleStyle.fontWeight,
        richTextVisibleLineCount: richText.querySelectorAll(
          "span[class*='rounded-full']",
        ).length,
        calloutBackgroundColor: calloutStyle.backgroundColor,
        calloutBorderTopWidth: calloutStyle.borderTopWidth,
        quoteLines: Array.from(
          quoteSample.querySelectorAll<HTMLElement>(":scope > span"),
          (line) => line.textContent?.trim(),
        ),
        quoteBorderLeftWidth: quoteStyle.borderLeftWidth,
        quoteTextFontStyle: getComputedStyle(quoteText).fontStyle,
      };
    });
    assert.equal(textPreviewContract.legacyHeadingCount, 0);
    assert.equal(textPreviewContract.richTextTitle, "Новая тема");
    assert.equal(textPreviewContract.richTextTitleFontSize, "11.52px");
    assert.equal(textPreviewContract.richTextTitleFontWeight, "600");
    assert.ok(textPreviewContract.richTextVisibleLineCount >= 4);
    assert.notEqual(
      textPreviewContract.calloutBackgroundColor,
      "rgba(0, 0, 0, 0)",
    );
    assert.equal(textPreviewContract.calloutBorderTopWidth, "1px");
    assert.deepEqual(textPreviewContract.quoteLines, [
      "«Важная мысль урока»",
      "— Автор",
    ]);
    assert.equal(textPreviewContract.quoteBorderLeftWidth, "2px");
    assert.equal(textPreviewContract.quoteTextFontStyle, "italic");
    await componentDialog
      .locator('[data-component-type-key="rich_text"]')
      .click();
    const draftTextDialog = runtime.page.getByRole("dialog", {
      name: "Новый компонент · Текст",
      exact: true,
    });
    await draftTextDialog.waitFor();
    await draftTextDialog.locator(".component-payload-editor").waitFor();
    const draftRichTextFields = draftTextDialog.locator(
      ".component-payload-editor > .grid:first-child",
    );
    assert.deepEqual(
      await draftRichTextFields.locator(".field-label").allTextContents(),
      ["Заголовок", "Текст"],
    );
    assert.equal(await draftRichTextFields.locator("input").count(), 1);
    assert.equal(await draftRichTextFields.locator("textarea").count(), 1);
    await runtime.page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => resolve()),
          ),
        ),
    );
    assert.equal(componentCreateRequestCount, 0);
    assert.equal(
      await runtime.page.locator(".lesson-component-card").count(),
      1,
    );
    await draftTextDialog
      .getByRole("button", { name: "Назад к компонентам", exact: true })
      .click();
    await draftTextDialog.waitFor({ state: "detached" });
    await componentDialog.waitFor();
    assert.equal(componentCreateRequestCount, 0);
    for (const redundantText of [
      "Выберите элемент плана. Новый компонент сначала виден только преподавателю.",
      "Заголовки, основной текст, сноски и цитаты",
      "Изображения, слайдшоу, видео и аудио",
      "Опросы и интерактивные задания",
      "Внешние ссылки и материалы для скачивания",
    ]) {
      assert.equal(
        await componentDialog.getByText(redundantText, { exact: true }).count(),
        0,
      );
    }
    assert.equal(
      await componentDialog.getByText("Разделитель", { exact: true }).count(),
      0,
    );
    await componentCategories
      .getByRole("button", { name: "Игры и активности", exact: true })
      .click();
    await runtime.page.setViewportSize({ width: 390, height: 500 });
    const compactComponentDialog = await runtime.page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(
        ".component-picker-dialog-panel",
      );
      if (!panel) throw new Error("Component dialog panel is missing");
      const list = panel.querySelector<HTMLElement>(
        ".component-picker-dialog-list",
      );
      if (!list) throw new Error("Component dialog list is missing");
      const rect = panel.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,
        listClientHeight: list.clientHeight,
        listScrollHeight: list.scrollHeight,
      };
    });
    assert.ok(
      compactComponentDialog.width <= compactComponentDialog.viewportWidth - 32,
    );
    assert.ok(
      compactComponentDialog.height <=
        compactComponentDialog.viewportHeight - 32,
    );
    assert.ok(
      compactComponentDialog.listScrollHeight >
        compactComponentDialog.listClientHeight,
    );
    await runtime.page.setViewportSize({ width: 1280, height: 720 });
    await componentDialog
      .getByRole("button", { name: "Закрыть", exact: true })
      .click();

    const fileComponentCard = runtime.page.locator(
      '.lesson-component-card[data-component-type-key="file"]',
    );
    assert.equal(await fileComponentCard.count(), 1);
    assert.equal(
      await fileComponentCard.locator(".lesson-component-card-header").count(),
      0,
    );
    assert.equal(
      await fileComponentCard.locator(".lesson-component-card-title").count(),
      0,
    );
    assert.equal(
      await fileComponentCard.locator(".component-payload-editor").count(),
      0,
    );
    const fileComponentActions = fileComponentCard.locator(
      ".lesson-component-card-actions",
    );
    async function readComponentActionVisual(actionLocator: PlaywrightLocator) {
      return actionLocator.evaluate((element) => {
        const action = element as HTMLElement;
        const style = getComputedStyle(action);
        const rect = action.getBoundingClientRect();
        let effectiveOpacity = 1;
        let rendered = true;
        let current: HTMLElement | null = action;
        while (current) {
          const currentStyle = getComputedStyle(current);
          effectiveOpacity *= Number(currentStyle.opacity);
          rendered &&=
            currentStyle.display !== "none" &&
            currentStyle.visibility !== "hidden";
          current = current.parentElement;
        }
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return {
          effectiveOpacity,
          rendered,
          hitTested: hit === action || (hit !== null && action.contains(hit)),
          background: style.backgroundColor,
          color: style.color,
          pointerEvents: style.pointerEvents,
        };
      });
    }
    const fileComponentEdit = fileComponentCard.getByRole("button", {
      name: "Редактировать «Файл»",
      exact: true,
    });
    assert.equal(
      await fileComponentEdit.getAttribute("aria-haspopup"),
      "dialog",
    );
    const fileComponentCardVisual = await fileComponentCard.evaluate((card) => {
      const label = card.querySelector<HTMLElement>(
        ".lesson-component-card-label",
      );
      const actions = card.querySelector<HTMLElement>(
        ".lesson-component-card-actions",
      );
      const content = card.querySelector<HTMLElement>(
        ".lesson-component-card-content",
      );
      if (!label || !actions || !content) {
        throw new Error("Overlay component card contract is missing");
      }
      const cardStyle = getComputedStyle(card);
      const actionsStyle = getComputedStyle(actions);
      const contentStyle = getComputedStyle(content);
      const labelRect = label.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      const actionButtons = Array.from(
        actions.querySelectorAll<HTMLButtonElement>("button"),
        (button) => {
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          return {
            width: rect.width,
            height: rect.height,
            borderWidths: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ],
            boxShadow: style.boxShadow,
          };
        },
      );
      return {
        accessibleLabel: label.textContent?.trim(),
        accessibleLabelWidth: labelRect.width,
        accessibleLabelHeight: labelRect.height,
        cardPadding: cardStyle.padding,
        cardBorderWidths: [
          cardStyle.borderTopWidth,
          cardStyle.borderRightWidth,
          cardStyle.borderBottomWidth,
          cardStyle.borderLeftWidth,
        ],
        cardBackground: cardStyle.backgroundColor,
        cardBackgroundClip: cardStyle.backgroundClip,
        cardBorderColor: cardStyle.borderTopColor,
        cardBoxShadow: cardStyle.boxShadow,
        cardTransform: cardStyle.transform,
        cardTransitionProperty: cardStyle.transitionProperty,
        cardTransitionDuration: cardStyle.transitionDuration,
        cardRect: (() => {
          const rect = card.getBoundingClientRect();
          return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          };
        })(),
        cardOverflow: cardStyle.overflow,
        actionsPosition: actionsStyle.position,
        actionsTop: actionsStyle.top,
        actionsRight: actionsStyle.right,
        actionsHeight: actionsRect.height,
        actionsOpacity: actionsStyle.opacity,
        actionsPointerEvents: actionsStyle.pointerEvents,
        actionsBackground: actionsStyle.backgroundColor,
        actionsBorderWidths: [
          actionsStyle.borderTopWidth,
          actionsStyle.borderRightWidth,
          actionsStyle.borderBottomWidth,
          actionsStyle.borderLeftWidth,
        ],
        actionsBoxShadow: actionsStyle.boxShadow,
        actionButtons,
        contentPadding: contentStyle.padding,
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
      };
    });
    assert.equal(fileComponentCardVisual.accessibleLabel, "1. Файл");
    assert.ok(fileComponentCardVisual.accessibleLabelWidth <= 1);
    assert.ok(fileComponentCardVisual.accessibleLabelHeight <= 1);
    assert.equal(fileComponentCardVisual.cardPadding, "0px");
    assert.deepEqual(fileComponentCardVisual.cardBorderWidths, [
      "1px",
      "1px",
      "1px",
      "1px",
    ]);
    assert.equal(fileComponentCardVisual.cardBackground, "rgb(255, 255, 255)");
    assert.equal(
      fileComponentCardVisual.cardBackgroundClip,
      E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
    );
    assert.equal(
      fileComponentCardVisual.cardBorderColor,
      E2E_PRODUCT_SURFACE_BORDER_COLOR,
    );
    assert.equal(
      fileComponentCardVisual.cardBoxShadow,
      E2E_RAISED_SURFACE_SHADOW,
    );
    assert.equal(fileComponentCardVisual.cardTransform, "none");
    assert.equal(fileComponentCardVisual.cardTransitionProperty, "all");
    assert.equal(fileComponentCardVisual.cardTransitionDuration, "0s");
    assert.equal(fileComponentCardVisual.cardOverflow, "visible");
    assert.equal(fileComponentCardVisual.actionsPosition, "absolute");
    assert.equal(fileComponentCardVisual.actionsTop, "4px");
    assert.equal(fileComponentCardVisual.actionsRight, "4px");
    assert.ok(Math.abs(fileComponentCardVisual.actionsHeight - 40) < 0.5);
    assert.equal(fileComponentCardVisual.actionsOpacity, "0");
    assert.equal(fileComponentCardVisual.actionsPointerEvents, "none");
    assert.equal(
      fileComponentCardVisual.actionsBackground,
      "rgba(255, 255, 255, 0.5)",
    );
    assert.deepEqual(fileComponentCardVisual.actionsBorderWidths, [
      "0px",
      "0px",
      "0px",
      "0px",
    ]);
    assert.equal(fileComponentCardVisual.actionsBoxShadow, "none");
    assert.equal(fileComponentCardVisual.actionButtons.length, 5);
    assert.ok(
      fileComponentCardVisual.actionButtons.every(
        ({ width, height, borderWidths, boxShadow }) =>
          Math.abs(width - 32) < 0.5 &&
          Math.abs(height - 32) < 0.5 &&
          borderWidths.every((value) => value === "0px") &&
          boxShadow === "none",
      ),
    );
    assert.equal(fileComponentCardVisual.contentPadding, "12px");
    assert.equal(
      fileComponentCardVisual.documentScrollWidth,
      fileComponentCardVisual.documentClientWidth,
    );

    await fileComponentCard.hover();
    await runtime.page.evaluate(
      () => new Promise<void>((resolve) => window.setTimeout(resolve, 220)),
    );
    assert.deepEqual(
      await fileComponentActions.evaluate((actions) => {
        const style = getComputedStyle(actions);
        const card = actions.closest<HTMLElement>(".lesson-component-card");
        if (!card) throw new Error("Component card is missing");
        const cardRect = card.getBoundingClientRect();
        return {
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
          cardBoxShadow: getComputedStyle(card).boxShadow,
          cardTransform: getComputedStyle(card).transform,
          cardRect: {
            top: cardRect.top,
            left: cardRect.left,
            width: cardRect.width,
            height: cardRect.height,
          },
        };
      }),
      {
        opacity: "1",
        pointerEvents: "auto",
        cardBoxShadow: E2E_RAISED_SURFACE_SHADOW,
        cardTransform: "none",
        cardRect: fileComponentCardVisual.cardRect,
      },
    );
    const componentTrigger = runtime.page.getByRole("button", {
      name: "Компонент",
      exact: true,
    });
    await componentTrigger.hover();
    await runtime.page.evaluate(
      () => new Promise<void>((resolve) => window.setTimeout(resolve, 220)),
    );
    assert.deepEqual(
      await fileComponentActions.evaluate((actions) => {
        const card = actions.closest<HTMLElement>(".lesson-component-card");
        if (!card) throw new Error("Component card is missing");
        return {
          opacity: getComputedStyle(actions).opacity,
          cardBoxShadow: getComputedStyle(card).boxShadow,
          cardTransform: getComputedStyle(card).transform,
        };
      }),
      {
        opacity: "0",
        cardBoxShadow: E2E_RAISED_SURFACE_SHADOW,
        cardTransform: "none",
      },
    );
    await componentTrigger.press("Tab");
    await runtime.page.evaluate(
      () => new Promise<void>((resolve) => window.setTimeout(resolve, 220)),
    );
    assert.deepEqual(
      await fileComponentActions.evaluate((actions) => {
        const style = getComputedStyle(actions);
        return {
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
          cardBoxShadow: getComputedStyle(
            actions.closest<HTMLElement>(".lesson-component-card")!,
          ).boxShadow,
          cardTransform: getComputedStyle(
            actions.closest<HTMLElement>(".lesson-component-card")!,
          ).transform,
          editBorderWidths: (() => {
            const edit = actions.querySelector<HTMLElement>(
              '[aria-label="Редактировать «Файл»"]',
            );
            if (!edit) throw new Error("Edit action is missing");
            const editStyle = getComputedStyle(edit);
            return [
              editStyle.borderTopWidth,
              editStyle.borderRightWidth,
              editStyle.borderBottomWidth,
              editStyle.borderLeftWidth,
            ];
          })(),
          editBoxShadow: getComputedStyle(
            actions.querySelector<HTMLElement>(
              '[aria-label="Редактировать «Файл»"]',
            )!,
          ).boxShadow,
          editOutlineStyle: getComputedStyle(
            actions.querySelector<HTMLElement>(
              '[aria-label="Редактировать «Файл»"]',
            )!,
          ).outlineStyle,
          editOutlineWidth: getComputedStyle(
            actions.querySelector<HTMLElement>(
              '[aria-label="Редактировать «Файл»"]',
            )!,
          ).outlineWidth,
          editFocused:
            actions.querySelector('[aria-label="Редактировать «Файл»"]') ===
            document.activeElement,
        };
      }),
      {
        opacity: "1",
        pointerEvents: "auto",
        cardBoxShadow: E2E_RAISED_SURFACE_SHADOW,
        cardTransform: "none",
        editBorderWidths: ["0px", "0px", "0px", "0px"],
        editBoxShadow: "none",
        editOutlineStyle: "solid",
        editOutlineWidth: "2px",
        editFocused: true,
      },
    );

    await fileComponentEdit.click();
    const fileComponentDialog = runtime.page.getByRole("dialog", {
      name: "1. Файл",
      exact: true,
    });
    await fileComponentDialog.waitFor();
    assert.equal(
      await fileComponentDialog
        .getByText(
          "Редактирование компонента: настройте содержимое и отображение.",
          { exact: true },
        )
        .count(),
      1,
    );
    const fileComponentEditor = fileComponentDialog.locator(
      ".component-payload-editor",
    );
    await fileComponentEditor.waitFor();
    assert.equal(
      await fileComponentCard.locator(".component-payload-editor").count(),
      0,
    );
    assert.equal(
      await runtime.page.locator(".dialog-shell-overlay").count(),
      1,
    );
    const fileComponentDialogVisual = await fileComponentDialog.evaluate(
      (dialog) => {
        const editor = dialog.querySelector<HTMLElement>(
          ".component-payload-editor",
        );
        const controls = Array.from(
          dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
            "input.field-input:not([type='checkbox']), select.field-input:not([multiple])",
          ),
        );
        const entryInput = dialog.querySelector<HTMLInputElement>(
          "input.field-input:not([type='checkbox'])",
        );
        if (!editor || controls.length === 0 || !entryInput) {
          throw new Error("Modal component editor controls are missing");
        }
        const dialogRect = dialog.getBoundingClientRect();
        const editorStyle = getComputedStyle(editor);
        const entryInputStyle = getComputedStyle(entryInput);
        const entryInputPlaceholderStyle = getComputedStyle(
          entryInput,
          "::placeholder",
        );
        return {
          ariaModal: dialog.getAttribute("aria-modal"),
          dialogWidth: dialogRect.width,
          dialogInsideViewport:
            dialogRect.left >= 0 &&
            dialogRect.right <= document.documentElement.clientWidth &&
            dialogRect.top >= 0 &&
            dialogRect.bottom <= document.documentElement.clientHeight,
          editorBorderTopWidth: editorStyle.borderTopWidth,
          editorPaddingTop: editorStyle.paddingTop,
          editorFontSize: editorStyle.fontSize,
          editorFontWeight: editorStyle.fontWeight,
          firstControlFocused: editor.contains(document.activeElement),
          controls: controls.map((control) => {
            const style = getComputedStyle(control);
            return {
              height: control.getBoundingClientRect().height,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
            };
          }),
          entryInput: {
            height: entryInputStyle.height,
            clientHeight: entryInput.clientHeight,
            borderTopWidth: entryInputStyle.borderTopWidth,
            borderTopColor: entryInputStyle.borderTopColor,
            backgroundClip: entryInputStyle.backgroundClip,
            boxShadow: entryInputStyle.boxShadow,
            color: entryInputStyle.color,
            fontSize: entryInputStyle.fontSize,
            fontWeight: entryInputStyle.fontWeight,
            lineHeight: entryInputStyle.lineHeight,
            placeholderColor: entryInputPlaceholderStyle.color,
            placeholderOpacity: entryInputPlaceholderStyle.opacity,
          },
          bodyOverflow: document.body.style.overflow,
          documentClientWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
        };
      },
    );
    assert.equal(fileComponentDialogVisual.ariaModal, "true");
    assert.ok(fileComponentDialogVisual.dialogWidth <= 768);
    assert.equal(fileComponentDialogVisual.dialogInsideViewport, true);
    assert.equal(fileComponentDialogVisual.editorBorderTopWidth, "0px");
    assert.equal(fileComponentDialogVisual.editorPaddingTop, "0px");
    assert.equal(fileComponentDialogVisual.editorFontSize, "14.08px");
    assert.equal(fileComponentDialogVisual.editorFontWeight, "400");
    assert.equal(fileComponentDialogVisual.firstControlFocused, true);
    assert.ok(
      fileComponentDialogVisual.controls.every(
        ({ height, fontSize, fontWeight }) =>
          Math.abs(height - 40) < 0.5 &&
          fontSize === "14.08px" &&
          fontWeight === "400",
      ),
    );
    assert.deepEqual(fileComponentDialogVisual.entryInput, {
      height: "40px",
      clientHeight: 38,
      borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
      borderTopColor: E2E_PRODUCT_SURFACE_BORDER_COLOR,
      backgroundClip: E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
      boxShadow: E2E_ENTRY_CONTROL_SHADOW,
      color: "rgb(20, 20, 20)",
      fontSize: "14.08px",
      fontWeight: "400",
      lineHeight: "16.896px",
      placeholderColor: "rgb(20, 20, 20)",
      placeholderOpacity: "1",
    });
    assert.equal(fileComponentDialogVisual.bodyOverflow, "hidden");
    assert.equal(
      fileComponentDialogVisual.documentScrollWidth,
      fileComponentDialogVisual.documentClientWidth,
    );
    await fileComponentEditor
      .getByRole("button", { name: "Отмена", exact: true })
      .click();
    await fileComponentDialog.waitFor({ state: "detached" });
    await runtime.page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => resolve()),
        ),
    );
    assert.equal(
      await fileComponentEdit.evaluate(
        (button) => document.activeElement === button,
      ),
      true,
    );

    await componentTrigger.hover();
    await componentTrigger.evaluate((element) =>
      (element as HTMLElement).focus(),
    );
    await runtime.page.evaluate(
      () => new Promise<void>((resolve) => window.setTimeout(resolve, 180)),
    );

    const showOnStudentScreen = fileComponentCard.getByRole("button", {
      name: "Показать «Файл» на экране ученика",
      exact: true,
    });
    assert.equal(
      await showOnStudentScreen.getAttribute("aria-pressed"),
      "false",
    );
    assert.equal(
      await showOnStudentScreen.locator("svg.lucide-monitor-play").count(),
      1,
    );
    const lessonStudentScreenTab = runtime.page.getByRole("tab", {
      name: "Экран ученика",
      exact: true,
    });
    assert.equal(
      await lessonStudentScreenTab.locator("svg.lucide-monitor-play").count(),
      1,
    );
    const inactiveStudentScreenVisual =
      await readComponentActionVisual(showOnStudentScreen);
    assert.equal(inactiveStudentScreenVisual.effectiveOpacity, 0);
    assert.equal(inactiveStudentScreenVisual.hitTested, false);

    await fileComponentCard.hover();
    await runtime.page.evaluate(
      () => new Promise<void>((resolve) => window.setTimeout(resolve, 180)),
    );
    await showOnStudentScreen.click();
    const hideFromStudentScreen = fileComponentCard.getByRole("button", {
      name: "Убрать «Файл» с экрана ученика",
      exact: true,
    });
    await hideFromStudentScreen.waitFor();
    assert.deepEqual(e2eStudentScreenRpcPayloads, [
      {
        p_component_id: E2E_COMPONENT_ID,
        p_mode: "new",
        p_slide_id: null,
      },
    ]);

    await componentTrigger.hover();
    await componentTrigger.evaluate((element) =>
      (element as HTMLElement).focus(),
    );
    await runtime.page.evaluate(
      () => new Promise<void>((resolve) => window.setTimeout(resolve, 180)),
    );
    assert.equal(
      await hideFromStudentScreen.getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await hideFromStudentScreen.locator("svg.lucide-monitor-play").count(),
      1,
    );
    assert.deepEqual(await readComponentActionVisual(hideFromStudentScreen), {
      effectiveOpacity: 1,
      rendered: true,
      hitTested: true,
      background: "rgb(224, 242, 254)",
      color: "rgb(7, 89, 133)",
      pointerEvents: "auto",
    });
    const inactiveEditVisual =
      await readComponentActionVisual(fileComponentEdit);
    assert.equal(inactiveEditVisual.effectiveOpacity, 0);
    assert.equal(inactiveEditVisual.hitTested, false);

    await lessonStudentScreenTab.click();
    const lessonStudentScreenPanel = runtime.page.locator(
      "#lesson-workspace-panel-student",
    );
    await lessonStudentScreenPanel.waitFor();
    const visibleStudentScreenText =
      (await lessonStudentScreenPanel.textContent()) ?? "";
    assert.match(visibleStudentScreenText, /Слайд 1 из 1/);
    assert.match(
      visibleStudentScreenText,
      /Файл пока не прикреплён или недоступен\./,
    );
    assert.doesNotMatch(visibleStudentScreenText, /Экран ученика пока пуст/);
    await runtime.page.getByRole("tab", { name: "План", exact: true }).click();
    await hideFromStudentScreen.waitFor();
    await componentTrigger.hover();
    await componentTrigger.evaluate((element) =>
      (element as HTMLElement).focus(),
    );
    await hideFromStudentScreen.click();
    await showOnStudentScreen.waitFor();
    assert.deepEqual(e2eStudentScreenRpcPayloads, [
      {
        p_component_id: E2E_COMPONENT_ID,
        p_mode: "new",
        p_slide_id: null,
      },
      {
        p_component_id: E2E_COMPONENT_ID,
        p_mode: "hide",
        p_slide_id: null,
      },
    ]);
    await componentTrigger.hover();
    await componentTrigger.evaluate((element) =>
      (element as HTMLElement).focus(),
    );
    await runtime.page.evaluate(
      () => new Promise<void>((resolve) => window.setTimeout(resolve, 180)),
    );
    assert.equal(
      await showOnStudentScreen.getAttribute("aria-pressed"),
      "false",
    );
    const hiddenAgainStudentScreenVisual =
      await readComponentActionVisual(showOnStudentScreen);
    assert.equal(hiddenAgainStudentScreenVisual.effectiveOpacity, 0);
    assert.equal(hiddenAgainStudentScreenVisual.hitTested, false);
    await lessonStudentScreenTab.click();
    await lessonStudentScreenPanel.waitFor();
    assert.match(
      (await lessonStudentScreenPanel.textContent()) ?? "",
      /Экран ученика пока пуст/,
    );
    await runtime.page.getByRole("tab", { name: "План", exact: true }).click();

    const backPageTransition = runtime.page.locator(
      'html[data-page-transition-direction="back"]',
    );
    const courseBackButton = runtime.page.getByRole("button", {
      name: `Вернуться: ${E2E_COURSE_TITLE}`,
      exact: true,
    });
    await backPageTransition.waitFor({ state: "detached" });
    await Promise.all([backPageTransition.waitFor(), courseBackButton.click()]);
    await courseHeading.waitFor();
    await backPageTransition.waitFor({ state: "detached" });

    html = await runtime.page.content();
    assert.match(html, /aria-label="Разделы курса"/);
    assert.match(html, new RegExp(E2E_LESSON_TITLE));
  } finally {
    e2eSecondCourseVisible = false;
    e2eSecondCourseArchived = false;
    e2eSecondLessonVisible = false;
    e2eComponentLearnerVisible = false;
    e2eStudentScreenRpcPayloads.length = 0;
    await runtime.close();
  }
});

test("browser smoke: mobile Course and Lesson keep the demo rhythm without page overflow", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({
    cookie: authenticatedCookieValue(),
    viewport: { width: 375, height: 812 },
    mobile: true,
  });

  try {
    e2eAuthoredExerciseVisible = true;
    await runtime.page.setViewportSize({ width: 320, height: 812 });
    await runtime.page.goto("/courses/new", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", { name: "Новый курс", exact: true, level: 1 })
      .waitFor();
    const newCourseAudience = runtime.page.getByRole("group", {
      name: "Направление обучения",
      exact: true,
    });
    await newCourseAudience.waitFor();
    await newCourseAudience
      .getByRole("button", { name: "Обучение детей", exact: true })
      .waitFor();
    await newCourseAudience
      .getByRole("button", { name: "Обучение педагогов", exact: true })
      .waitFor();
    assertMobileEditableContract(
      await readMobileEditableContract(runtime.page),
      320,
      "Educator New Course at 320px",
    );
    const newCourseAudienceContract = await newCourseAudience.evaluate(
      (group) => {
        const parent = group.parentElement;
        if (!parent) {
          throw new Error("New Course audience parent is missing");
        }
        const viewportWidth = document.documentElement.clientWidth;
        const parentRect = parent.getBoundingClientRect();
        const groupRect = group.getBoundingClientRect();
        const groupStyle = getComputedStyle(group);
        const buttons = Array.from(
          group.querySelectorAll<HTMLButtonElement>("button"),
        );
        const buttonRects = buttons.map((button) =>
          button.getBoundingClientRect(),
        );
        return {
          viewportWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          parentInsideViewport:
            parentRect.left >= 0 && parentRect.right <= viewportWidth,
          groupInsideParent:
            groupRect.left >= parentRect.left - 0.5 &&
            groupRect.right <= parentRect.right + 0.5,
          groupInsideViewport:
            groupRect.left >= 0 && groupRect.right <= viewportWidth,
          groupWidth: groupRect.width,
          availableParentWidth: parentRect.width,
          parentRightInset: viewportWidth - parentRect.right,
          groupRightInset: parentRect.right - groupRect.right,
          height: groupRect.height,
          padding: groupStyle.padding,
          gap: groupStyle.gap,
          borderTopWidth: groupStyle.borderTopWidth,
          borderTopStyle: groupStyle.borderTopStyle,
          borderTopColor: groupStyle.borderTopColor,
          backgroundClip: groupStyle.backgroundClip,
          optionHeights: buttonRects.map((rect) => rect.height),
          seamGaps: buttonRects
            .slice(1)
            .map((rect, index) =>
              Number((rect.left - buttonRects[index]!.right).toFixed(3)),
            ),
          options: buttons.map((button) => {
            const label = button.querySelector<HTMLElement>(":scope > span");
            if (!label) {
              throw new Error("New Course audience label is missing");
            }
            const labelStyle = getComputedStyle(label);
            const fullText = label.textContent?.trim() ?? "";
            return {
              fullText,
              ariaLabel: button.getAttribute("aria-label"),
              height: button.getBoundingClientRect().height,
              fontSize: getComputedStyle(button).fontSize,
              overflow: labelStyle.overflow,
              textOverflow: labelStyle.textOverflow,
              whiteSpace: labelStyle.whiteSpace,
              clientWidth: label.clientWidth,
              scrollWidth: label.scrollWidth,
              isEllipsized: label.scrollWidth > label.clientWidth,
            };
          }),
        };
      },
    );
    assert.equal(newCourseAudienceContract.viewportWidth, 320);
    assert.equal(newCourseAudienceContract.documentScrollWidth, 320);
    assert.ok(newCourseAudienceContract.bodyScrollWidth <= 320);
    assert.equal(newCourseAudienceContract.parentInsideViewport, true);
    assert.equal(newCourseAudienceContract.groupInsideParent, true);
    assert.equal(newCourseAudienceContract.groupInsideViewport, true);
    assert.ok(
      newCourseAudienceContract.groupWidth <=
        newCourseAudienceContract.availableParentWidth + 0.5,
    );
    assert.ok(newCourseAudienceContract.parentRightInset >= 11.5);
    assert.ok(newCourseAudienceContract.groupRightInset >= -0.5);
    assert.equal(newCourseAudienceContract.height, 40);
    assert.equal(newCourseAudienceContract.padding, "0px");
    assert.equal(newCourseAudienceContract.gap, "2px");
    assert.equal(
      newCourseAudienceContract.borderTopWidth,
      E2E_PRODUCT_SURFACE_BORDER_WIDTH,
    );
    assert.equal(newCourseAudienceContract.borderTopStyle, "solid");
    assert.equal(
      newCourseAudienceContract.borderTopColor,
      E2E_PRODUCT_SURFACE_BORDER_COLOR,
    );
    assert.equal(
      newCourseAudienceContract.backgroundClip,
      E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
    );
    assert.deepEqual(newCourseAudienceContract.optionHeights, [38, 38]);
    assert.deepEqual(newCourseAudienceContract.seamGaps, [2]);
    assert.deepEqual(
      newCourseAudienceContract.options.map(({ fullText, ariaLabel }) => ({
        fullText,
        ariaLabel,
      })),
      [
        { fullText: "Дети", ariaLabel: "Обучение детей" },
        { fullText: "Педагоги", ariaLabel: "Обучение педагогов" },
      ],
    );
    assert.ok(
      newCourseAudienceContract.options.every(
        ({ height, fontSize, overflow, textOverflow, whiteSpace }) =>
          height === 38 &&
          fontSize === "14.08px" &&
          overflow === "hidden" &&
          textOverflow === "ellipsis" &&
          whiteSpace === "nowrap",
      ),
    );
    assert.ok(
      newCourseAudienceContract.options.every(
        ({ clientWidth, scrollWidth, isEllipsized }) =>
          !isEllipsized && scrollWidth <= clientWidth,
      ),
      `320px New Course must keep both short visible direction labels untruncated while preserving their full accessible names: ${JSON.stringify(newCourseAudienceContract.options)}`,
    );
    await assertSegmentedIndicatorAligned(
      runtime.page,
      "Направление обучения",
      "New Course audience at 320px",
    );
    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Направление обучения",
      optionName: "Обучение педагогов",
      label: "New Course audience at 320px",
    });

    await runtime.page.setViewportSize({ width: 375, height: 812 });
    await runtime.page.goto("/courses", { waitUntil: "networkidle" });
    await runtime.page.locator(".course-index-mobile-list").waitFor();
    const mobileCourseLink = runtime.page.getByRole("link", {
      name: E2E_COURSE_TITLE,
      exact: true,
    });
    await mobileCourseLink.waitFor();
    assertMobileEditableContract(
      await readMobileEditableContract(runtime.page),
      375,
      "Courses at 375px",
    );
    await runtime.page.setViewportSize({ width: 320, height: 812 });
    assertMobileEditableContract(
      await readMobileEditableContract(runtime.page),
      320,
      "Courses at 320px",
    );
    await runtime.page.setViewportSize({ width: 375, height: 812 });

    const mobileCoursesToolbar = await runtime.page.evaluate(() => {
      const themeColorMeta = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]',
      );
      const viewportMeta = document.querySelector<HTMLMetaElement>(
        'meta[name="viewport"]',
      );
      const shell = document.querySelector<HTMLElement>(".course-demo-shell");
      const topNav = document.querySelector<HTMLElement>(".course-top-nav");
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
      const titleRow = pageHeading?.querySelector<HTMLElement>(
        ".app-page-title-row",
      );
      const title = titleRow?.querySelector<HTMLElement>(".app-page-title");
      const pageHeaderContent = pageHeader?.querySelector<HTMLElement>(
        ".app-page-header-content",
      );
      const headerActions =
        pageHeader?.querySelector<HTMLElement>(".app-page-actions");
      const headerAction = headerActions?.firstElementChild;
      const toolbar = document.querySelector<HTMLElement>(
        ".course-index-toolbar",
      );
      const toolbarSearch = toolbar?.querySelector<HTMLElement>(
        ".compact-toolbar-search",
      );
      const searchInput = toolbarSearch?.querySelector<HTMLInputElement>(
        "input.product-control-search",
      );
      const toolbarRail = toolbar?.querySelector<HTMLElement>(
        ".compact-toolbar-rail",
      );
      const viewSwitch = toolbar?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Вид списка курсов"]',
      );
      const activeViewButton = viewSwitch?.querySelector<HTMLElement>(
        'button[aria-pressed="true"]',
      );
      const workspaceTabs = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.courses-index-shell [role="tab"]',
        ),
      ).filter((tab) => tab.getClientRects().length > 0);
      const mobileList = document.querySelector<HTMLElement>(
        ".course-index-mobile-list",
      );
      const wideTableWrap = document.querySelector<HTMLElement>(
        ".courses-index-shell .course-index-table-wrap",
      );
      if (
        !themeColorMeta ||
        !viewportMeta ||
        !shell ||
        !topNav ||
        !pageHeader ||
        !pageHeading ||
        !titleRow ||
        !title ||
        !pageHeaderContent ||
        !headerActions ||
        !headerAction ||
        !toolbar ||
        !toolbarSearch ||
        !searchInput ||
        !toolbarRail ||
        !viewSwitch ||
        !activeViewButton ||
        workspaceTabs.length === 0 ||
        !mobileList ||
        !wideTableWrap
      ) {
        throw new Error("Mobile Courses toolbar controls are missing");
      }
      const viewportWidth = document.documentElement.clientWidth;
      const pageHeaderStyle = getComputedStyle(pageHeader);
      const titleRowStyle = getComputedStyle(titleRow);
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const pageHeadingRect = pageHeading.getBoundingClientRect();
      const titleRowRect = titleRow.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();
      const headerActionRect = headerAction.getBoundingClientRect();
      const pageHeaderContentWidth =
        pageHeaderRect.width -
        Number.parseFloat(pageHeaderStyle.paddingLeft) -
        Number.parseFloat(pageHeaderStyle.paddingRight);
      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarStyle = getComputedStyle(toolbar);
      const toolbarSearchRect = toolbarSearch.getBoundingClientRect();
      const toolbarRailRect = toolbarRail.getBoundingClientRect();
      const mobileListRect = mobileList.getBoundingClientRect();
      const visibleMobileCards = Array.from(mobileList.children).filter(
        (child) =>
          child instanceof HTMLElement && child.getClientRects().length > 0,
      );
      return {
        clientWidth: viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        theme: {
          meta: themeColorMeta.content.toLowerCase(),
          viewport: viewportMeta.content.toLowerCase(),
          html: getComputedStyle(document.documentElement).backgroundColor,
          body: getComputedStyle(document.body).backgroundColor,
          shell: getComputedStyle(shell).backgroundColor,
          htmlImage: getComputedStyle(document.documentElement).backgroundImage,
          bodyImage: getComputedStyle(document.body).backgroundImage,
        },
        topNav: {
          position: getComputedStyle(topNav).position,
          top: getComputedStyle(topNav).top,
        },
        pageHeader: {
          contentWidth: pageHeaderContentWidth,
          headingWidth: pageHeadingRect.width,
          titleRowWidth: titleRowRect.width,
          titleWidth: titleRect.width,
          actionsWidth: headerActionsRect.width,
          actionWidth: headerActionRect.width,
          actionsFitContentDelta: Math.abs(
            headerActionsRect.width - headerActionRect.width,
          ),
          actionsShareTitleRow:
            title.parentElement === titleRow &&
            headerActions.parentElement === titleRow &&
            headerActionsRect.top < titleRect.bottom &&
            headerActionsRect.bottom > titleRect.top,
          actionsWrappedBelowTitle:
            headerActionsRect.top >= titleRect.bottom - 0.5,
          actionStackGapDelta: Math.abs(
            headerActionsRect.top -
              titleRect.bottom -
              Number.parseFloat(titleRowStyle.rowGap),
          ),
          titleActionBottomDelta: Math.abs(
            headerActionsRect.bottom - titleRect.bottom,
          ),
          actionControlBottomDelta: Math.abs(
            headerActionRect.bottom - titleRect.bottom,
          ),
          actionRightInsetDelta: Math.abs(
            pageHeaderRect.right -
              Number.parseFloat(pageHeaderStyle.paddingRight) -
              headerActionsRect.right,
          ),
          titleActionGap: headerActionsRect.left - titleRect.right,
          actionsDoNotOverlapTitle:
            headerActionsRect.top >= titleRect.bottom - 0.5 ||
            headerActionsRect.left >= titleRect.right,
          actionsInsideViewport:
            headerActionsRect.left >= 0 &&
            headerActionsRect.right <= viewportWidth,
          actionHeight: headerActionRect.height,
          actionFontSize: getComputedStyle(headerAction).fontSize,
        },
        toolbarInsideViewport:
          toolbarRect.left >= 0 && toolbarRect.right <= viewportWidth,
        toolbarPaddingLeft: toolbarStyle.paddingLeft,
        toolbarPaddingRight: toolbarStyle.paddingRight,
        searchStartInset: toolbarSearchRect.left - toolbarRect.left,
        railEndInset: toolbarRect.right - toolbarRailRect.right,
        shellHeight: getComputedStyle(viewSwitch).height,
        shellWidth: viewSwitch.getBoundingClientRect().width,
        shellPadding: getComputedStyle(viewSwitch).padding,
        shellGap: getComputedStyle(viewSwitch).gap,
        shellBorderTopWidth: getComputedStyle(viewSwitch).borderTopWidth,
        shellBorderTopStyle: getComputedStyle(viewSwitch).borderTopStyle,
        shellBorderTopColor: getComputedStyle(viewSwitch).borderTopColor,
        shellBackgroundClip: getComputedStyle(viewSwitch).backgroundClip,
        activeButtonHeight: getComputedStyle(activeViewButton).height,
        searchHeight: searchInput.getBoundingClientRect().height,
        searchFontSize: getComputedStyle(searchInput).fontSize,
        workspaceTabHeights: workspaceTabs.map(
          (tab) => tab.getBoundingClientRect().height,
        ),
        workspaceTabFontSizes: workspaceTabs.map(
          (tab) => getComputedStyle(tab).fontSize,
        ),
        viewButtonHeights: Array.from(
          viewSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => button.getBoundingClientRect().height),
        viewButtonFontSizes: Array.from(
          viewSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => getComputedStyle(button).fontSize),
        viewIconSizes: Array.from(
          viewSwitch.querySelectorAll<SVGElement>("button svg"),
        ).map((icon) => {
          const rect = icon.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
        mobileProjection: {
          listDisplay: getComputedStyle(mobileList).display,
          listVisible: mobileList.getClientRects().length > 0,
          listInsideViewport:
            mobileListRect.left >= 0 && mobileListRect.right <= viewportWidth,
          visibleCardCount: visibleMobileCards.length,
          cardActionHeights: visibleMobileCards
            .map((card) =>
              card.querySelector<HTMLElement>(
                ".product-btn.action-menu-trigger",
              ),
            )
            .filter((trigger): trigger is HTMLElement => Boolean(trigger))
            .map((trigger) => trigger.getBoundingClientRect().height),
          wideTableDisplay: getComputedStyle(wideTableWrap).display,
          wideTableVisible: wideTableWrap.getClientRects().length > 0,
        },
        activeLabel: activeViewButton.getAttribute("aria-label"),
        activePressed: activeViewButton.getAttribute("aria-pressed"),
        viewButtons: Array.from(viewSwitch.querySelectorAll("button")).map(
          (button) => button.getAttribute("aria-label"),
        ),
        filterCount: toolbar.querySelectorAll(".course-filter-menu").length,
        nativeSelectCount: toolbar.querySelectorAll("select").length,
      };
    });
    assert.deepEqual(
      {
        clientWidth: mobileCoursesToolbar.clientWidth,
        scrollWidth: mobileCoursesToolbar.scrollWidth,
        toolbarInsideViewport: mobileCoursesToolbar.toolbarInsideViewport,
        toolbarPaddingLeft: mobileCoursesToolbar.toolbarPaddingLeft,
        toolbarPaddingRight: mobileCoursesToolbar.toolbarPaddingRight,
        activeLabel: mobileCoursesToolbar.activeLabel,
        activePressed: mobileCoursesToolbar.activePressed,
        viewButtons: mobileCoursesToolbar.viewButtons,
        filterCount: mobileCoursesToolbar.filterCount,
        nativeSelectCount: mobileCoursesToolbar.nativeSelectCount,
      },
      {
        clientWidth: 375,
        scrollWidth: 375,
        toolbarInsideViewport: true,
        toolbarPaddingLeft: "0px",
        toolbarPaddingRight: "0px",
        activeLabel: "Показать таблицей",
        activePressed: "true",
        viewButtons: ["Показать таблицей", "Показать карточками"],
        filterCount: 0,
        nativeSelectCount: 0,
      },
    );
    assert.deepEqual(mobileCoursesToolbar.theme, {
      meta: "#f5f1e8",
      viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
      html: "rgb(245, 241, 232)",
      body: "rgb(245, 241, 232)",
      shell: "rgb(245, 241, 232)",
      htmlImage: "none",
      bodyImage: "none",
    });
    assert.doesNotMatch(
      mobileCoursesToolbar.theme.viewport,
      /user-scalable\s*=\s*no|maximum-scale\s*=\s*(?:0|1(?:\.\d+)?)(?:\s|,|$)/,
    );
    assert.deepEqual(mobileCoursesToolbar.topNav, {
      position: "fixed",
      top: "0px",
    });
    assert.equal(mobileCoursesToolbar.shellHeight, "40px");
    assert.equal(mobileCoursesToolbar.shellWidth, 80);
    assert.equal(mobileCoursesToolbar.shellPadding, "0px");
    assert.equal(mobileCoursesToolbar.shellGap, "2px");
    assert.equal(
      mobileCoursesToolbar.shellBorderTopWidth,
      E2E_PRODUCT_SURFACE_BORDER_WIDTH,
    );
    assert.equal(mobileCoursesToolbar.shellBorderTopStyle, "solid");
    assert.equal(
      mobileCoursesToolbar.shellBorderTopColor,
      E2E_PRODUCT_SURFACE_BORDER_COLOR,
    );
    assert.equal(
      mobileCoursesToolbar.shellBackgroundClip,
      E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
    );
    assert.equal(mobileCoursesToolbar.activeButtonHeight, "38px");
    assert.equal(mobileCoursesToolbar.searchHeight, 40);
    assert.equal(mobileCoursesToolbar.searchFontSize, "16px");
    assert.ok(
      mobileCoursesToolbar.workspaceTabHeights.every((height) => height === 40),
    );
    assert.ok(
      mobileCoursesToolbar.workspaceTabFontSizes.every(
        (fontSize) => fontSize === "14.08px",
      ),
    );
    assert.deepEqual(mobileCoursesToolbar.viewButtonHeights, [38, 38]);
    assert.deepEqual(mobileCoursesToolbar.viewButtonFontSizes, [
      "14.08px",
      "14.08px",
    ]);
    assert.deepEqual(mobileCoursesToolbar.viewIconSizes, [
      { width: 16, height: 16 },
      { width: 16, height: 16 },
    ]);
    assert.equal(mobileCoursesToolbar.pageHeader.actionHeight, 40);
    assert.equal(mobileCoursesToolbar.pageHeader.actionFontSize, "14.08px");
    assert.notEqual(mobileCoursesToolbar.mobileProjection.listDisplay, "none");
    assert.equal(mobileCoursesToolbar.mobileProjection.listVisible, true);
    assert.equal(
      mobileCoursesToolbar.mobileProjection.listInsideViewport,
      true,
    );
    assert.ok(mobileCoursesToolbar.mobileProjection.visibleCardCount > 0);
    assert.ok(
      mobileCoursesToolbar.mobileProjection.cardActionHeights.length > 0,
    );
    assert.ok(
      mobileCoursesToolbar.mobileProjection.cardActionHeights.every(
        (height) => height === 40,
      ),
    );
    assert.equal(
      mobileCoursesToolbar.mobileProjection.wideTableDisplay,
      "none",
    );
    assert.equal(mobileCoursesToolbar.mobileProjection.wideTableVisible, false);
    assert.ok(mobileCoursesToolbar.pageHeader.contentWidth > 0);
    assert.ok(
      Math.abs(
        mobileCoursesToolbar.pageHeader.headingWidth -
          mobileCoursesToolbar.pageHeader.contentWidth,
      ) < 0.5,
    );
    assert.ok(
      Math.abs(
        mobileCoursesToolbar.pageHeader.titleRowWidth -
          mobileCoursesToolbar.pageHeader.contentWidth,
      ) < 0.5,
    );
    assert.ok(Math.abs(mobileCoursesToolbar.searchStartInset) < 0.5);
    assert.ok(Math.abs(mobileCoursesToolbar.railEndInset) < 0.5);
    assert.ok(mobileCoursesToolbar.pageHeader.actionWidth > 0);
    assert.ok(
      mobileCoursesToolbar.pageHeader.titleWidth >
        mobileCoursesToolbar.pageHeader.actionsWidth,
    );
    assert.ok(mobileCoursesToolbar.pageHeader.actionsFitContentDelta < 0.5);
    assert.equal(mobileCoursesToolbar.pageHeader.actionsShareTitleRow, true);
    assert.equal(
      mobileCoursesToolbar.pageHeader.actionsWrappedBelowTitle,
      false,
    );
    assert.ok(mobileCoursesToolbar.pageHeader.titleActionBottomDelta < 0.5);
    assert.ok(mobileCoursesToolbar.pageHeader.actionControlBottomDelta < 0.5);
    assert.ok(mobileCoursesToolbar.pageHeader.titleActionGap >= 0);
    assert.ok(mobileCoursesToolbar.pageHeader.actionRightInsetDelta < 0.5);
    assert.equal(
      mobileCoursesToolbar.pageHeader.actionsDoNotOverlapTitle,
      true,
    );
    assert.equal(mobileCoursesToolbar.pageHeader.actionsInsideViewport, true);

    await runtime.page.setViewportSize({ width: 844, height: 390 });
    const landscapeLauncher = runtime.page.getByRole("button", {
      name: "Открыть сообщения",
      exact: true,
    });
    await landscapeLauncher.waitFor();
    assertMobileEditableContract(
      await readMobileEditableContract(runtime.page),
      844,
      "Courses in coarse-pointer landscape",
    );
    const mobileLandscapeContract = await runtime.page.evaluate(() => {
      const viewSwitch = document.querySelector<HTMLElement>(
        '[role="group"][aria-label="Вид списка курсов"]',
      );
      const searchInput = document.querySelector<HTMLInputElement>(
        ".course-index-toolbar input.product-control-search",
      );
      const primaryAction = document.querySelector<HTMLElement>(
        ".app-page-header .app-page-actions > *",
      );
      const header = document.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );
      const tableSurface = document.querySelector<HTMLElement>(
        ".courses-index-shell .course-index-table-wrap",
      );
      const selectedViewOption = viewSwitch?.querySelector<HTMLElement>(
        'button[aria-pressed="true"]',
      );
      const inactiveViewOption = viewSwitch?.querySelector<HTMLElement>(
        'button[aria-pressed="false"]',
      );
      const visibleTabs = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.courses-index-shell [role="tab"]',
        ),
      ).filter((tab) => tab.getClientRects().length > 0);
      const launcher = document.querySelector<HTMLElement>(
        ".communication-center-launcher",
      );
      const launcherIcon = launcher?.querySelector<SVGElement>("svg");
      if (
        !viewSwitch ||
        !searchInput ||
        !primaryAction ||
        !header ||
        !tableSurface ||
        !selectedViewOption ||
        !inactiveViewOption ||
        visibleTabs.length === 0 ||
        !launcher ||
        !launcherIcon
      ) {
        throw new Error("Coarse-pointer landscape controls are missing");
      }
      const launcherRect = launcher.getBoundingClientRect();
      const launcherIconRect = launcherIcon.getBoundingClientRect();
      const readOpaqueWhiteSurface = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          opacity: style.opacity,
          backdropFilter: style.backdropFilter,
        };
      };
      const viewSwitchRect = viewSwitch.getBoundingClientRect();
      const viewSwitchStyle = getComputedStyle(viewSwitch);
      const selectedStyle = getComputedStyle(selectedViewOption);
      const inactiveStyle = getComputedStyle(inactiveViewOption);
      const viewIndicator = viewSwitch.querySelector<HTMLElement>(
        ".product-segmented-control-indicator",
      );
      if (!viewIndicator) {
        throw new Error("Coarse-pointer Course view indicator is missing");
      }
      const viewIndicatorStyle = getComputedStyle(viewIndicator);
      const viewIndicatorRect = viewIndicator.getBoundingClientRect();
      const selectedViewRect = selectedViewOption.getBoundingClientRect();
      const viewOptions = Array.from(
        viewSwitch.querySelectorAll<HTMLElement>("button"),
      );
      const viewOptionRects = viewOptions.map((button) =>
        button.getBoundingClientRect(),
      );
      const readSurface = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return {
          borderTopWidth: style.borderTopWidth,
          borderTopStyle: style.borderTopStyle,
          borderTopColor: style.borderTopColor,
          borderRadius: style.borderRadius,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          backgroundClip: style.backgroundClip,
          boxShadow: style.boxShadow,
        };
      };
      const readGlyph = (icon: SVGElement) => {
        const rect = icon.getBoundingClientRect();
        const strokePart = icon.querySelector<SVGElement>(
          "path, line, polyline, polygon, circle, ellipse, rect",
        );
        const strokeStyle = getComputedStyle(strokePart ?? icon);
        return {
          width: rect.width,
          height: rect.height,
          strokeWidth: strokeStyle.strokeWidth,
          vectorEffect: strokeStyle.vectorEffect,
        };
      };
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        coarsePointer: matchMedia("(pointer: coarse)").matches,
        noHover: matchMedia("(hover: none)").matches,
        segmentedHeight: viewSwitch.getBoundingClientRect().height,
        segmentedPadding: getComputedStyle(viewSwitch).padding,
        segmentedButtonHeights: Array.from(
          viewSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => button.getBoundingClientRect().height),
        segmentedButtonFontSizes: Array.from(
          viewSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => getComputedStyle(button).fontSize),
        segmentedButtonFontWeights: Array.from(
          viewSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => getComputedStyle(button).fontWeight),
        segmentedIconSizes: Array.from(
          viewSwitch.querySelectorAll<SVGElement>("button svg"),
        ).map((icon) => {
          const rect = icon.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
        searchHeight: searchInput.getBoundingClientRect().height,
        searchFontSize: Number.parseFloat(
          getComputedStyle(searchInput).fontSize,
        ),
        searchFontWeight: getComputedStyle(searchInput).fontWeight,
        primaryActionHeight: primaryAction.getBoundingClientRect().height,
        primaryActionFontSize: getComputedStyle(primaryAction).fontSize,
        primaryActionFontWeight: getComputedStyle(primaryAction).fontWeight,
        tabHeights: visibleTabs.map(
          (tab) => tab.getBoundingClientRect().height,
        ),
        tabFontSizes: visibleTabs.map((tab) => getComputedStyle(tab).fontSize),
        launcher: {
          width: launcherRect.width,
          height: launcherRect.height,
          iconWidth: launcherIconRect.width,
          iconHeight: launcherIconRect.height,
        },
        whiteSurfaces: {
          header: readOpaqueWhiteSurface(header),
          primaryAction: readOpaqueWhiteSurface(primaryAction),
          searchInput: readOpaqueWhiteSurface(searchInput),
          table: readOpaqueWhiteSurface(tableSurface),
        },
        viewToggle: {
          group: {
            width: viewSwitchRect.width,
            height: viewSwitchRect.height,
            padding: viewSwitchStyle.padding,
            gap: viewSwitchStyle.gap,
            borderTopWidth: viewSwitchStyle.borderTopWidth,
            borderTopStyle: viewSwitchStyle.borderTopStyle,
            borderTopColor: viewSwitchStyle.borderTopColor,
            borderRadius: viewSwitchStyle.borderRadius,
            backgroundColor: viewSwitchStyle.backgroundColor,
            backgroundClip: viewSwitchStyle.backgroundClip,
            boxShadow: viewSwitchStyle.boxShadow,
          },
          groupIndicatorReady: viewSwitch.getAttribute("data-indicator-ready"),
          groupBeforeContent: getComputedStyle(viewSwitch, "::before").content,
          indicatorCount: viewSwitch.querySelectorAll(
            ".product-segmented-control-indicator",
          ).length,
          indicator: {
            surface: readSurface(viewIndicator),
            width: viewIndicatorRect.width,
            height: viewIndicatorRect.height,
            opacity: viewIndicatorStyle.opacity,
            display: viewIndicatorStyle.display,
            pointerEvents: viewIndicatorStyle.pointerEvents,
            backdropFilter: viewIndicatorStyle.backdropFilter,
            zIndex: viewIndicatorStyle.zIndex,
            ariaHidden: viewIndicator.getAttribute("aria-hidden"),
            ready: viewIndicator.getAttribute("data-ready"),
            motionReady: viewIndicator.getAttribute("data-motion-ready"),
            transitionProperty: viewIndicatorStyle.transitionProperty,
            transitionDuration: viewIndicatorStyle.transitionDuration,
            transitionTimingFunction:
              viewIndicatorStyle.transitionTimingFunction,
            selectedStartDelta: Math.abs(
              viewIndicatorRect.left - selectedViewRect.left,
            ),
            selectedTopDelta: Math.abs(
              viewIndicatorRect.top - selectedViewRect.top,
            ),
            selectedWidthDelta: Math.abs(
              viewIndicatorRect.width - selectedViewRect.width,
            ),
            selectedHeightDelta: Math.abs(
              viewIndicatorRect.height - selectedViewRect.height,
            ),
          },
          optionWidths: viewOptionRects.map((rect) => rect.width),
          optionHeights: viewOptionRects.map((rect) => rect.height),
          seamGaps: viewOptionRects
            .slice(1)
            .map((rect, index) =>
              Number((rect.left - viewOptionRects[index]!.right).toFixed(3)),
            ),
          optionRadii: viewOptions.map(
            (button) => getComputedStyle(button).borderRadius,
          ),
          iconStyles: Array.from(
            viewSwitch.querySelectorAll<SVGElement>("button svg.lucide"),
          ).map(readGlyph),
          referenceButton: readSurface(primaryAction),
          selected: {
            surface: readSurface(selectedViewOption),
            transform: selectedStyle.transform,
            beforeContent: getComputedStyle(selectedViewOption, "::before")
              .content,
          },
          inactive: {
            borderTopWidth: inactiveStyle.borderTopWidth,
            borderTopStyle: inactiveStyle.borderTopStyle,
            backgroundColor: inactiveStyle.backgroundColor,
            backgroundImage: inactiveStyle.backgroundImage,
            boxShadow: inactiveStyle.boxShadow,
            transform: inactiveStyle.transform,
            beforeContent: getComputedStyle(inactiveViewOption, "::before")
              .content,
          },
        },
      };
    });
    assert.deepEqual(
      {
        clientWidth: mobileLandscapeContract.clientWidth,
        scrollWidth: mobileLandscapeContract.scrollWidth,
        coarsePointer: mobileLandscapeContract.coarsePointer,
        noHover: mobileLandscapeContract.noHover,
        segmentedHeight: mobileLandscapeContract.segmentedHeight,
        segmentedPadding: mobileLandscapeContract.segmentedPadding,
        segmentedButtonHeights: mobileLandscapeContract.segmentedButtonHeights,
        segmentedButtonFontSizes:
          mobileLandscapeContract.segmentedButtonFontSizes,
        segmentedButtonFontWeights:
          mobileLandscapeContract.segmentedButtonFontWeights,
        segmentedIconSizes: mobileLandscapeContract.segmentedIconSizes,
        searchHeight: mobileLandscapeContract.searchHeight,
        searchFontSize: mobileLandscapeContract.searchFontSize,
        searchFontWeight: mobileLandscapeContract.searchFontWeight,
      },
      {
        clientWidth: 844,
        scrollWidth: 844,
        coarsePointer: true,
        noHover: true,
        segmentedHeight: 40,
        segmentedPadding: "0px",
        segmentedButtonHeights: [38, 38],
        segmentedButtonFontSizes: ["14.08px", "14.08px"],
        segmentedButtonFontWeights: ["400", "400"],
        segmentedIconSizes: [
          { width: 16, height: 16 },
          { width: 16, height: 16 },
        ],
        searchHeight: 40,
        searchFontSize: 16,
        searchFontWeight: "400",
      },
    );
    assert.equal(mobileLandscapeContract.primaryActionHeight, 40);
    assert.equal(mobileLandscapeContract.primaryActionFontSize, "14.08px");
    assert.equal(mobileLandscapeContract.primaryActionFontWeight, "400");
    assert.ok(
      mobileLandscapeContract.tabHeights.every((height) => height === 40),
    );
    assert.ok(
      mobileLandscapeContract.tabFontSizes.every(
        (fontSize) => fontSize === "14.08px",
      ),
    );
    assert.ok(mobileLandscapeContract.launcher.width >= 56);
    assert.ok(mobileLandscapeContract.launcher.height >= 56);
    assert.ok(mobileLandscapeContract.launcher.iconWidth >= 24);
    assert.ok(mobileLandscapeContract.launcher.iconHeight >= 24);
    for (const [surfaceName, surface] of Object.entries(
      mobileLandscapeContract.whiteSurfaces,
    )) {
      assertOpaqueWhiteSurface(surface, `844px Course ${surfaceName}`);
    }
    assertTouchSegmentedControl(
      mobileLandscapeContract.viewToggle,
      "844px coarse Course view toggle",
    );

    await landscapeLauncher.click();
    const landscapeMessagesPanel = runtime.page.getByRole("dialog", {
      name: "Сообщения",
      exact: true,
    });
    await landscapeMessagesPanel.waitFor();
    await runtime.page.waitForTimeout(220);
    const landscapeMessagesGeometry = await runtime.page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(
        ".communication-center-panel",
      );
      const launcher = document.querySelector<HTMLElement>(
        ".communication-center-launcher",
      );
      if (!panel || !launcher) {
        throw new Error("Landscape messages geometry is missing");
      }
      const panelRect = panel.getBoundingClientRect();
      const launcherRect = launcher.getBoundingClientRect();
      const insideViewport = (rect: DOMRect) =>
        rect.left >= 0 &&
        rect.right <= window.innerWidth &&
        rect.top >= 0 &&
        rect.bottom <= window.innerHeight;
      return {
        gap: launcherRect.top - panelRect.bottom,
        panelInsideViewport: insideViewport(panelRect),
        launcherInsideViewport: insideViewport(launcherRect),
        noOverlap: panelRect.bottom <= launcherRect.top,
      };
    });
    assert.ok(
      Math.abs(landscapeMessagesGeometry.gap - 12) < 0.5,
      `Landscape messages panel must keep a 12px launcher gap; got ${landscapeMessagesGeometry.gap}`,
    );
    assert.equal(landscapeMessagesGeometry.panelInsideViewport, true);
    assert.equal(landscapeMessagesGeometry.launcherInsideViewport, true);
    assert.equal(landscapeMessagesGeometry.noOverlap, true);
    await runtime.page.locator(".communication-center-launcher").click();
    await landscapeMessagesPanel.waitFor({ state: "detached" });
    await runtime.page.setViewportSize({ width: 375, height: 812 });

    const portraitMessagesLauncher = runtime.page.getByRole("button", {
      name: "Открыть сообщения",
      exact: true,
    });
    await portraitMessagesLauncher.click();
    const portraitMessagesPanel = runtime.page.getByRole("dialog", {
      name: "Сообщения",
      exact: true,
    });
    await portraitMessagesPanel.waitFor();
    await runtime.page.waitForTimeout(220);
    const portraitMessagesLayering = await runtime.page.evaluate(() => {
      const layer = document.querySelector<HTMLElement>(
        ".communication-center-layer",
      );
      const panel = document.querySelector<HTMLElement>(
        ".communication-center-panel",
      );
      const topNav = document.querySelector<HTMLElement>(".course-top-nav");
      const headerShell = topNav?.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );
      if (!layer || !panel || !topNav || !headerShell) {
        throw new Error("Portrait modal layering contract is missing");
      }
      const panelRect = panel.getBoundingClientRect();
      const headerRect = headerShell.getBoundingClientRect();
      const hit = document.elementFromPoint(
        headerRect.left + headerRect.width / 2,
        headerRect.top + headerRect.height / 2,
      );
      return {
        layerZIndex: Number.parseInt(getComputedStyle(layer).zIndex, 10),
        headerZIndex: Number.parseInt(getComputedStyle(topNav).zIndex, 10),
        panelPosition: getComputedStyle(panel).position,
        ariaModal: panel.getAttribute("aria-modal"),
        panelCoversViewport:
          Math.abs(panelRect.left) < 0.5 &&
          Math.abs(panelRect.top) < 0.5 &&
          Math.abs(panelRect.right - window.innerWidth) < 0.5 &&
          Math.abs(panelRect.bottom - window.innerHeight) < 0.5,
        hitInsidePanel: hit?.closest(".communication-center-panel") === panel,
        hitInsideHeader: Boolean(hit?.closest(".course-top-nav")),
      };
    });
    assert.deepEqual(portraitMessagesLayering, {
      layerZIndex: 110,
      headerZIndex: 100,
      panelPosition: "fixed",
      ariaModal: "true",
      panelCoversViewport: true,
      hitInsidePanel: true,
      hitInsideHeader: false,
    });
    await portraitMessagesPanel
      .locator('[aria-label="Закрыть сообщения"]')
      .click();
    await portraitMessagesPanel.waitFor({ state: "detached" });

    for (const viewport of [
      { width: 320, height: 812 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
    ]) {
      await runtime.page.setViewportSize(viewport);
      const mobileFixedTopNav = await runtime.page.evaluate(async () => {
        const pageShell =
          document.querySelector<HTMLElement>(".course-demo-shell");
        const topNav = document.querySelector<HTMLElement>(".course-top-nav");
        const siteHeader = topNav?.querySelector<HTMLElement>(
          ":scope > .site-header",
        );
        const headerShell = siteHeader?.querySelector<HTMLElement>(
          ".site-header-shell-demo",
        );
        const brand =
          headerShell?.querySelector<HTMLElement>(".site-header-brand");
        const pageContent = document.querySelector<HTMLElement>(
          ".app-page-container",
        );
        if (
          !pageShell ||
          !topNav ||
          !siteHeader ||
          !headerShell ||
          !brand ||
          !pageContent
        ) {
          throw new Error("Mobile fixed TopNav contract is missing");
        }

        const settleScroll = () =>
          new Promise<void>((resolve) =>
            window.requestAnimationFrame(() =>
              window.requestAnimationFrame(() => resolve()),
            ),
          );
        const readHorizontalOverflow = () => ({
          clientWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
        });

        window.scrollTo(0, 0);
        await settleScroll();

        const spacer = document.createElement("div");
        spacer.style.height = "300vh";
        spacer.style.width = "1px";
        spacer.style.pointerEvents = "none";
        spacer.setAttribute("data-e2e-mobile-scroll-spacer", "");
        const scrollTarget = document.createElement("div");
        scrollTarget.style.position = "absolute";
        scrollTarget.style.top = "120vh";
        scrollTarget.style.width = "1px";
        scrollTarget.style.height = "1px";
        spacer.style.position = "relative";
        spacer.append(scrollTarget);
        pageShell.append(spacer);

        const topNavStyle = getComputedStyle(topNav);
        const fadeStyle = getComputedStyle(topNav, "::before");
        const siteHeaderStyle = getComputedStyle(siteHeader);
        const headerShellStyle = getComputedStyle(headerShell);
        const pageShellStyle = getComputedStyle(pageShell);
        const rootStyle = getComputedStyle(document.documentElement);
        const initialTopNavRect = topNav.getBoundingClientRect();
        const initialHeaderShellRect = headerShell.getBoundingClientRect();
        const initialPageShellRect = pageShell.getBoundingClientRect();
        const initialPageContentRect = pageContent.getBoundingClientRect();
        const brandRect = brand.getBoundingClientRect();
        const shellHitTarget = document.elementFromPoint(
          brandRect.left + brandRect.width / 2,
          brandRect.top + brandRect.height / 2,
        );

        scrollTarget.scrollIntoView({ block: "start" });
        await settleScroll();
        const programmaticTargetTop = scrollTarget.getBoundingClientRect().top;
        window.scrollTo(0, 0);
        await settleScroll();

        const moderateTarget = Math.min(
          320,
          Math.max(
            1,
            document.documentElement.scrollHeight - window.innerHeight,
          ),
        );
        window.scrollTo(0, moderateTarget);
        await settleScroll();
        const moderateTopNavRect = topNav.getBoundingClientRect();
        const moderateHeaderShellRect = headerShell.getBoundingClientRect();
        const moderatePageContentRect = pageContent.getBoundingClientRect();
        const gapHitTarget = document.elementFromPoint(
          window.innerWidth / 2,
          moderateHeaderShellRect.bottom + 6,
        );
        const moderateScrollY = window.scrollY;
        const moderateOverflow = readHorizontalOverflow();

        const scrollingElement = document.scrollingElement;
        if (!scrollingElement) {
          throw new Error("Document scrolling element is missing");
        }
        const maximumScrollY = Math.max(
          0,
          scrollingElement.scrollHeight - window.innerHeight,
        );
        window.scrollTo(0, maximumScrollY + window.innerHeight * 8);
        await settleScroll();
        const maximumTopNavRect = topNav.getBoundingClientRect();
        const clampedScrollY = window.scrollY;
        const maximumOverflow = readHorizontalOverflow();

        window.scrollTo(0, 0);
        await settleScroll();
        spacer.remove();

        return {
          viewportWidth: window.innerWidth,
          inputMode: {
            coarsePointer: matchMedia("(pointer: coarse)").matches,
            noHover: matchMedia("(hover: none)").matches,
          },
          host: {
            position: topNavStyle.position,
            top: topNavStyle.top,
            backgroundColor: topNavStyle.backgroundColor,
            backgroundImage: topNavStyle.backgroundImage,
            pointerEvents: topNavStyle.pointerEvents,
            initialTop: initialTopNavRect.top,
            moderateTop: moderateTopNavRect.top,
            maximumTop: maximumTopNavRect.top,
            height: initialTopNavRect.height,
            insideViewport:
              initialTopNavRect.left >= 0 &&
              initialTopNavRect.right <= window.innerWidth,
          },
          fade: {
            content: fadeStyle.content,
            position: fadeStyle.position,
            top: fadeStyle.top,
            right: fadeStyle.right,
            bottom: fadeStyle.bottom,
            left: fadeStyle.left,
            backgroundImage: fadeStyle.backgroundImage,
            pointerEvents: fadeStyle.pointerEvents,
          },
          whiteShell: {
            backgroundColor: headerShellStyle.backgroundColor,
            backgroundImage: headerShellStyle.backgroundImage,
            opacity: headerShellStyle.opacity,
            siteHeaderPointerEvents: siteHeaderStyle.pointerEvents,
            shellPointerEvents: headerShellStyle.pointerEvents,
            safeTopGap: initialHeaderShellRect.top - initialTopNavRect.top,
            fadeGap: initialTopNavRect.bottom - initialHeaderShellRect.bottom,
            hitTested:
              shellHitTarget === headerShell ||
              Boolean(shellHitTarget && headerShell.contains(shellHitTarget)),
          },
          flowReserve: {
            pagePaddingTop: Number.parseFloat(pageShellStyle.paddingTop),
            rootScrollPaddingTop: Number.parseFloat(rootStyle.scrollPaddingTop),
            contentTop: initialPageContentRect.top - initialPageShellRect.top,
            programmaticTargetTop,
          },
          contentUnderHeader: {
            overlapsHost:
              moderatePageContentRect.top < moderateTopNavRect.bottom &&
              moderatePageContentRect.bottom > moderateTopNavRect.top,
            gapHitInsideContent:
              gapHitTarget === pageContent ||
              Boolean(gapHitTarget && pageContent.contains(gapHitTarget)),
            gapHitInterceptedByHeader: Boolean(
              gapHitTarget && topNav.contains(gapHitTarget),
            ),
          },
          scroll: {
            moderateScrollY,
            maximumScrollY,
            clampedScrollY,
          },
          moderateOverflow,
          maximumOverflow,
        };
      });

      const viewportLabel = `${viewport.width}px mobile header`;
      assert.equal(mobileFixedTopNav.viewportWidth, viewport.width);
      assert.deepEqual(mobileFixedTopNav.inputMode, {
        coarsePointer: true,
        noHover: true,
      });
      assert.deepEqual(
        {
          position: mobileFixedTopNav.host.position,
          top: mobileFixedTopNav.host.top,
          backgroundColor: mobileFixedTopNav.host.backgroundColor,
          backgroundImage: mobileFixedTopNav.host.backgroundImage,
          pointerEvents: mobileFixedTopNav.host.pointerEvents,
          insideViewport: mobileFixedTopNav.host.insideViewport,
        },
        {
          position: "fixed",
          top: "0px",
          backgroundColor: "rgba(0, 0, 0, 0)",
          backgroundImage: "none",
          pointerEvents: "none",
          insideViewport: true,
        },
        `${viewportLabel}: transparent fixed host`,
      );
      for (const [state, top] of [
        ["initial", mobileFixedTopNav.host.initialTop],
        ["moderate scroll", mobileFixedTopNav.host.moderateTop],
        ["maximum scroll", mobileFixedTopNav.host.maximumTop],
      ] as const) {
        assert.ok(
          Math.abs(top) < 0.5,
          `${viewportLabel}: no vertical drift at ${state}; got ${top}`,
        );
      }
      assert.equal(mobileFixedTopNav.fade.content, '""');
      assert.deepEqual(
        {
          position: mobileFixedTopNav.fade.position,
          top: mobileFixedTopNav.fade.top,
          right: mobileFixedTopNav.fade.right,
          bottom: mobileFixedTopNav.fade.bottom,
          left: mobileFixedTopNav.fade.left,
          pointerEvents: mobileFixedTopNav.fade.pointerEvents,
        },
        {
          position: "absolute",
          top: "0px",
          right: "0px",
          bottom: "0px",
          left: "0px",
          pointerEvents: "none",
        },
        `${viewportLabel}: non-interactive fade layer`,
      );
      assert.match(
        mobileFixedTopNav.fade.backgroundImage,
        /^linear-gradient\(/,
        `${viewportLabel}: fade gradient`,
      );
      assert.deepEqual(
        {
          backgroundColor: mobileFixedTopNav.whiteShell.backgroundColor,
          backgroundImage: mobileFixedTopNav.whiteShell.backgroundImage,
          opacity: mobileFixedTopNav.whiteShell.opacity,
          siteHeaderPointerEvents:
            mobileFixedTopNav.whiteShell.siteHeaderPointerEvents,
          shellPointerEvents: mobileFixedTopNav.whiteShell.shellPointerEvents,
          hitTested: mobileFixedTopNav.whiteShell.hitTested,
        },
        {
          backgroundColor: "rgb(255, 255, 255)",
          backgroundImage: "none",
          opacity: "1",
          siteHeaderPointerEvents: "auto",
          shellPointerEvents: "auto",
          hitTested: true,
        },
        `${viewportLabel}: opaque interactive white shell`,
      );
      assert.ok(
        Math.abs(mobileFixedTopNav.whiteShell.safeTopGap - 12) < 0.5,
        `${viewportLabel}: 12px safe-top fallback`,
      );
      assert.ok(
        Math.abs(mobileFixedTopNav.whiteShell.fadeGap - 12) < 0.5,
        `${viewportLabel}: fade starts in the exact 12px gap below the shell`,
      );
      assert.ok(
        Math.abs(
          mobileFixedTopNav.flowReserve.pagePaddingTop -
            mobileFixedTopNav.host.height,
        ) < 0.5,
        `${viewportLabel}: page reserves the complete fixed header stack`,
      );
      assert.ok(
        Math.abs(
          mobileFixedTopNav.flowReserve.rootScrollPaddingTop -
            mobileFixedTopNav.host.height,
        ) < 0.5,
        `${viewportLabel}: document scroll padding matches the fixed header stack`,
      );
      assert.ok(
        Math.abs(
          mobileFixedTopNav.flowReserve.programmaticTargetTop -
            mobileFixedTopNav.host.height,
        ) < 0.5,
        `${viewportLabel}: programmatic scroll target stays below the fixed header`,
      );
      assert.ok(
        Math.abs(
          mobileFixedTopNav.flowReserve.contentTop -
            mobileFixedTopNav.host.height,
        ) < 0.5,
        `${viewportLabel}: content starts after the reserved header stack`,
      );
      assert.deepEqual(
        mobileFixedTopNav.contentUnderHeader,
        {
          overlapsHost: true,
          gapHitInsideContent: true,
          gapHitInterceptedByHeader: false,
        },
        `${viewportLabel}: content passes through the non-interactive fade gap`,
      );
      assert.ok(
        mobileFixedTopNav.scroll.moderateScrollY > 0,
        `${viewportLabel}: moderate scroll occurred`,
      );
      assert.ok(
        mobileFixedTopNav.scroll.maximumScrollY >
          mobileFixedTopNav.scroll.moderateScrollY,
        `${viewportLabel}: maximum scroll exceeds moderate scroll`,
      );
      assert.ok(
        Math.abs(
          mobileFixedTopNav.scroll.clampedScrollY -
            mobileFixedTopNav.scroll.maximumScrollY,
        ) < 1,
        `${viewportLabel}: extreme scroll clamps at the document end`,
      );
      for (const [state, overflow] of [
        ["moderate scroll", mobileFixedTopNav.moderateOverflow],
        ["maximum scroll", mobileFixedTopNav.maximumOverflow],
      ] as const) {
        assert.equal(
          overflow.documentScrollWidth,
          overflow.clientWidth,
          `${viewportLabel}: no document overflow at ${state}`,
        );
        assert.ok(
          overflow.bodyScrollWidth <= overflow.clientWidth,
          `${viewportLabel}: no body overflow at ${state}`,
        );
      }

      const mobileCourseVisualContract = await runtime.page.evaluate(() => {
        const header = document.querySelector<HTMLElement>(
          ".site-header-shell-demo",
        );
        const primaryAction = document.querySelector<HTMLElement>(
          ".app-page-header .app-page-actions > .product-btn",
        );
        const searchInput = document.querySelector<HTMLInputElement>(
          ".course-index-toolbar input.product-control-search",
        );
        const card = Array.from(
          document.querySelectorAll<HTMLElement>(".course-index-mobile-card"),
        ).find((candidate) => candidate.getClientRects().length > 0);
        const viewToggle = document.querySelector<HTMLElement>(
          '[role="group"][aria-label="Вид списка курсов"]',
        );
        const selectedViewOption = viewToggle?.querySelector<HTMLElement>(
          'button[aria-pressed="true"]',
        );
        const inactiveViewOption = viewToggle?.querySelector<HTMLElement>(
          'button[aria-pressed="false"]',
        );
        if (
          !header ||
          !primaryAction ||
          !searchInput ||
          !card ||
          !viewToggle ||
          !selectedViewOption ||
          !inactiveViewOption
        ) {
          throw new Error("Mobile Course white surfaces or toggle are missing");
        }
        const readOpaqueWhiteSurface = (element: HTMLElement) => {
          const style = getComputedStyle(element);
          return {
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            opacity: style.opacity,
            backdropFilter: style.backdropFilter,
          };
        };
        const groupRect = viewToggle.getBoundingClientRect();
        const groupStyle = getComputedStyle(viewToggle);
        const selectedStyle = getComputedStyle(selectedViewOption);
        const inactiveStyle = getComputedStyle(inactiveViewOption);
        const viewIndicator = viewToggle.querySelector<HTMLElement>(
          ".product-segmented-control-indicator",
        );
        if (!viewIndicator) {
          throw new Error("Mobile Course view indicator is missing");
        }
        const viewIndicatorStyle = getComputedStyle(viewIndicator);
        const viewIndicatorRect = viewIndicator.getBoundingClientRect();
        const selectedViewRect = selectedViewOption.getBoundingClientRect();
        const options = Array.from(
          viewToggle.querySelectorAll<HTMLElement>("button"),
        );
        const optionRects = options.map((button) =>
          button.getBoundingClientRect(),
        );
        const readSurface = (element: HTMLElement) => {
          const style = getComputedStyle(element);
          return {
            borderTopWidth: style.borderTopWidth,
            borderTopStyle: style.borderTopStyle,
            borderTopColor: style.borderTopColor,
            borderRadius: style.borderRadius,
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            backgroundClip: style.backgroundClip,
            boxShadow: style.boxShadow,
          };
        };
        const readGlyph = (icon: SVGElement) => {
          const rect = icon.getBoundingClientRect();
          const strokePart = icon.querySelector<SVGElement>(
            "path, line, polyline, polygon, circle, ellipse, rect",
          );
          const strokeStyle = getComputedStyle(strokePart ?? icon);
          return {
            width: rect.width,
            height: rect.height,
            strokeWidth: strokeStyle.strokeWidth,
            vectorEffect: strokeStyle.vectorEffect,
          };
        };
        return {
          whiteSurfaces: {
            header: readOpaqueWhiteSurface(header),
            primaryAction: readOpaqueWhiteSurface(primaryAction),
            searchInput: readOpaqueWhiteSurface(searchInput),
            card: readOpaqueWhiteSurface(card),
          },
          viewToggle: {
            group: {
              width: groupRect.width,
              height: groupRect.height,
              padding: groupStyle.padding,
              gap: groupStyle.gap,
              borderTopWidth: groupStyle.borderTopWidth,
              borderTopStyle: groupStyle.borderTopStyle,
              borderTopColor: groupStyle.borderTopColor,
              borderRadius: groupStyle.borderRadius,
              backgroundColor: groupStyle.backgroundColor,
              backgroundClip: groupStyle.backgroundClip,
              boxShadow: groupStyle.boxShadow,
            },
            groupIndicatorReady: viewToggle.getAttribute(
              "data-indicator-ready",
            ),
            groupBeforeContent: getComputedStyle(viewToggle, "::before")
              .content,
            indicatorCount: viewToggle.querySelectorAll(
              ".product-segmented-control-indicator",
            ).length,
            indicator: {
              surface: readSurface(viewIndicator),
              width: viewIndicatorRect.width,
              height: viewIndicatorRect.height,
              opacity: viewIndicatorStyle.opacity,
              display: viewIndicatorStyle.display,
              pointerEvents: viewIndicatorStyle.pointerEvents,
              backdropFilter: viewIndicatorStyle.backdropFilter,
              zIndex: viewIndicatorStyle.zIndex,
              ariaHidden: viewIndicator.getAttribute("aria-hidden"),
              ready: viewIndicator.getAttribute("data-ready"),
              motionReady: viewIndicator.getAttribute("data-motion-ready"),
              transitionProperty: viewIndicatorStyle.transitionProperty,
              transitionDuration: viewIndicatorStyle.transitionDuration,
              transitionTimingFunction:
                viewIndicatorStyle.transitionTimingFunction,
              selectedStartDelta: Math.abs(
                viewIndicatorRect.left - selectedViewRect.left,
              ),
              selectedTopDelta: Math.abs(
                viewIndicatorRect.top - selectedViewRect.top,
              ),
              selectedWidthDelta: Math.abs(
                viewIndicatorRect.width - selectedViewRect.width,
              ),
              selectedHeightDelta: Math.abs(
                viewIndicatorRect.height - selectedViewRect.height,
              ),
            },
            optionWidths: optionRects.map((rect) => rect.width),
            optionHeights: optionRects.map((rect) => rect.height),
            seamGaps: optionRects
              .slice(1)
              .map((rect, index) =>
                Number((rect.left - optionRects[index]!.right).toFixed(3)),
              ),
            optionRadii: options.map(
              (button) => getComputedStyle(button).borderRadius,
            ),
            iconStyles: Array.from(
              viewToggle.querySelectorAll<SVGElement>("button svg.lucide"),
            ).map(readGlyph),
            referenceButton: readSurface(primaryAction),
            selected: {
              surface: readSurface(selectedViewOption),
              transform: selectedStyle.transform,
              beforeContent: getComputedStyle(selectedViewOption, "::before")
                .content,
            },
            inactive: {
              borderTopWidth: inactiveStyle.borderTopWidth,
              borderTopStyle: inactiveStyle.borderTopStyle,
              backgroundColor: inactiveStyle.backgroundColor,
              backgroundImage: inactiveStyle.backgroundImage,
              boxShadow: inactiveStyle.boxShadow,
              transform: inactiveStyle.transform,
              beforeContent: getComputedStyle(inactiveViewOption, "::before")
                .content,
            },
          },
        };
      });
      for (const [surfaceName, surface] of Object.entries(
        mobileCourseVisualContract.whiteSurfaces,
      )) {
        assertOpaqueWhiteSurface(
          surface,
          `${viewport.width}px Course ${surfaceName}`,
        );
      }
      assertTouchSegmentedControl(
        mobileCourseVisualContract.viewToggle,
        `${viewport.width}px Course view toggle`,
      );
    }

    const courseViewGroup = runtime.page.getByRole("group", {
      name: "Вид списка курсов",
      exact: true,
    });
    const initialCourseViewName =
      (await courseViewGroup
        .locator('button[aria-pressed="true"]')
        .getAttribute("aria-label")) ?? "";
    const alternateCourseViewName =
      initialCourseViewName === "Показать таблицей"
        ? "Показать карточками"
        : "Показать таблицей";
    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Вид списка курсов",
      optionName: alternateCourseViewName,
      label: "Courses mobile view motion at 390px",
    });
    await activateSegmentedOptionWithMotion(runtime.page, {
      groupName: "Вид списка курсов",
      optionName: initialCourseViewName,
      label: "Courses mobile view return at 390px",
    });

    await runtime.page.setViewportSize({ width: 375, height: 812 });
    await runtime.page.emulateMedia({ forcedColors: "active" });
    try {
      // The shared option uses the Tailwind transition utility, so let the
      // forced-color system pair settle before reading the final rendered
      // contrast contract.
      await runtime.page.waitForTimeout(250);
      const forcedColorsToggle = await runtime.page.evaluate(() => {
        const group = document.querySelector<HTMLElement>(
          '[role="group"][aria-label="Вид списка курсов"]',
        );
        const selected = group?.querySelector<HTMLElement>(
          'button[aria-pressed="true"]',
        );
        const inactive = group?.querySelector<HTMLElement>(
          'button[aria-pressed="false"]',
        );
        const indicator = group?.querySelector<HTMLElement>(
          ".product-segmented-control-indicator",
        );
        if (!group || !selected || !inactive || !indicator) {
          throw new Error("Forced-colors Course toggle is missing");
        }

        const systemProbe = document.createElement("div");
        systemProbe.style.position = "fixed";
        systemProbe.style.left = "-9999px";
        systemProbe.style.background = "ButtonFace";
        systemProbe.style.color = "ButtonText";
        systemProbe.style.outline = "1px solid CanvasText";
        const highlightProbe = document.createElement("div");
        highlightProbe.style.position = "fixed";
        highlightProbe.style.left = "-9999px";
        highlightProbe.style.background = "Highlight";
        highlightProbe.style.color = "HighlightText";
        document.body.append(systemProbe, highlightProbe);

        const groupStyle = getComputedStyle(group);
        const groupRect = group.getBoundingClientRect();
        const groupBeforeStyle = getComputedStyle(group, "::before");
        const selectedStyle = getComputedStyle(selected);
        const selectedGlyph = selected.querySelector<HTMLElement>("svg, span");
        const selectedBeforeStyle = getComputedStyle(selected, "::before");
        const inactiveStyle = getComputedStyle(inactive);
        const selectedRect = selected.getBoundingClientRect();
        const inactiveRect = inactive.getBoundingClientRect();
        const systemStyle = getComputedStyle(systemProbe);
        const highlightStyle = getComputedStyle(highlightProbe);
        const contract = {
          mediaMatches: matchMedia("(forced-colors: active)").matches,
          system: {
            buttonFace: systemStyle.backgroundColor,
            buttonText: systemStyle.color,
            canvasText: systemStyle.outlineColor,
            highlight: highlightStyle.backgroundColor,
            highlightText: highlightStyle.color,
          },
          group: {
            width: groupRect.width,
            height: groupRect.height,
            padding: groupStyle.padding,
            gap: groupStyle.gap,
            borderTopWidth: groupStyle.borderTopWidth,
            borderTopStyle: groupStyle.borderTopStyle,
            borderTopColor: groupStyle.borderTopColor,
            outlineStyle: groupStyle.outlineStyle,
            outlineWidth: groupStyle.outlineWidth,
            outlineColor: groupStyle.outlineColor,
            outlineOffset: groupStyle.outlineOffset,
            backgroundColor: groupStyle.backgroundColor,
            backgroundClip: groupStyle.backgroundClip,
            beforeContent: groupBeforeStyle.content,
            indicatorReady: group.getAttribute("data-indicator-ready"),
            indicatorCount: group.querySelectorAll(
              ".product-segmented-control-indicator",
            ).length,
          },
          indicator: {
            ariaHidden: indicator.getAttribute("aria-hidden"),
            display: getComputedStyle(indicator).display,
            clientRectCount: indicator.getClientRects().length,
            pointerEvents: getComputedStyle(indicator).pointerEvents,
          },
          inactive: {
            width: inactiveRect.width,
            height: inactiveRect.height,
            color: inactiveStyle.color,
            fontWeight: inactiveStyle.fontWeight,
            backgroundColor: inactiveStyle.backgroundColor,
            boxShadow: inactiveStyle.boxShadow,
            transform: inactiveStyle.transform,
          },
          selected: {
            width: selectedRect.width,
            height: selectedRect.height,
            color: selectedStyle.color,
            fontWeight: selectedStyle.fontWeight,
            glyphColor: selectedGlyph
              ? getComputedStyle(selectedGlyph).color
              : null,
            transform: selectedStyle.transform,
            backgroundColor: selectedStyle.backgroundColor,
            borderTopWidth: selectedStyle.borderTopWidth,
            borderTopStyle: selectedStyle.borderTopStyle,
            borderTopColor: selectedStyle.borderTopColor,
            borderRadius: selectedStyle.borderRadius,
            boxShadow: selectedStyle.boxShadow,
            beforeContent: selectedBeforeStyle.content,
          },
        };
        systemProbe.remove();
        highlightProbe.remove();
        return contract;
      });

      assert.equal(forcedColorsToggle.mediaMatches, true);
      assert.deepEqual(forcedColorsToggle.group, {
        width: 80,
        height: 40,
        padding: "0px",
        gap: "2px",
        borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
        borderTopStyle: "solid",
        borderTopColor: forcedColorsToggle.system.canvasText,
        outlineStyle: "none",
        outlineWidth: "0px",
        outlineColor: "rgb(20, 20, 20)",
        outlineOffset: "0px",
        backgroundColor: forcedColorsToggle.system.buttonFace,
        backgroundClip: "border-box",
        beforeContent: "none",
        indicatorReady: "true",
        indicatorCount: 1,
      });
      assert.deepEqual(forcedColorsToggle.indicator, {
        ariaHidden: "true",
        display: "none",
        clientRectCount: 0,
        pointerEvents: "none",
      });
      assert.deepEqual(forcedColorsToggle.inactive, {
        width: 38,
        height: 38,
        color: forcedColorsToggle.system.buttonText,
        fontWeight: "400",
        backgroundColor: "rgba(0, 0, 0, 0)",
        boxShadow: "none",
        transform: "none",
      });
      assert.notEqual(
        forcedColorsToggle.inactive.color,
        forcedColorsToggle.group.backgroundColor,
        "Forced-colors inactive glyph must contrast with the toggle track",
      );
      assert.deepEqual(forcedColorsToggle.selected, {
        width: 38,
        height: 38,
        color: forcedColorsToggle.system.highlightText,
        fontWeight: "400",
        glyphColor: forcedColorsToggle.system.highlightText,
        transform: "none",
        backgroundColor: forcedColorsToggle.system.highlight,
        borderTopWidth: E2E_PRODUCT_SURFACE_BORDER_WIDTH,
        borderTopStyle: "solid",
        borderTopColor: forcedColorsToggle.system.highlight,
        borderRadius: "11px",
        boxShadow: "none",
        beforeContent: "none",
      });

      await runtime.page.keyboard.press("Tab");
      await runtime.page.evaluate(() => {
        const selected = document.querySelector<HTMLButtonElement>(
          '[role="group"][aria-label="Вид списка курсов"] button[aria-pressed="true"]',
        );
        if (!selected) {
          throw new Error("Selected forced-colors Course option is missing");
        }
        selected.focus();
      });
      await runtime.page.waitForTimeout(250);
      const focusedSelectedContract = await runtime.page.evaluate(() => {
        const selected = document.querySelector<HTMLButtonElement>(
          '[role="group"][aria-label="Вид списка курсов"] button[aria-pressed="true"]',
        );
        if (!selected) {
          throw new Error("Focused forced-colors Course option is missing");
        }
        const style = getComputedStyle(selected);
        return {
          isActiveElement: document.activeElement === selected,
          isFocusVisible: selected.matches(":focus-visible"),
          outlineColor: style.outlineColor,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        };
      });
      assert.deepEqual(focusedSelectedContract, {
        isActiveElement: true,
        isFocusVisible: true,
        outlineColor: forcedColorsToggle.system.highlightText,
        outlineStyle: "solid",
        outlineWidth: "2px",
      });
    } finally {
      await runtime.page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      });
      await runtime.page.emulateMedia({ forcedColors: "none" });
    }

    await runtime.page
      .getByRole("tab", { name: "Каталог", exact: true })
      .click();
    await runtime.page.waitForURL(/\/courses\?tab=catalog$/);
    const mobileCatalogView = runtime.page.getByRole("group", {
      name: "Вид каталога курсов",
      exact: true,
    });
    await mobileCatalogView.waitFor();
    await runtime.page
      .getByRole("group", { name: "Направление обучения", exact: true })
      .getByRole("button", { name: "Обучение педагогов", exact: true })
      .click();
    await runtime.page.waitForURL(/\/courses\?tab=catalog&audience=educators$/);
    await runtime.page
      .locator('[role="tabpanel"]:not([hidden]) .course-index-mobile-list')
      .waitFor();
    const mobileCatalogToolbar = await runtime.page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(
        ".course-catalog-toolbar",
      );
      const search = toolbar?.querySelector<HTMLElement>(
        ".compact-toolbar-search",
      );
      const searchInput = search?.querySelector<HTMLInputElement>(
        "input.product-control-search",
      );
      const rail = toolbar?.querySelector<HTMLElement>(".compact-toolbar-rail");
      const viewSwitch = toolbar?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Вид каталога курсов"]',
      );
      const audience = rail?.querySelector<HTMLElement>(
        ".course-catalog-audience-control",
      );
      const audienceSwitch = audience?.querySelector<HTMLElement>(
        ".product-segmented-control",
      );
      const catalogSection = toolbar?.closest<HTMLElement>("section");
      const mobileList = catalogSection?.querySelector<HTMLElement>(
        ".course-index-mobile-list",
      );
      const wideTableWrap = catalogSection?.querySelector<HTMLElement>(
        ".course-index-table-wrap",
      );
      if (
        !toolbar ||
        !search ||
        !searchInput ||
        !rail ||
        !viewSwitch ||
        !audience ||
        !audienceSwitch ||
        !mobileList ||
        !wideTableWrap
      ) {
        throw new Error("Mobile Catalog toolbar controls are missing");
      }
      const viewportWidth = document.documentElement.clientWidth;
      const rect = toolbar.getBoundingClientRect();
      const style = getComputedStyle(toolbar);
      const searchRect = search.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const audienceRect = audience.getBoundingClientRect();
      const mobileListRect = mobileList.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        insideViewport: rect.left >= 0 && rect.right <= viewportWidth,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        searchStartInset: searchRect.left - rect.left,
        railEndInset: rect.right - railRect.right,
        audienceInsideViewport:
          audienceRect.left >= 0 && audienceRect.right <= viewportWidth,
        audienceInsideRail:
          audienceRect.left >= railRect.left &&
          audienceRect.right <= railRect.right,
        searchBeforeRail: Boolean(
          search.compareDocumentPosition(rail) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        audienceBeforeView: Boolean(
          audience.compareDocumentPosition(viewSwitch) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        shellHeight: getComputedStyle(viewSwitch).height,
        shellPadding: getComputedStyle(viewSwitch).padding,
        shellGap: getComputedStyle(viewSwitch).gap,
        shellBorderTopWidth: getComputedStyle(viewSwitch).borderTopWidth,
        shellBorderTopStyle: getComputedStyle(viewSwitch).borderTopStyle,
        shellBorderTopColor: getComputedStyle(viewSwitch).borderTopColor,
        shellBackgroundClip: getComputedStyle(viewSwitch).backgroundClip,
        shellWidth: viewSwitch.getBoundingClientRect().width,
        shellBeforeContent: getComputedStyle(viewSwitch, "::before").content,
        viewButtonHeights: Array.from(
          viewSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => button.getBoundingClientRect().height),
        viewButtonWidths: Array.from(
          viewSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => button.getBoundingClientRect().width),
        viewButtonFontSizes: Array.from(
          viewSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => getComputedStyle(button).fontSize),
        viewIconSizes: Array.from(
          viewSwitch.querySelectorAll<SVGElement>("button svg"),
        ).map((icon) => {
          const rect = icon.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
        audienceShellHeight: getComputedStyle(audienceSwitch).height,
        audienceShellWidth: audienceSwitch.getBoundingClientRect().width,
        audienceShellPadding: getComputedStyle(audienceSwitch).padding,
        audienceShellGap: getComputedStyle(audienceSwitch).gap,
        audienceShellBorderTopWidth:
          getComputedStyle(audienceSwitch).borderTopWidth,
        audienceShellBorderTopStyle:
          getComputedStyle(audienceSwitch).borderTopStyle,
        audienceShellBorderTopColor:
          getComputedStyle(audienceSwitch).borderTopColor,
        audienceShellBackgroundClip:
          getComputedStyle(audienceSwitch).backgroundClip,
        audienceShellBeforeContent: getComputedStyle(audienceSwitch, "::before")
          .content,
        audienceButtonHeights: Array.from(
          audienceSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => button.getBoundingClientRect().height),
        audienceButtonFontSizes: Array.from(
          audienceSwitch.querySelectorAll<HTMLElement>("button"),
        ).map((button) => getComputedStyle(button).fontSize),
        searchHeight: searchInput.getBoundingClientRect().height,
        searchFontSize: getComputedStyle(searchInput).fontSize,
        mobileProjection: {
          listDisplay: getComputedStyle(mobileList).display,
          listVisible: mobileList.getClientRects().length > 0,
          listInsideViewport:
            mobileListRect.left >= 0 && mobileListRect.right <= viewportWidth,
          visibleCardCount: Array.from(mobileList.children).filter(
            (child) =>
              child instanceof HTMLElement && child.getClientRects().length > 0,
          ).length,
          wideTableDisplay: getComputedStyle(wideTableWrap).display,
          wideTableVisible: wideTableWrap.getClientRects().length > 0,
        },
        filterCount: toolbar.querySelectorAll(".course-filter-menu").length,
        nativeSelectCount: toolbar.querySelectorAll("select").length,
        visibleResultCount: toolbar.querySelectorAll(".compact-toolbar-result")
          .length,
      };
    });
    assert.deepEqual(
      {
        scrollWidth: mobileCatalogToolbar.scrollWidth,
        insideViewport: mobileCatalogToolbar.insideViewport,
        paddingLeft: mobileCatalogToolbar.paddingLeft,
        paddingRight: mobileCatalogToolbar.paddingRight,
        searchStartInset: mobileCatalogToolbar.searchStartInset,
        railEndInset: mobileCatalogToolbar.railEndInset,
        audienceInsideViewport: mobileCatalogToolbar.audienceInsideViewport,
        audienceInsideRail: mobileCatalogToolbar.audienceInsideRail,
        searchBeforeRail: mobileCatalogToolbar.searchBeforeRail,
        audienceBeforeView: mobileCatalogToolbar.audienceBeforeView,
        filterCount: mobileCatalogToolbar.filterCount,
        nativeSelectCount: mobileCatalogToolbar.nativeSelectCount,
        visibleResultCount: mobileCatalogToolbar.visibleResultCount,
      },
      {
        scrollWidth: 375,
        insideViewport: true,
        paddingLeft: "0px",
        paddingRight: "0px",
        searchStartInset: 0,
        railEndInset: 0,
        audienceInsideViewport: true,
        audienceInsideRail: true,
        searchBeforeRail: true,
        audienceBeforeView: true,
        filterCount: 0,
        nativeSelectCount: 0,
        visibleResultCount: 0,
      },
    );
    assert.equal(mobileCatalogToolbar.shellHeight, "40px");
    assert.equal(mobileCatalogToolbar.shellPadding, "0px");
    assert.equal(mobileCatalogToolbar.shellGap, "2px");
    assert.equal(
      mobileCatalogToolbar.shellBorderTopWidth,
      E2E_PRODUCT_SURFACE_BORDER_WIDTH,
    );
    assert.equal(mobileCatalogToolbar.shellBorderTopStyle, "solid");
    assert.equal(
      mobileCatalogToolbar.shellBorderTopColor,
      E2E_PRODUCT_SURFACE_BORDER_COLOR,
    );
    assert.equal(
      mobileCatalogToolbar.shellBackgroundClip,
      E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
    );
    assert.equal(mobileCatalogToolbar.shellWidth, 80);
    assert.equal(mobileCatalogToolbar.shellBeforeContent, "none");
    assert.deepEqual(mobileCatalogToolbar.viewButtonHeights, [38, 38]);
    assert.deepEqual(mobileCatalogToolbar.viewButtonWidths, [38, 38]);
    assert.deepEqual(mobileCatalogToolbar.viewButtonFontSizes, [
      "14.08px",
      "14.08px",
    ]);
    assert.deepEqual(mobileCatalogToolbar.viewIconSizes, [
      { width: 16, height: 16 },
      { width: 16, height: 16 },
    ]);
    assert.equal(mobileCatalogToolbar.audienceShellHeight, "40px");
    assert.ok(mobileCatalogToolbar.audienceShellWidth > 80);
    assert.equal(mobileCatalogToolbar.audienceShellPadding, "0px");
    assert.equal(mobileCatalogToolbar.audienceShellGap, "2px");
    assert.equal(
      mobileCatalogToolbar.audienceShellBorderTopWidth,
      E2E_PRODUCT_SURFACE_BORDER_WIDTH,
    );
    assert.equal(mobileCatalogToolbar.audienceShellBorderTopStyle, "solid");
    assert.equal(
      mobileCatalogToolbar.audienceShellBorderTopColor,
      E2E_PRODUCT_SURFACE_BORDER_COLOR,
    );
    assert.equal(
      mobileCatalogToolbar.audienceShellBackgroundClip,
      E2E_PRODUCT_SURFACE_BACKGROUND_CLIP,
    );
    assert.equal(mobileCatalogToolbar.audienceShellBeforeContent, "none");
    assert.deepEqual(mobileCatalogToolbar.audienceButtonHeights, [38, 38]);
    assert.deepEqual(mobileCatalogToolbar.audienceButtonFontSizes, [
      "14.08px",
      "14.08px",
    ]);
    assert.equal(mobileCatalogToolbar.searchHeight, 40);
    assert.equal(mobileCatalogToolbar.searchFontSize, "16px");
    assert.notEqual(mobileCatalogToolbar.mobileProjection.listDisplay, "none");
    assert.equal(mobileCatalogToolbar.mobileProjection.listVisible, true);
    assert.equal(
      mobileCatalogToolbar.mobileProjection.listInsideViewport,
      true,
    );
    assert.ok(mobileCatalogToolbar.mobileProjection.visibleCardCount > 0);
    assert.equal(
      mobileCatalogToolbar.mobileProjection.wideTableDisplay,
      "none",
    );
    assert.equal(mobileCatalogToolbar.mobileProjection.wideTableVisible, false);
    await mobileCatalogView
      .getByRole("button", { name: "Показать таблицей", exact: true })
      .click();
    assert.equal(
      await mobileCatalogView
        .getByRole("button", { name: "Показать таблицей", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );

    await runtime.page.getByRole("tab", { name: "Мои", exact: true }).click();
    await runtime.page.waitForURL(/\/courses$/);
    await mobileCourseLink.waitFor();

    await Promise.all([
      runtime.page.waitForURL(new RegExp(`/courses/${E2E_COURSE_ID}$`)),
      mobileCourseLink.click(),
    ]);
    await runtime.page
      .getByRole("heading", {
        name: E2E_COURSE_TITLE,
        exact: true,
        level: 1,
      })
      .waitFor();
    await runtime.page
      .locator("html[data-page-transition-direction]")
      .waitFor({ state: "detached" });
    const mobileCourseLessons = await runtime.page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(
        ".course-lessons-toolbar",
      );
      const wrapper = document.querySelector<HTMLElement>(
        ".course-lessons-table-wrap",
      );
      const addButton = toolbar?.querySelector<HTMLElement>(".product-btn");
      const searchInput = toolbar?.querySelector<HTMLInputElement>(
        "input.product-control-search",
      );
      if (!toolbar || !wrapper || !addButton || !searchInput) {
        throw new Error("Mobile Course Lessons controls are missing");
      }
      const viewportWidth = document.documentElement.clientWidth;
      const toolbarRect = toolbar.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const toolbarStyle = getComputedStyle(toolbar);
      return {
        documentClientWidth: viewportWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        toolbarInsideViewport:
          toolbarRect.left >= 0 && toolbarRect.right <= viewportWidth,
        wrapperInsideViewport:
          wrapperRect.left >= 0 && wrapperRect.right <= viewportWidth,
        toolbarPaddingLeft: toolbarStyle.paddingLeft,
        toolbarPaddingRight: toolbarStyle.paddingRight,
        addButtonHeight: getComputedStyle(addButton).height,
        addButtonFontSize: getComputedStyle(addButton).fontSize,
        searchHeight: searchInput.getBoundingClientRect().height,
        searchFontSize: getComputedStyle(searchInput).fontSize,
        wrapperOverflowX: getComputedStyle(wrapper).overflowX,
        wrapperClientWidth: wrapper.clientWidth,
        wrapperScrollWidth: wrapper.scrollWidth,
      };
    });
    assert.deepEqual(
      {
        documentClientWidth: mobileCourseLessons.documentClientWidth,
        documentScrollWidth: mobileCourseLessons.documentScrollWidth,
        toolbarInsideViewport: mobileCourseLessons.toolbarInsideViewport,
        wrapperInsideViewport: mobileCourseLessons.wrapperInsideViewport,
        toolbarPaddingLeft: mobileCourseLessons.toolbarPaddingLeft,
        toolbarPaddingRight: mobileCourseLessons.toolbarPaddingRight,
        addButtonHeight: mobileCourseLessons.addButtonHeight,
        addButtonFontSize: mobileCourseLessons.addButtonFontSize,
        searchHeight: mobileCourseLessons.searchHeight,
        searchFontSize: mobileCourseLessons.searchFontSize,
        wrapperOverflowX: mobileCourseLessons.wrapperOverflowX,
      },
      {
        documentClientWidth: 375,
        documentScrollWidth: 375,
        toolbarInsideViewport: true,
        wrapperInsideViewport: true,
        toolbarPaddingLeft: "0px",
        toolbarPaddingRight: "0px",
        addButtonHeight: "40px",
        addButtonFontSize: "14.08px",
        searchHeight: 40,
        searchFontSize: "16px",
        wrapperOverflowX: "auto",
      },
    );
    assert.ok(
      mobileCourseLessons.wrapperScrollWidth >
        mobileCourseLessons.wrapperClientWidth,
    );
    await runtime.page
      .getByRole("button", { name: E2E_LESSON_TITLE, exact: true })
      .click();
    await runtime.page
      .getByRole("heading", {
        name: `Урок 4. ${E2E_LESSON_TITLE}`,
        exact: true,
        level: 1,
      })
      .waitFor();
    const authoredExercise = runtime.page.locator(
      '[data-course-component-type="fill_blanks"]',
    );
    await authoredExercise.waitFor();
    const authoredExerciseInputs = authoredExercise.getByRole("textbox");
    assert.equal(await authoredExerciseInputs.count(), 2);
    await runtime.page.setViewportSize({ width: 320, height: 812 });
    const lessonEditableContract = await readMobileEditableContract(
      runtime.page,
    );
    assertMobileEditableContract(
      lessonEditableContract,
      320,
      "Lesson authored exercise at 320px",
    );
    assert.ok(
      lessonEditableContract.controls.some(
        (control) =>
          control.ordinaryProductEditable &&
          Math.abs(control.fontSize - 16) < 0.02,
      ),
      "Lesson shell must retain the 16px Safari anti-zoom floor on ordinary product editables",
    );
    assert.equal(
      lessonEditableContract.controls.filter(
        (control) => control.rawAuthoredExercise,
      ).length,
      2,
    );
    const authoredExerciseInputContract = await authoredExercise.evaluate(
      (component) =>
        Array.from(
          component.querySelectorAll<HTMLInputElement>('input[type="text"]'),
        ).map((input) => ({
          fontSize: getComputedStyle(input).fontSize,
          insideCourseDemoShell: Boolean(input.closest(".course-demo-shell")),
          hasProductEditableClass: input.matches(
            ".product-control, .field-input",
          ),
        })),
    );
    assert.deepEqual(authoredExerciseInputContract, [
      {
        fontSize: "16px",
        insideCourseDemoShell: true,
        hasProductEditableClass: false,
      },
      {
        fontSize: "16px",
        insideCourseDemoShell: true,
        hasProductEditableClass: false,
      },
    ]);
    await authoredExercise
      .getByRole("textbox", { name: "Пропуск 1", exact: true })
      .waitFor();
    await authoredExercise
      .getByRole("textbox", { name: "Пропуск 2", exact: true })
      .waitFor();
    await runtime.page.setViewportSize({ width: 375, height: 812 });
    const mobileFileComponentEdit = runtime.page.getByRole("button", {
      name: "Редактировать «Файл»",
      exact: true,
    });
    await mobileFileComponentEdit.waitFor();
    await mobileFileComponentEdit.click();
    const mobileFileComponentDialog = runtime.page.getByRole("dialog", {
      name: "1. Файл",
      exact: true,
    });
    await mobileFileComponentDialog.waitFor();
    const mobileRawFieldContract = await mobileFileComponentDialog.evaluate(
      (dialog) => {
        const selects = Array.from(
          dialog.querySelectorAll<HTMLSelectElement>(
            "select.field-input:not([multiple])",
          ),
        ).filter((select) => select.getClientRects().length > 0);
        const textareas = Array.from(
          dialog.querySelectorAll<HTMLTextAreaElement>("textarea.field-input"),
        ).filter((textarea) => textarea.getClientRects().length > 0);
        return {
          selects: selects.map((select) => ({
            height: select.getBoundingClientRect().height,
            fontSize: getComputedStyle(select).fontSize,
          })),
          textareas: textareas.map((textarea) => ({
            height: textarea.getBoundingClientRect().height,
            fontSize: getComputedStyle(textarea).fontSize,
          })),
          documentClientWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
        };
      },
    );
    assert.ok(
      mobileRawFieldContract.selects.length >= 2,
      "Mobile File editor must expose its raw select.field-input consumers",
    );
    assert.ok(
      mobileRawFieldContract.selects.every(
        ({ height, fontSize }) => height === 40 && fontSize === "16px",
      ),
      "Every mobile raw select.field-input must be exactly 40px tall with a 16px anti-zoom font",
    );
    assert.ok(
      mobileRawFieldContract.textareas.length > 0 &&
        mobileRawFieldContract.textareas.every(
          ({ height, fontSize }) => height > 40 && fontSize === "16px",
        ),
      "Mobile textarea.field-input must retain its flexible multi-line height and 16px anti-zoom font",
    );
    assert.equal(
      mobileRawFieldContract.documentScrollWidth,
      mobileRawFieldContract.documentClientWidth,
    );
    await mobileFileComponentDialog
      .getByRole("button", { name: "Отмена", exact: true })
      .click();
    await mobileFileComponentDialog.waitFor({ state: "detached" });
    await runtime.page
      .getByRole("tab", { name: "План", exact: true })
      .press("End");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await runtime.page.getByRole("tab", { name: /^История/ }).waitFor();

    const mobileVisual = await runtime.page.evaluate(() => {
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeaderContent = pageHeader?.querySelector<HTMLElement>(
        ".app-page-header-content",
      );
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
      const titleRow = pageHeading?.querySelector<HTMLElement>(
        ".app-page-title-row",
      );
      const title = pageHeader?.querySelector<HTMLElement>(".app-page-title");
      const description = pageHeader?.querySelector<HTMLElement>(
        ".app-page-description",
      );
      const backLink = pageHeader?.querySelector<HTMLElement>(
        ".app-page-back-link",
      );
      const backIcon = backLink?.querySelector<HTMLElement>(
        ".app-page-back-link-icon",
      );
      const backLabel = backLink?.querySelector<HTMLElement>(
        ".app-page-back-link-label",
      );
      const actions =
        pageHeader?.querySelector<HTMLElement>(".app-page-actions");
      const header = document.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );
      const tabStrip = document.querySelector<HTMLElement>(
        ".workspace-tabs-scroll",
      );
      const tabs = tabStrip?.querySelector<HTMLElement>(".workspace-tabs");
      const selectedTab = document.querySelector<HTMLElement>(
        '.workspace-tab[aria-selected="true"]',
      );

      if (
        !pageHeader ||
        !pageHeaderContent ||
        !pageHeading ||
        !titleRow ||
        !title ||
        !description ||
        !backLink ||
        !backIcon ||
        !backLabel ||
        !actions ||
        !header ||
        !tabStrip ||
        !tabs ||
        !selectedTab
      ) {
        throw new Error("Mobile Course visual contract elements are missing");
      }

      const originalBackLabel = backLabel.textContent;
      backLabel.textContent = "МобильныйКурсБезПробелов".repeat(20);

      const titleStyle = getComputedStyle(title);
      const titleRowStyle = getComputedStyle(titleRow);
      const pageHeadingStyle = getComputedStyle(pageHeading);
      const backLinkStyle = getComputedStyle(backLink);
      const backIconStyle = getComputedStyle(backIcon);
      const backLabelStyle = getComputedStyle(backLabel);
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const pageHeadingRect = pageHeading.getBoundingClientRect();
      const titleRowRect = titleRow.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const backLinkRect = backLink.getBoundingClientRect();
      const backLabelRect = backLabel.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      const actionControlRects = Array.from(
        actions.querySelectorAll<HTMLElement>(".product-btn"),
      ).map((control) => control.getBoundingClientRect());
      const actionControlFontSizes = Array.from(
        actions.querySelectorAll<HTMLElement>(".product-btn"),
      ).map((control) => getComputedStyle(control).fontSize);
      const actionsContentWidth = actionControlRects.length
        ? Math.max(...actionControlRects.map((rect) => rect.right)) -
          Math.min(...actionControlRects.map((rect) => rect.left))
        : 0;
      const tabStripRect = tabStrip.getBoundingClientRect();
      const selectedTabRect = selectedTab.getBoundingClientRect();
      const baselineStyle = getComputedStyle(tabs, "::before");
      const baselineScaleY = new DOMMatrixReadOnly(baselineStyle.transform).m22;

      const contract = {
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        headerLeft: headerRect.left,
        headerRight: headerRect.right,
        titleLeft: titleRect.left,
        titleRight: titleRect.right,
        titleFontSize: titleStyle.fontSize,
        titleFontWeight: titleStyle.fontWeight,
        pageHeader: {
          actionsInsideViewport:
            actionsRect.left >= 0 &&
            actionsRect.right <= document.documentElement.clientWidth,
          actionsFitContentDelta: Math.abs(
            actionsRect.width - actionsContentWidth,
          ),
          actionControlFontSizes,
          actionsWrappedBelowTitle: actionsRect.top >= titleRect.bottom - 0.5,
          actionStackGapDelta: Math.abs(
            actionsRect.top -
              titleRect.bottom -
              Number.parseFloat(titleRowStyle.rowGap),
          ),
          metricBelowActions: descriptionRect.top >= actionsRect.bottom - 0.5,
          metricGapDelta: Math.abs(
            descriptionRect.top -
              titleRowRect.bottom -
              Number.parseFloat(pageHeadingStyle.rowGap),
          ),
          backColor: backLinkStyle.color,
          backIconColor: backIconStyle.color,
          backIconFlexShrink: backIconStyle.flexShrink,
          backLabelOverflow: backLabelStyle.overflow,
          backLabelTextOverflow: backLabelStyle.textOverflow,
          backLabelWhiteSpace: backLabelStyle.whiteSpace,
          backLabelIsClipped: backLabel.scrollWidth > backLabel.clientWidth,
          backLabelSingleLineDelta: Math.abs(
            backLabelRect.height - Number.parseFloat(backLabelStyle.lineHeight),
          ),
          headerToBackGap: backLinkRect.top - pageHeaderRect.top,
          backToHeadingGap: pageHeadingRect.top - backLinkRect.bottom,
          backInsideHeader:
            backLinkRect.left >= pageHeaderRect.left &&
            backLinkRect.right <= pageHeaderRect.right,
        },
        tabStripClientWidth: tabStrip.clientWidth,
        tabStripScrollWidth: tabStrip.scrollWidth,
        tabStripScrollLeft: tabStrip.scrollLeft,
        tabStripOverflowX: getComputedStyle(tabStrip).overflowX,
        baselinePaintHeight: baselineStyle.height,
        baselineScaleY,
        baselineVisualHeight: Number(
          (
            Number.parseFloat(baselineStyle.height) * Math.abs(baselineScaleY)
          ).toFixed(3),
        ),
        selectedTab: selectedTab.textContent?.trim() ?? "",
        selectedTabAriaSelected: selectedTab.getAttribute("aria-selected"),
        visibleTabHeights: Array.from(
          tabStrip.querySelectorAll<HTMLElement>(".workspace-tab"),
        )
          .filter((tab) => tab.getClientRects().length > 0)
          .map((tab) => tab.getBoundingClientRect().height),
        visibleTabFontSizes: Array.from(
          tabStrip.querySelectorAll<HTMLElement>(".workspace-tab"),
        )
          .filter((tab) => tab.getClientRects().length > 0)
          .map((tab) => getComputedStyle(tab).fontSize),
        selectedTabLeft: selectedTabRect.left,
        selectedTabRight: selectedTabRect.right,
        tabStripLeft: tabStripRect.left,
        tabStripRight: tabStripRect.right,
      };
      backLabel.textContent = originalBackLabel;
      return contract;
    });

    assert.equal(mobileVisual.documentClientWidth, 375);
    assert.equal(
      mobileVisual.documentScrollWidth,
      mobileVisual.documentClientWidth,
    );
    assert.ok(mobileVisual.headerLeft >= 0);
    assert.ok(mobileVisual.headerRight <= mobileVisual.documentClientWidth);
    assert.ok(mobileVisual.titleLeft >= 0);
    assert.ok(mobileVisual.titleRight <= mobileVisual.documentClientWidth);
    assert.equal(mobileVisual.titleFontSize, "32px");
    assert.equal(mobileVisual.titleFontWeight, "400");
    assert.deepEqual(
      {
        actionsInsideViewport: mobileVisual.pageHeader.actionsInsideViewport,
        actionsWrappedBelowTitle:
          mobileVisual.pageHeader.actionsWrappedBelowTitle,
        metricBelowActions: mobileVisual.pageHeader.metricBelowActions,
        backColor: mobileVisual.pageHeader.backColor,
        backIconColor: mobileVisual.pageHeader.backIconColor,
        backIconFlexShrink: mobileVisual.pageHeader.backIconFlexShrink,
        backLabelOverflow: mobileVisual.pageHeader.backLabelOverflow,
        backLabelTextOverflow: mobileVisual.pageHeader.backLabelTextOverflow,
        backLabelWhiteSpace: mobileVisual.pageHeader.backLabelWhiteSpace,
        backLabelIsClipped: mobileVisual.pageHeader.backLabelIsClipped,
        backInsideHeader: mobileVisual.pageHeader.backInsideHeader,
      },
      {
        actionsInsideViewport: true,
        actionsWrappedBelowTitle: true,
        metricBelowActions: true,
        backColor: "rgb(20, 20, 20)",
        backIconColor: "rgb(20, 20, 20)",
        backIconFlexShrink: "0",
        backLabelOverflow: "hidden",
        backLabelTextOverflow: "ellipsis",
        backLabelWhiteSpace: "nowrap",
        backLabelIsClipped: true,
        backInsideHeader: true,
      },
    );
    assert.ok(mobileVisual.pageHeader.actionStackGapDelta < 0.5);
    assert.ok(mobileVisual.pageHeader.actionsFitContentDelta < 0.5);
    assert.ok(
      mobileVisual.pageHeader.actionControlFontSizes.every(
        (fontSize) => fontSize === "14.08px",
      ),
    );
    assert.ok(mobileVisual.pageHeader.metricGapDelta < 0.5);
    assert.ok(mobileVisual.pageHeader.backLabelSingleLineDelta < 0.5);
    assert.ok(Math.abs(mobileVisual.pageHeader.headerToBackGap - 20) < 0.5);
    assert.ok(Math.abs(mobileVisual.pageHeader.backToHeadingGap - 20) < 0.5);
    assert.ok(
      Math.abs(
        mobileVisual.pageHeader.headerToBackGap -
          mobileVisual.pageHeader.backToHeadingGap,
      ) < 0.5,
    );
    assert.equal(mobileVisual.tabStripOverflowX, "auto");
    assert.ok(
      mobileVisual.tabStripScrollWidth > mobileVisual.tabStripClientWidth,
    );
    assert.ok(mobileVisual.tabStripScrollLeft > 0);
    assert.equal(mobileVisual.baselinePaintHeight, "3px");
    assert.equal(mobileVisual.baselineScaleY, 0.4);
    assert.equal(mobileVisual.baselineVisualHeight, 1.2);
    assert.match(mobileVisual.selectedTab, /^История/);
    assert.equal(mobileVisual.selectedTabAriaSelected, "true");
    assert.ok(mobileVisual.visibleTabHeights.length >= 5);
    assert.ok(mobileVisual.visibleTabHeights.every((height) => height === 40));
    assert.ok(
      mobileVisual.visibleTabFontSizes.every(
        (fontSize) => fontSize === "14.08px",
      ),
    );
    assert.ok(mobileVisual.selectedTabLeft >= mobileVisual.tabStripLeft - 1);
    assert.ok(mobileVisual.selectedTabRight <= mobileVisual.tabStripRight + 1);
  } finally {
    e2eAuthoredExerciseVisible = false;
    await runtime.close();
  }
});
