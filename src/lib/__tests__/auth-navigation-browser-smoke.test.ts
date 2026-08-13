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
const E2E_RAISED_CONTROL_SHADOW = "oklch(0 0 0 / 0.2) 0px 1px 4px 0px";
const E2E_RAISED_CONTROL_HOVER_SHADOW = "oklch(0 0 0 / 0.2) 0px 1px 6px 0px";
const E2E_RAISED_CONTROL_PRESSED_SHADOW = "oklch(0 0 0 / 0.2) 0px 1px 2px 0px";

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

function e2eLessonRow() {
  return {
    ...E2E_LESSON_BASE_ROW,
    components: [e2eLessonComponentRow()],
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
let e2eCourseAudienceReplacement: {
  directLearnerProfileIds: string[];
  learnerGroupIds: string[];
} | null = null;
const e2eSupabaseReferers: string[] = [];

type PlaywrightLocator = {
  click: () => Promise<void>;
  check: () => Promise<void>;
  count: () => Promise<number>;
  fill: (value: string) => Promise<void>;
  hover: () => Promise<void>;
  inputValue: () => Promise<string>;
  selectOption: (option: { label: string }) => Promise<string[]>;
  getAttribute: (name: string) => Promise<string | null>;
  textContent: () => Promise<string | null>;
  allTextContents: () => Promise<string[]>;
  locator: (selector: string) => PlaywrightLocator;
  evaluate: <T>(pageFunction: (element: Element) => T) => Promise<T>;
  press: (key: string) => Promise<void>;
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
  request: () => { postDataJSON: () => unknown };
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
        setViewportSize: (viewport: {
          width: number;
          height: number;
        }) => Promise<void>;
        waitForTimeout: (timeout: number) => Promise<void>;
        goto: (
          url: string,
          options?: { waitUntil?: "domcontentloaded" | "networkidle" },
        ) => Promise<void>;
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
        ) => Promise<{ url: () => string }>;
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
      },
    ]);
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
    json(
      response,
      200,
      !requestedComponentId || requestedComponentId === E2E_COMPONENT_ID
        ? [e2eLessonComponentRow()]
        : [],
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
    json(
      response,
      200,
      E2E_TEACHER_LEARNER_ROWS.filter(
        (row) =>
          (!requestedTeacherId ||
            row.teacher_account_id === requestedTeacherId) &&
          (!requestedId || row.learner_profile_id === requestedId) &&
          (!requestedIds || requestedIds.includes(row.learner_profile_id)),
      ),
    );
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
    json(
      response,
      200,
      e2eCompletionRunRows().filter(
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
      ),
    );
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

test("browser smoke: authenticated user on / sees auth-aware header", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.goto("/api/auth/session", { waitUntil: "networkidle" });
    const sessionHtml = await runtime.page.content();
    assert.match(sessionHtml, /E2E Adult/);
    assert.match(sessionHtml, /adult-e2e@example\.test/);

    await runtime.page.goto("/", { waitUntil: "networkidle" });
    const html = await runtime.page.content();

    assert.match(html, /E2E Adult/);
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

  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.goto(
      "/store?product=propisi-pervye-kitaiskie-ieroglify",
      { waitUntil: "networkidle" },
    );
    await runtime.page
      .getByRole("heading", { name: "Магазин", exact: true, level: 1 })
      .waitFor();
    await runtime.page
      .getByText("Демо · без оплаты", { exact: true })
      .waitFor();
    const workbookTab = runtime.page.getByRole("tab", {
      name: /Прописи и тетради/,
    });
    await workbookTab.waitFor();
    assert.equal(await workbookTab.getAttribute("aria-selected"), "true");
    assert.equal(
      await runtime.page.evaluate(() => document.activeElement?.id),
      "store-product-store-product-001",
    );

    await runtime.page
      .getByRole("button", {
        name: "Добавить в корзину: Прописи «Первые китайские иероглифы»",
        exact: true,
      })
      .click();
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

    await runtime.page.setViewportSize({ width: 375, height: 812 });
    assert.deepEqual(
      await runtime.page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
      { clientWidth: 375, scrollWidth: 375 },
    );
  } finally {
    await runtime.close();
  }
});

test("browser smoke: protected pages expose the global assistant with keyboard focus recovery", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });

  try {
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });

    const launcher = runtime.page.getByRole("button", {
      name: "Открыть ИИ-ассистента",
      exact: true,
    });
    await launcher.waitFor();
    await launcher.press("Enter");

    const panel = runtime.page.getByRole("dialog", {
      name: "Shidao ИИ",
      exact: true,
    });
    await panel.waitFor();
    const composer = panel.getByLabel("Сообщение ИИ-ассистенту");
    await composer.waitFor();
    await runtime.page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    assert.equal(
      await runtime.page.evaluate(
        () => document.activeElement?.id === "system-assistant-message",
      ),
      true,
    );

    await composer.fill("Черновик вопроса");
    await Promise.all([
      runtime.page.waitForURL(/\/students$/),
      runtime.page.getByRole("link", { name: "Ученики", exact: true }).click(),
    ]);
    await runtime.page
      .getByRole("heading", { name: "Ученики", exact: true, level: 1 })
      .waitFor();
    assert.match((await panel.textContent()) ?? "", /Контекст: Ученики/);
    assert.equal(await composer.inputValue(), "Черновик вопроса");

    await composer.press("Escape");
    await panel.waitFor({ state: "hidden" });
    await runtime.page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.classList.contains("system-assistant-launcher"),
      ),
      true,
    );
  } finally {
    await runtime.close();
  }
});

test("browser smoke: assistant quick reply is one-time and sends its structured message in the next request", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  const runtime = await openPage({ cookie: authenticatedCookieValue() });
  const requestBodies: Array<{
    messages?: Array<{ role?: string; content?: string }>;
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
    await runtime.page.route("**/api/v2/assistant", async (route) => {
      requestBodies.push(
        (route.request().postDataJSON() ?? {}) as {
          messages?: Array<{ role?: string; content?: string }>;
        },
      );
      const requestNumber = requestBodies.length;
      if (requestNumber === 2) {
        observeSecondRequest?.();
        await secondRequestReleased;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            message: {
              role: "assistant",
              content:
                requestNumber === 1
                  ? "Вам нужен пустой урок-заготовка или сразу наполненный урок с содержанием и заданиями?"
                  : "Хорошо, подготовлю пустой урок.",
            },
            proposedAction: null,
            quickReplies:
              requestNumber === 1
                ? [
                    { label: "Пустой урок", message: "Пустой урок" },
                    { label: "Готовый урок", message: "Готовый урок" },
                  ]
                : [],
            sharedHistoryUsed: false,
            requestId: `assistant-browser-${requestNumber}`,
            model: "test-model",
            provider: "test-provider",
            usage: {
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15,
              cachedInputTokens: 0,
              reasoningTokens: 0,
            },
          },
        }),
      });
    });

    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("button", { name: "Открыть ИИ-ассистента", exact: true })
      .click();
    const panel = runtime.page.getByRole("dialog", {
      name: "Shidao ИИ",
      exact: true,
    });
    const composer = panel.getByLabel("Сообщение ИИ-ассистенту");
    await composer.fill("Сделай четвёртый урок");
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
    assert.deepEqual(requestBodies[1]?.messages?.at(-1), {
      role: "user",
      content: "Пустой урок",
    });
    assert.deepEqual(
      requestBodies[1]?.messages?.map((message) => message.content),
      [
        "Сделай четвёртый урок",
        "Вам нужен пустой урок-заготовка или сразу наполненный урок с содержанием и заданиями?",
        "Пустой урок",
      ],
    );

    releaseSecondRequest?.();
    await runtime.page
      .locator(".system-assistant-message.is-assistant")
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

test("browser smoke: Account navigates Schedule → Students with honest V2 states", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

  e2eAiConsentRequested = false;
  const teacherCookie = authenticatedCookieValue();
  const runtime = await openPage({ cookie: teacherCookie });

  try {
    await runtime.page.clock.setFixedTime("2026-08-11T00:00:00.000Z");
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", { name: "Расписание", exact: true, level: 1 })
      .waitFor();
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

    const scheduleContract = await runtime.page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".course-demo-shell");
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
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
      const activeViewButton =
        viewToggle?.querySelector<HTMLElement>("button.is-active");
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
      const userTriggerName = siteHeader?.querySelector<HTMLElement>(
        ".nav-user-trigger-name",
      );

      if (
        !shell ||
        !pageHeader ||
        !pageHeading ||
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
        !activeViewButton ||
        !siteHeader ||
        !headerPrimaryButton ||
        !headerPrimaryIcon ||
        !activeNavPill ||
        navIcons.length === 0 ||
        !userTriggerName
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
      const headerActionsRect = headerActions.getBoundingClientRect();
      const headerActionContentRect =
        headerActions.firstElementChild?.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarActionsRect = toolbarActions.getBoundingClientRect();
      const dateNavigatorRect = dateNavigator.getBoundingClientRect();
      const datePickerRect = datePicker.getBoundingClientRect();
      const viewToggleRect = viewToggle.getBoundingClientRect();

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
          actionCenterDelta: Math.abs(
            headerActionsRect.top +
              headerActionsRect.height / 2 -
              (pageHeaderRect.top + pageHeaderRect.height / 2),
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
          fontSize: primaryButtonStyle.fontSize,
          fontWeight: primaryButtonStyle.fontWeight,
          backgroundColor: primaryButtonStyle.backgroundColor,
          borderTopWidth: primaryButtonStyle.borderTopWidth,
          color: primaryButtonStyle.color,
          boxShadow: primaryButtonStyle.boxShadow,
          transform: primaryButtonStyle.transform,
          icon: {
            color: primaryIconStyle.color,
            opacity: primaryIconStyle.opacity,
            width: primaryIconStyle.width,
            height: primaryIconStyle.height,
          },
        },
        raisedControlShadow: getComputedStyle(activeViewButton).boxShadow,
        viewToggleSurface: {
          borderTopWidth: getComputedStyle(viewToggle).borderTopWidth,
          boxShadow: getComputedStyle(viewToggle).boxShadow,
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
          width: dateNavigatorRect.width,
          pickerWidth: datePickerRect.width,
          triggerFontSize: dateTriggerStyle.fontSize,
          triggerFontWeight: dateTriggerStyle.fontWeight,
          triggerColor: dateTriggerStyle.color,
          icons: dateControlIcons.map((icon) => {
            const style = getComputedStyle(icon);
            return { color: style.color, opacity: style.opacity };
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
            const pill = icon.closest<HTMLElement>(".site-header-nav-pill");
            return {
              color: style.color,
              parentColor: pill ? getComputedStyle(pill).color : "",
              opacity: style.opacity,
            };
          }),
          userNameFontWeight: getComputedStyle(userTriggerName).fontWeight,
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
    assert.equal(scheduleContract.headerLayout.minHeight, "200px");
    assert.ok(Math.abs(scheduleContract.headerLayout.height - 200) < 0.5);
    assert.equal(scheduleContract.headerLayout.headingMinWidth, "0px");
    assert.ok(
      scheduleContract.headerLayout.headingWidth >
        scheduleContract.headerLayout.actionsWidth,
    );
    assert.ok(scheduleContract.headerLayout.actionContentWidth > 0);
    assert.ok(scheduleContract.headerLayout.actionsFitContentDelta < 0.5);
    assert.ok(scheduleContract.headerLayout.actionsRightDelta < 0.5);
    assert.ok(scheduleContract.headerLayout.actionCenterDelta < 0.5);
    assert.equal(scheduleContract.headerSignature.titleFontWeight, "400");
    assert.equal(
      scheduleContract.headerSignature.descriptionColor,
      "rgba(20, 20, 20, 0.5)",
    );
    assert.equal(
      scheduleContract.headerDescription,
      "Здесь все назначенные уроки за выбранный период",
    );
    assert.equal(scheduleContract.headerActions, "Назначить урок");
    assert.match(scheduleContract.headerActionIconClass, /calendar-plus/);
    assert.deepEqual(scheduleContract.headerPrimaryControl, {
      fontSize: "14.08px",
      fontWeight: "400",
      backgroundColor: "rgb(255, 255, 255)",
      borderTopWidth: "0px",
      color: "rgb(20, 20, 20)",
      boxShadow: E2E_RAISED_CONTROL_SHADOW,
      transform: "none",
      icon: {
        color: "rgb(20, 20, 20)",
        opacity: "1",
        width: "16px",
        height: "16px",
      },
    });
    assert.equal(
      scheduleContract.headerPrimaryControl.boxShadow,
      scheduleContract.raisedControlShadow,
    );
    assert.deepEqual(scheduleContract.viewToggleSurface, {
      borderTopWidth: "0px",
      boxShadow: "none",
    });
    const scheduleHeaderPrimaryButton = runtime.page.getByRole("link", {
      name: "Назначить урок",
      exact: true,
    });
    await scheduleHeaderPrimaryButton.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await scheduleHeaderPrimaryButton.evaluate((button) => {
        const style = getComputedStyle(button);
        return {
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
          transform: style.transform,
        };
      }),
      {
        backgroundColor: "rgb(255, 255, 255)",
        boxShadow: E2E_RAISED_CONTROL_HOVER_SHADOW,
        transform: "none",
      },
    );
    await runtime.page.mouse.down();
    await runtime.page.waitForTimeout(220);
    assert.equal(
      await scheduleHeaderPrimaryButton.evaluate(
        (button) => getComputedStyle(button).boxShadow,
      ),
      E2E_RAISED_CONTROL_PRESSED_SHADOW,
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
    assert.equal(
      scheduleContract.dateNavigator.backgroundColor,
      "rgb(255, 255, 255)",
    );
    assert.equal(scheduleContract.dateNavigator.height, "40px");
    assert.equal(scheduleContract.dateNavigator.triggerFontSize, "14.08px");
    assert.equal(scheduleContract.dateNavigator.triggerFontWeight, "400");
    assert.equal(
      scheduleContract.dateNavigator.triggerColor,
      "rgb(20, 20, 20)",
    );
    assert.ok(
      scheduleContract.dateNavigator.icons.every(
        ({ color, opacity }) => color === "rgb(20, 20, 20)" && opacity === "1",
      ),
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
        ({ color, parentColor, opacity }) =>
          color === parentColor && opacity === "1",
      ),
    );
    assert.equal(scheduleContract.navigationControls.userNameFontWeight, "400");
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
          tableBackgroundColor: tableStyle.backgroundColor,
          firstBodyRowBorderTopWidth: getComputedStyle(bodyRow).borderTopWidth,
          wrapperBorderWidths: [
            wrapperStyle.borderTopWidth,
            wrapperStyle.borderRightWidth,
            wrapperStyle.borderBottomWidth,
            wrapperStyle.borderLeftWidth,
          ],
          wrapperBorderRadius: wrapperStyle.borderRadius,
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
          matchesActiveViewOption:
            menuTriggerRect.width ===
              activeViewButton.getBoundingClientRect().width &&
            menuTriggerRect.height ===
              activeViewButton.getBoundingClientRect().height &&
            menuTriggerStyle.borderRadius ===
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
      tableBackgroundColor: "rgb(255, 255, 255)",
      firstBodyRowBorderTopWidth: "0px",
      wrapperBorderWidths: ["0px", "0px", "0px", "0px"],
      wrapperBorderRadius: "12px",
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
      matchesActiveViewOption: true,
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
        };
      }),
      { backgroundColor: "rgba(0, 0, 0, 0)", boxShadow: "none" },
    );
    await rowMenuTrigger.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await rowMenuTrigger.evaluate((button) => {
        const style = getComputedStyle(button);
        return {
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
        };
      }),
      { backgroundColor: "rgba(20, 20, 20, 0.07)", boxShadow: "none" },
    );
    await runtime.page.mouse.down();
    await runtime.page.waitForTimeout(220);
    assert.equal(
      await rowMenuTrigger.evaluate(
        (button) => getComputedStyle(button).boxShadow,
      ),
      "none",
    );
    await runtime.page.mouse.move(0, 0);
    await runtime.page.mouse.up();
    await rowMenuTrigger.click();
    const rowActionMenu = runtime.page.getByRole("menu");
    await rowActionMenu.waitFor();
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
          ".teaching-schedule-view-toggle button.is-active",
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
        boxShadow: "rgba(20, 20, 20, 0.18) 0px 18px 46px 0px",
        activeViewOptionBorderRadius: "8px",
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
            color: "rgb(20, 20, 20)",
            fontSize: "14.08px",
            fontWeight: "400",
          },
        ],
        icons: [
          { color: "rgb(20, 20, 20)", opacity: "1", marginTop: "0px" },
          { color: "rgb(20, 20, 20)", opacity: "1", marginTop: "0px" },
          { color: "rgb(20, 20, 20)", opacity: "1", marginTop: "0px" },
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

    const userMenuTrigger = runtime.page.getByRole("button", {
      name: "Открыть меню пользователя",
      exact: true,
    });
    await userMenuTrigger.click();
    const profileDropdown = runtime.page.locator(".nav-dropdown-panel");
    await profileDropdown.waitFor();
    await runtime.page
      .getByRole("menu", { name: "Меню пользователя", exact: true })
      .waitFor();
    assert.deepEqual(
      await runtime.page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>(
          ".nav-dropdown-panel",
        );
        if (!panel) throw new Error("Profile dropdown is missing");
        const style = getComputedStyle(panel);
        const items = Array.from(
          panel.querySelectorAll<HTMLElement>(".nav-dropdown-item"),
        ).filter((item) => item.offsetParent !== null);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          backdropFilter: style.backdropFilter,
          opacity: style.opacity,
          items: items.map((item) => {
            const itemStyle = getComputedStyle(item);
            const icon = item.querySelector<SVGElement>("svg");
            const iconStyle = icon ? getComputedStyle(icon) : null;
            return {
              borderWidths: [
                itemStyle.borderTopWidth,
                itemStyle.borderRightWidth,
                itemStyle.borderBottomWidth,
                itemStyle.borderLeftWidth,
              ],
              fontWeight: itemStyle.fontWeight,
              color: itemStyle.color,
              iconColor: iconStyle?.color ?? "",
              iconOpacity: iconStyle?.opacity ?? "",
            };
          }),
        };
      }),
      {
        backgroundColor: "rgb(255, 255, 255)",
        backgroundImage: "none",
        backdropFilter: "none",
        opacity: "1",
        items: [
          {
            borderWidths: ["0px", "0px", "0px", "0px"],
            fontWeight: "400",
            color: "rgb(23, 23, 23)",
            iconColor: "rgb(23, 23, 23)",
            iconOpacity: "1",
          },
          {
            borderWidths: ["0px", "0px", "0px", "0px"],
            fontWeight: "400",
            color: "rgb(23, 23, 23)",
            iconColor: "rgb(23, 23, 23)",
            iconOpacity: "1",
          },
          {
            borderWidths: ["0px", "0px", "0px", "0px"],
            fontWeight: "400",
            color: "rgb(23, 23, 23)",
            iconColor: "rgb(23, 23, 23)",
            iconOpacity: "1",
          },
        ],
      },
    );
    await userMenuTrigger.press("Escape");
    await profileDropdown.waitFor({ state: "detached" });

    await runtime.page
      .getByRole("button", { name: "Показать карточками", exact: true })
      .click();
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
          borderTopWidth: "0px",
          color: "rgb(20, 20, 20)",
          fontSize: "14.08px",
          fontWeight: "400",
          boxShadow: E2E_RAISED_CONTROL_SHADOW,
          transform: "none",
        },
        secondary: {
          backgroundColor: "rgb(255, 255, 255)",
          borderTopWidth: "0px",
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

    await runtime.page
      .getByRole("button", { name: "Показать таблицей", exact: true })
      .click();
    await runtime.page
      .getByRole("table", {
        name: "Занятия за выбранную неделю",
        exact: true,
      })
      .waitFor();
    e2eScheduleFixtureVisible = false;
    e2eScheduleFixtureRunCount = 1;

    const studentsLink = runtime.page.getByRole("link", {
      name: "Ученики",
      exact: true,
    });
    await Promise.all([
      runtime.page.waitForURL(/\/students$/),
      studentsLink.click(),
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
      const activeTabLabel = activeTab?.querySelector<HTMLElement>(
        "span:not(.workspace-tab-count)",
      );
      const activeTabCount = activeTab?.querySelector<HTMLElement>(
        ".workspace-tab-count",
      );
      const tabs = document.querySelector<HTMLElement>(".workspace-tabs");
      const tabsScroll = document.querySelector<HTMLElement>(
        ".workspace-tabs-scroll",
      );
      const headerActions =
        document.querySelector<HTMLElement>(".app-page-actions");
      const toolbar = document.querySelector<HTMLElement>(
        ".student-directory-toolbar",
      );
      const toolbarSearch = toolbar?.querySelector<HTMLElement>(
        ".student-directory-search",
      );
      const toolbarControls = toolbar?.querySelector<HTMLElement>(
        ".student-directory-controls",
      );
      const filterTrigger = toolbar?.querySelector<HTMLElement>(
        ".student-directory-filter-menu .course-filter-trigger",
      );
      const viewSwitch = toolbar?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Вид списка учеников"]',
      );
      const activeViewButton = viewSwitch?.querySelector<HTMLElement>(
        'button[aria-pressed="true"]',
      );

      if (
        !pageHeader ||
        !title ||
        !description ||
        !activeTab ||
        !inactiveTab ||
        !activeTabLabel ||
        !activeTabCount ||
        !tabs ||
        !tabsScroll ||
        !headerActions ||
        !toolbar ||
        !toolbarSearch ||
        !toolbarControls ||
        !filterTrigger ||
        !viewSwitch ||
        !activeViewButton
      ) {
        throw new Error("Students visual contract is missing");
      }

      const pageHeaderStyle = getComputedStyle(pageHeader);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const tabsStyle = getComputedStyle(tabs);
      const tabStyle = getComputedStyle(activeTab);
      const inactiveTabStyle = getComputedStyle(inactiveTab);
      const tabLabelStyle = getComputedStyle(activeTabLabel);
      const tabCountStyle = getComputedStyle(activeTabCount);
      const markerStyle = getComputedStyle(activeTab, "::after");
      const baselineStyle = getComputedStyle(tabs, "::before");
      const baselineScaleY = new DOMMatrixReadOnly(baselineStyle.transform).m22;
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();
      const tabsScrollRect = tabsScroll.getBoundingClientRect();
      const tabsRect = tabs.getBoundingClientRect();
      const activeTabRect = activeTab.getBoundingClientRect();
      const baselineLeft = Number.parseFloat(baselineStyle.left);
      const baselineRight = Number.parseFloat(baselineStyle.right);
      const toolbarStyle = getComputedStyle(toolbar);
      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarSearchRect = toolbarSearch.getBoundingClientRect();
      const toolbarControlsRect = toolbarControls.getBoundingClientRect();

      return {
        headerLayout: {
          minHeight: pageHeaderStyle.minHeight,
          height: pageHeaderRect.height,
          actionCenterDelta: Math.abs(
            headerActionsRect.top +
              headerActionsRect.height / 2 -
              (pageHeaderRect.top + pageHeaderRect.height / 2),
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
        controlGeometry: {
          filterTriggerHeight: getComputedStyle(filterTrigger).height,
          filterTriggerText: filterTrigger.textContent?.trim() ?? "",
          viewSwitchHeight: getComputedStyle(viewSwitch).height,
          viewSwitchBoxShadow: getComputedStyle(viewSwitch).boxShadow,
          activeViewButtonHeight: getComputedStyle(activeViewButton).height,
          activeViewButtonBoxShadow:
            getComputedStyle(activeViewButton).boxShadow,
          viewSwitchInsideControls:
            viewSwitch.parentElement === toolbarControls,
          filterBeforeViewSwitch: Boolean(
            filterTrigger.compareDocumentPosition(viewSwitch) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        },
        viewButtons: Array.from(viewSwitch.querySelectorAll("button")).map(
          (button) => ({
            label: button.getAttribute("aria-label"),
            pressed: button.getAttribute("aria-pressed"),
          }),
        ),
        hasMembershipSwitch: Boolean(
          toolbar.querySelector(
            '[role="group"][aria-label="Принадлежность к группе"]',
          ),
        ),
        hasLegacySortOrGroupSelect: Boolean(
          toolbar.querySelector(
            'select[aria-label="Фильтр по группе"], select[aria-label="Сортировка"]',
          ),
        ),
      };
    });

    assert.deepEqual(
      studentsVisual.headerSignature,
      scheduleContract.headerSignature,
    );
    assert.equal(studentsVisual.headerLayout.minHeight, "200px");
    assert.ok(Math.abs(studentsVisual.headerLayout.height - 200) < 0.5);
    assert.equal(
      studentsVisual.headerLayout.height,
      scheduleContract.headerLayout.height,
    );
    assert.ok(studentsVisual.headerLayout.actionCenterDelta < 0.5);
    assert.deepEqual(studentsVisual.tabSignature, {
      height: "40px",
      radius: "12px 12px 0px 0px",
      fontWeight: "400",
      activeColor: "rgb(20, 20, 20)",
      inactiveColor: "rgba(20, 20, 20, 0.5)",
      gap: "12px",
      tabZIndex: "auto",
      baselinePaintHeight: "3px",
      baselineScaleY: 0.4,
      baselineVisualHeight: 1.2,
      baselineColor: "rgba(20, 20, 20, 0.5)",
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
    assert.deepEqual(studentsVisual.controlGeometry, {
      filterTriggerHeight: "40px",
      filterTriggerText: "Фильтр",
      viewSwitchHeight: "40px",
      viewSwitchBoxShadow: "none",
      activeViewButtonHeight: "32px",
      activeViewButtonBoxShadow: E2E_RAISED_CONTROL_SHADOW,
      viewSwitchInsideControls: true,
      filterBeforeViewSwitch: true,
    });
    assert.deepEqual(studentsVisual.viewButtons, [
      { label: "Показать таблицей", pressed: "true" },
      { label: "Показать карточками", pressed: "false" },
    ]);
    assert.equal(studentsVisual.hasMembershipSwitch, true);
    assert.equal(studentsVisual.hasLegacySortOrGroupSelect, false);

    const activeLearnerViewButton = runtime.page.getByRole("button", {
      name: "Показать таблицей",
      exact: true,
    });
    await activeLearnerViewButton.hover();
    await runtime.page.waitForTimeout(220);
    assert.equal(
      await activeLearnerViewButton.evaluate(
        (button) => getComputedStyle(button).boxShadow,
      ),
      E2E_RAISED_CONTROL_SHADOW,
    );
    await runtime.page.mouse.down();
    await runtime.page.waitForTimeout(220);
    assert.equal(
      await activeLearnerViewButton.evaluate(
        (button) => getComputedStyle(button).boxShadow,
      ),
      E2E_RAISED_CONTROL_SHADOW,
    );
    await runtime.page.mouse.move(0, 0);
    await runtime.page.mouse.up();

    const learnerViewSwitch = runtime.page.getByRole("group", {
      name: "Вид списка учеников",
      exact: true,
    });
    await learnerViewSwitch
      .getByRole("button", { name: "Показать карточками", exact: true })
      .click();
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
    await learnerViewSwitch
      .getByRole("button", { name: "Показать таблицей", exact: true })
      .click();

    const learnerTable = runtime.page.getByRole("table", {
      name: "Ученики, их статусы и группы",
      exact: true,
    });
    await learnerTable.waitFor();
    await assertCanonicalFirstBodyRowTypography(learnerTable, "Ученики");
    const learnerFilterTrigger = runtime.page.locator(
      ".student-directory-filter-menu .course-filter-trigger",
    );
    assert.equal((await learnerFilterTrigger.textContent())?.trim(), "Фильтр");
    assert.equal(
      await learnerFilterTrigger.getAttribute("aria-expanded"),
      "false",
    );
    await learnerFilterTrigger.click();
    const learnerFilterPanel = runtime.page.getByRole("group", {
      name: "Фильтры учеников",
      exact: true,
    });
    await learnerFilterPanel.waitFor();
    const learnerStatusFilter = learnerFilterPanel.getByLabel("Состояние");
    const learnerAccountFilter = learnerFilterPanel.getByLabel("Аккаунт");
    const learnerSpecificGroupFilter =
      learnerFilterPanel.getByLabel("Конкретная группа");
    const learnerMembershipSwitch = learnerFilterPanel.getByRole("group", {
      name: "Принадлежность к группе",
      exact: true,
    });
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
    assert.notEqual(
      await learnerSpecificGroupFilter.getAttribute("disabled"),
      null,
    );
    await groupedMemberships.click();
    assert.equal(await groupedMemberships.getAttribute("aria-pressed"), "true");
    assert.equal(
      await learnerSpecificGroupFilter.getAttribute("disabled"),
      null,
    );
    await learnerSpecificGroupFilter.selectOption({ label: "Teen Talk" });
    assert.equal(
      await learnerSpecificGroupFilter.inputValue(),
      E2E_GROUP_TEEN_ID,
    );
    assert.equal(await groupedMemberships.getAttribute("aria-pressed"), "true");
    await learnerStatusFilter.selectOption({ label: "В архиве" });
    await learnerAccountFilter.selectOption({ label: "Без аккаунта" });
    assert.equal(
      await runtime.page
        .locator(
          '.student-directory-filter-menu .course-filter-trigger [aria-label="Выбрано: 3"]',
        )
        .textContent(),
      "3",
    );
    const learnerFilterReset = learnerFilterPanel.getByRole("button", {
      name: "Сбросить фильтры",
      exact: true,
    });
    await learnerFilterReset.click();
    assert.equal(await learnerStatusFilter.inputValue(), "all");
    assert.equal(await learnerSpecificGroupFilter.inputValue(), "");
    assert.notEqual(
      await learnerSpecificGroupFilter.getAttribute("disabled"),
      null,
    );
    assert.equal(await learnerAccountFilter.inputValue(), "all");
    assert.equal(await allMemberships.getAttribute("aria-pressed"), "true");
    await learnerFilterTrigger.press("Escape");
    await learnerFilterPanel.waitFor({ state: "hidden" });
    assert.equal(
      await learnerFilterTrigger.getAttribute("aria-expanded"),
      "false",
    );
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.classList.contains("course-filter-trigger"),
      ),
      true,
    );

    const learnerStatusHeader = learnerTable.getByRole("columnheader", {
      name: "Статус",
      exact: true,
    });
    const learnerStatusSort = learnerStatusHeader.getByRole("button", {
      name: "Статус",
      exact: true,
    });
    const learnerRowNames = () =>
      runtime.page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            ".student-directory-learners-table tbody tr td:first-child strong",
          ),
        ).map((element) => element.textContent?.trim() ?? ""),
      );
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
        boxShadow: "rgba(20, 20, 20, 0.18) 0px 18px 46px 0px",
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
      "",
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
          tableBackgroundColor: tableStyle.backgroundColor,
          wrapperBorderWidths: [
            wrapperStyle.borderTopWidth,
            wrapperStyle.borderRightWidth,
            wrapperStyle.borderBottomWidth,
            wrapperStyle.borderLeftWidth,
          ],
          wrapperBorderRadius: wrapperStyle.borderRadius,
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
      tableBackgroundColor: "rgb(255, 255, 255)",
      wrapperBorderWidths: ["0px", "0px", "0px", "0px"],
      wrapperBorderRadius: "12px",
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
    assert.equal(await learnerFilterTrigger.count(), 1);
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
  } finally {
    e2eCompletionPhase = null;
    e2eScheduleFixtureVisible = false;
    e2eScheduleFixtureRunCount = 1;
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
    await runtime.page.goto("/learning-profile", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", {
        name: "Мой учебный профиль",
        exact: true,
        level: 1,
      })
      .waitFor();
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

    await runtime.page.getByRole("tab", { name: /^История/ }).click();
    await runtime.page
      .getByText("Опубликованный комментарий для учебного профиля.", {
        exact: true,
      })
      .waitFor();
    html = await runtime.page.content();
    assert.doesNotMatch(html, /FOREIGN TRAP RECORD|Чужой курс/);

    await runtime.page
      .getByRole("tab", { name: "Аттестация", exact: true })
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

    await runtime.page
      .getByRole("tab", { name: /Связи и помощник/, exact: false })
      .click();
    await runtime.page
      .getByText("Персонализация с общей историей", { exact: true })
      .waitFor();
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
    await runtime.page.goto("/settings/observers", {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByRole("heading", { name: "Наблюдатели", exact: true, level: 1 })
      .waitFor();
    await runtime.page
      .getByRole("button", { name: "Отправить приглашение", exact: true })
      .waitFor();
    assert.deepEqual(
      await runtime.page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>(
          ".settings-product-shell",
        );
        const header = document.querySelector<HTMLElement>(
          ".site-header-shell-demo",
        );
        const userName = header?.querySelector<HTMLElement>(
          ".nav-user-trigger-name",
        );
        const settingsNav = document.querySelector<HTMLElement>(
          ".nav-settings-shell",
        );
        const activeSettingsItem =
          settingsNav?.querySelector<HTMLElement>(".nav-pill-active");
        const primaryAction = document.querySelector<HTMLElement>(
          'form .product-btn-primary[type="submit"]',
        );
        const primaryIcon = primaryAction?.querySelector<SVGElement>("svg");
        if (
          !shell ||
          !header ||
          !userName ||
          !activeSettingsItem ||
          !primaryAction ||
          !primaryIcon
        ) {
          throw new Error("Canonical Settings control contract is missing");
        }
        const shellStyle = getComputedStyle(shell);
        const headerStyle = getComputedStyle(header);
        const userNameStyle = getComputedStyle(userName);
        const settingsItemStyle = getComputedStyle(activeSettingsItem);
        const primaryStyle = getComputedStyle(primaryAction);
        const primaryIconStyle = getComputedStyle(primaryIcon);
        return {
          shellBackground: shellStyle.backgroundColor,
          headerBackground: headerStyle.backgroundColor,
          headerBackdropFilter: headerStyle.backdropFilter,
          userNameWeight: userNameStyle.fontWeight,
          settingsItem: {
            height: settingsItemStyle.height,
            radius: settingsItemStyle.borderRadius,
            fontSize: settingsItemStyle.fontSize,
            fontWeight: settingsItemStyle.fontWeight,
            boxShadow: settingsItemStyle.boxShadow,
          },
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
        userNameWeight: "400",
        settingsItem: {
          height: "40px",
          radius: "12px",
          fontSize: "14.08px",
          fontWeight: "400",
          boxShadow: "none",
        },
        primaryAction: {
          height: "40px",
          radius: "12px",
          fontSize: "14.08px",
          fontWeight: "400",
          background: "rgb(255, 255, 255)",
          borderTopWidth: "0px",
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

    await runtime.page.evaluate(() => {
      window.confirm = () => true;
      const card = Array.from(document.querySelectorAll("li")).find((item) =>
        item.textContent?.includes("Доверенный наблюдатель"),
      );
      const button = Array.from(card?.querySelectorAll("button") ?? []).find(
        (candidate) => candidate.textContent?.includes("Отозвать"),
      );
      button?.click();
    });
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
    await runtime.page.goto("/settings/security", {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByRole("heading", { name: "Безопасность", exact: true, level: 1 })
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
          borderTopWidth: "0px",
          color: "rgb(20, 20, 20)",
          boxShadow: E2E_RAISED_CONTROL_SHADOW,
        },
        destructive: {
          height: "40px",
          radius: "12px",
          fontWeight: "400",
          background: "rgb(255, 255, 255)",
          borderTopWidth: "0px",
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
    const learnerFilterTrigger = runtime.page.locator(
      ".student-directory-filter-menu .course-filter-trigger",
    );
    await learnerSearch.fill("Архивная");
    await learnerFilterTrigger.click();
    const learnerFilterPanel = runtime.page.getByRole("group", {
      name: "Фильтры учеников",
      exact: true,
    });
    await learnerFilterPanel.waitFor();
    const learnerStatusFilter = runtime.page.locator(
      ".student-directory-filter-menu .course-filter-field:first-child select",
    );
    await learnerStatusFilter.selectOption({ label: "В архиве" });
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
    assert.equal(await learnerStatusFilter.inputValue(), "archived");
    assert.equal(
      await learnerNameHeader.getAttribute("aria-sort"),
      "descending",
    );
    assert.equal(
      await runtime.page
        .locator(".student-directory-filter-menu .course-filter-count")
        .textContent(),
      "1",
    );

    await learnerSearch.fill("");
    await learnerFilterTrigger.click();
    await learnerFilterPanel.waitFor();
    await learnerFilterPanel
      .getByRole("button", { name: "Сбросить фильтры", exact: true })
      .click();
    assert.equal(await learnerStatusFilter.inputValue(), "all");
    await learnerFilterTrigger.press("Escape");

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

    await runtime.page.goto("/learning-profile", { waitUntil: "networkidle" });
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

test("browser smoke: mobile Account menu exposes primary sections and account actions", async (t) => {
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
  });

  try {
    await runtime.page.clock.setFixedTime("2026-08-11T00:00:00.000Z");
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", { name: "Занятий нет", exact: true, level: 2 })
      .waitFor();

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
      const viewToggle = document.querySelector<HTMLElement>(
        ".teaching-schedule-view-toggle",
      );
      if (!toolbar || !toolbarActions || !navigator || !picker || !viewToggle) {
        throw new Error("Mobile schedule controls are missing");
      }
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
      };
    });
    assert.deepEqual(mobileScheduleContract, {
      clientWidth: 375,
      scrollWidth: 375,
      controlsInsideViewport: true,
      toolbarPaddingLeft: "0px",
      toolbarPaddingRight: "0px",
      controlsStartInset: 0,
      controlsEndInset: 0,
      externalPeriodSwitchCount: 0,
    });

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
      };
    });
    assert.deepEqual(mobilePopoverContract, {
      clientWidth: 375,
      scrollWidth: 375,
      popoverInsideViewport: true,
      periodLabels: ["День", "Неделя", "Месяц"],
    });

    await runtime.page.setViewportSize({ width: 320, height: 812 });
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

    await runtime.page
      .getByRole("button", { name: "Показать карточками", exact: true })
      .click();
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
      .getByRole("button", { name: "Открыть меню пользователя", exact: true })
      .click();

    await runtime.page
      .getByRole("menuitem", { name: "Расписание", exact: true })
      .waitFor();
    await runtime.page
      .getByRole("menuitem", { name: "Курсы", exact: true })
      .waitFor();
    await runtime.page
      .getByRole("menuitem", { name: "Магазин", exact: true })
      .waitFor();
    const learningProfileMenuItem = runtime.page.getByRole("menuitem", {
      name: "Учебный профиль",
      exact: true,
    });
    await learningProfileMenuItem.waitFor();
    await runtime.page
      .getByRole("menuitem", { name: "Настройки", exact: true })
      .waitFor();
    await runtime.page
      .getByRole("menuitem", { name: "Выход", exact: true })
      .waitFor();

    await Promise.all([
      runtime.page.waitForURL(/\/learning-profile$/),
      learningProfileMenuItem.click(),
    ]);
    await runtime.page
      .getByRole("heading", {
        name: "Мой учебный профиль",
        exact: true,
        level: 1,
      })
      .waitFor();

    await runtime.page
      .getByRole("button", { name: "Открыть меню пользователя", exact: true })
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

    const mobileContract = await runtime.page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(
        ".student-directory-toolbar",
      );
      const rail = toolbar?.querySelector<HTMLElement>(
        ".student-directory-controls",
      );
      const filterTrigger = rail?.querySelector<HTMLElement>(
        ".student-directory-filter-menu .course-filter-trigger",
      );
      const viewSwitch = rail?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Вид списка учеников"]',
      );
      const activeViewButton = viewSwitch?.querySelector<HTMLElement>(
        'button[aria-pressed="true"]',
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
        !filterTrigger ||
        !viewSwitch ||
        !activeViewButton ||
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
        filterTriggerHeight: getComputedStyle(filterTrigger).height,
        filterTriggerText: filterTrigger.textContent?.trim() ?? "",
        viewSwitchHeight: getComputedStyle(viewSwitch).height,
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
        hasMembershipSwitch: Boolean(
          rail.querySelector(
            '[role="group"][aria-label="Принадлежность к группе"]',
          ),
        ),
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
    assert.equal(mobileContract.filterTriggerHeight, "40px");
    assert.equal(mobileContract.filterTriggerText, "Фильтр");
    assert.equal(mobileContract.viewSwitchHeight, "40px");
    assert.equal(mobileContract.activeViewButtonHeight, "32px");
    assert.equal(mobileContract.viewSwitchInsideViewport, true);
    assert.deepEqual(mobileContract.viewButtons, [
      { label: "Показать таблицей", pressed: "true" },
      { label: "Показать карточками", pressed: "false" },
    ]);
    assert.equal(mobileContract.hasMembershipSwitch, true);
    assert.equal(mobileContract.tableWrapInsideViewport, true);
    assert.equal(mobileContract.tableOverflowX, "auto");
    assert.deepEqual(mobileContract.tableSurface, {
      backgroundColor: "rgb(255, 255, 255)",
      borderTopWidth: "0px",
      borderRadius: "12px",
    });
    assert.equal(mobileContract.tableScrollIsContained, true);
    assert.equal(mobileContract.rowCellCount, 6);
    assert.equal(mobileContract.columnsDoNotOverlap, true);
    assert.equal(mobileContract.actionsInsideTable, true);

    const mobileLearnerFilterTrigger = runtime.page.locator(
      ".student-directory-filter-menu .course-filter-trigger",
    );
    await mobileLearnerFilterTrigger.click();
    const mobileLearnerFilterPanel = runtime.page.getByRole("group", {
      name: "Фильтры учеников",
      exact: true,
    });
    await mobileLearnerFilterPanel.waitFor();
    await mobileLearnerFilterPanel.getByLabel("Состояние").waitFor();
    await mobileLearnerFilterPanel.getByLabel("Аккаунт").waitFor();
    await mobileLearnerFilterPanel.getByLabel("Конкретная группа").waitFor();
    await mobileLearnerFilterPanel
      .getByRole("group", {
        name: "Принадлежность к группе",
        exact: true,
      })
      .waitFor();
    assert.equal(
      await runtime.page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>(
          ".student-directory-filter-menu .course-filter-popover",
        );
        if (!panel) throw new Error("Mobile Students filter panel is missing");
        const rect = panel.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.right <= document.documentElement.clientWidth &&
          rect.width > 0
        );
      }),
      true,
    );
    await mobileLearnerFilterTrigger.press("Escape");
    await mobileLearnerFilterPanel.waitFor({ state: "hidden" });
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.classList.contains("course-filter-trigger"),
      ),
      true,
    );
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
        ".site-header-shell-demo .nav-user-trigger",
      );
      const toolbar = document.querySelector<HTMLElement>(
        ".course-index-toolbar",
      );
      const toolbarSearch = toolbar?.querySelector<HTMLElement>(
        ".compact-toolbar-search",
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
        !header ||
        !title ||
        !description ||
        !headerActions ||
        !primaryButton ||
        !navPill ||
        !userTrigger ||
        !toolbar ||
        !toolbarSearch ||
        !toolbarRail ||
        !viewSwitch ||
        !activeViewButton
      ) {
        throw new Error("Course visual contract elements are missing");
      }

      const shellStyle = getComputedStyle(shell);
      const pageHeaderStyle = getComputedStyle(pageHeader);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const buttonStyle = getComputedStyle(primaryButton);
      const headerStyle = getComputedStyle(header);
      const navPillStyle = getComputedStyle(navPill);
      const userTriggerStyle = getComputedStyle(userTrigger);
      const toolbarStyle = getComputedStyle(toolbar);
      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarSearchRect = toolbarSearch.getBoundingClientRect();
      const toolbarRailRect = toolbarRail.getBoundingClientRect();
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();

      return {
        shellBackgroundColor: shellStyle.backgroundColor,
        shellBackgroundImage: shellStyle.backgroundImage,
        topNavPosition: getComputedStyle(topNav).position,
        headerHeight: headerStyle.height,
        headerRadius: headerStyle.borderRadius,
        titleFontFamily: titleStyle.fontFamily,
        titleFontSize: titleStyle.fontSize,
        titleFontWeight: titleStyle.fontWeight,
        pageHeaderLayout: {
          minHeight: pageHeaderStyle.minHeight,
          height: pageHeaderRect.height,
          actionCenterDelta: Math.abs(
            headerActionsRect.top +
              headerActionsRect.height / 2 -
              (pageHeaderRect.top + pageHeaderRect.height / 2),
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
        bodyFontFamily: getComputedStyle(document.body).fontFamily,
        buttonRadius: buttonStyle.borderRadius,
        buttonFontSize: buttonStyle.fontSize,
        buttonFontWeight: buttonStyle.fontWeight,
        navPillRadius: navPillStyle.borderRadius,
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
        viewGeometry: {
          shellHeight: getComputedStyle(viewSwitch).height,
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
    assert.equal(coursesVisual.topNavPosition, "sticky");
    assert.equal(coursesVisual.headerHeight, "68px");
    assert.equal(coursesVisual.headerRadius, "20px");
    assert.equal(coursesVisual.titleFontFamily, coursesVisual.bodyFontFamily);
    assert.equal(coursesVisual.titleFontSize, "48px");
    assert.equal(coursesVisual.titleFontWeight, "400");
    assert.equal(coursesVisual.pageHeaderLayout.minHeight, "200px");
    assert.ok(Math.abs(coursesVisual.pageHeaderLayout.height - 200) < 0.5);
    assert.ok(coursesVisual.pageHeaderLayout.actionCenterDelta < 0.5);
    assert.equal(coursesVisual.buttonRadius, "12px");
    assert.equal(coursesVisual.buttonFontWeight, "400");
    assert.equal(coursesVisual.navPillRadius, "12px");
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
    assert.deepEqual(coursesVisual.viewGeometry, {
      shellHeight: "40px",
      activeButtonHeight: "32px",
    });
    assert.deepEqual(coursesVisual.viewButtons, [
      { label: "Показать таблицей", pressed: "true" },
      { label: "Показать карточками", pressed: "false" },
    ]);
    assert.ok(
      Math.abs(Number.parseFloat(coursesVisual.buttonFontSize) - 14.08) < 0.1,
    );

    const courseFilterTrigger = runtime.page.locator(
      ".course-index-toolbar .course-filter-trigger",
    );
    assert.equal(
      await courseFilterTrigger.getAttribute("aria-expanded"),
      "false",
    );
    await courseFilterTrigger.click();
    const courseFilterGroup = runtime.page.getByRole("group", {
      name: "Фильтры курсов",
      exact: true,
    });
    await courseFilterGroup.waitFor();
    assert.equal(
      await courseFilterTrigger.getAttribute("aria-expanded"),
      "true",
    );
    const courseSubjectFilter = courseFilterGroup.getByLabel("Предмет");
    await courseSubjectFilter.selectOption({ label: "Английский язык" });
    assert.equal(
      await runtime.page
        .locator(".course-index-toolbar .course-filter-count")
        .textContent(),
      "1",
    );
    await courseFilterGroup
      .getByRole("button", { name: "Сбросить фильтры", exact: true })
      .click();
    assert.equal(await courseSubjectFilter.inputValue(), "all");
    await courseFilterTrigger.press("Escape");
    await runtime.page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    assert.equal(
      await runtime.page.evaluate(() =>
        document.activeElement?.classList.contains("course-filter-trigger"),
      ),
      true,
    );
    assert.equal(
      await courseFilterTrigger.getAttribute("aria-expanded"),
      "false",
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
      const filter = rail?.querySelector<HTMLElement>(".course-filter-menu");
      const view = rail?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Вид каталога курсов"]',
      );
      if (!toolbar || !search || !audience || !rail || !filter || !view) {
        throw new Error("Catalog toolbar contract is missing");
      }
      const style = getComputedStyle(toolbar);
      const rect = toolbar.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();
      const audienceRect = audience.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const filterRect = filter.getBoundingClientRect();
      const viewRect = view.getBoundingClientRect();
      const centerY = (elementRect: DOMRect) =>
        elementRect.top + elementRect.height / 2;
      return {
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        searchStartInset: searchRect.left - rect.left,
        filterAudienceGap: audienceRect.left - filterRect.right,
        audienceViewGap: viewRect.left - audienceRect.right,
        audienceFilterCenterDelta: centerY(audienceRect) - centerY(filterRect),
        audienceViewCenterDelta: centerY(audienceRect) - centerY(viewRect),
        railEndInset: rect.right - railRect.right,
        searchBeforeRail: Boolean(
          search.compareDocumentPosition(rail) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        filterBeforeAudience: Boolean(
          filter.compareDocumentPosition(audience) &
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
    assert.ok(catalogToolbarContract.filterAudienceGap >= 0);
    assert.ok(catalogToolbarContract.audienceViewGap >= 0);
    assert.ok(Math.abs(catalogToolbarContract.audienceFilterCenterDelta) < 0.5);
    assert.ok(Math.abs(catalogToolbarContract.audienceViewCenterDelta) < 0.5);
    assert.ok(Math.abs(catalogToolbarContract.railEndInset) < 0.5);
    assert.equal(catalogToolbarContract.searchBeforeRail, true);
    assert.equal(catalogToolbarContract.filterBeforeAudience, true);
    assert.equal(catalogToolbarContract.audienceBeforeView, true);
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
      .getByText(E2E_EDUCATOR_COURSE_TITLE, { exact: true })
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
      .getByText(E2E_EDUCATOR_COURSE_TITLE, { exact: true })
      .waitFor();
    assert.equal(
      await runtime.page
        .getByText("Не удалось связаться с каталогом курсов.", { exact: true })
        .count(),
      0,
    );

    const catalogFilterTrigger = runtime.page.locator(
      ".course-catalog-toolbar .course-filter-trigger",
    );
    await catalogFilterTrigger.click();
    await runtime.page
      .getByRole("group", {
        name: "Фильтры каталога курсов",
        exact: true,
      })
      .waitFor();
    const catalogFilterBounds = await runtime.page.evaluate(() => {
      const popover = document.querySelector<HTMLElement>(
        ".course-catalog-toolbar .course-filter-popover",
      );
      if (!popover) throw new Error("Catalog filter popover is missing");
      const rect = popover.getBoundingClientRect();
      return {
        insideViewport:
          rect.left >= 0 && rect.right <= document.documentElement.clientWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    assert.deepEqual(catalogFilterBounds, {
      insideViewport: true,
      clientWidth: catalogFilterBounds.clientWidth,
      scrollWidth: catalogFilterBounds.clientWidth,
    });
    await catalogFilterTrigger.press("Escape");

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
    const publishedHeaderActions = runtime.page.locator(
      ".published-course-workspace .app-page-actions",
    );
    assert.equal(
      await runtime.page
        .locator(".published-course-workspace .app-page-eyebrow")
        .count(),
      0,
    );
    assert.equal(
      await publishedHeaderActions.getByText("ShiDao", { exact: true }).count(),
      0,
    );
    await publishedHeaderActions
      .getByText("Автор: adult-e2e@example.test", { exact: true })
      .waitFor();
    await publishedHeaderActions
      .getByText("Аттестован", { exact: true })
      .waitFor();
    const publishedHeaderGeometry = await runtime.page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(
        ".published-course-workspace .app-page-header",
      );
      const content = header?.querySelector<HTMLElement>(
        ".app-page-header-content",
      );
      const title = header?.querySelector<HTMLElement>(".app-page-title");
      const actions = header?.querySelector<HTMLElement>(".app-page-actions");
      const attestation = actions?.querySelector<HTMLElement>(
        ".published-course-header-status",
      );
      const author = actions?.querySelector<HTMLElement>(
        ".published-course-header-author",
      );
      if (
        !header ||
        !content ||
        !title ||
        !actions ||
        !attestation ||
        !author
      ) {
        throw new Error("Published Course header geometry is missing");
      }

      const headerStyle = getComputedStyle(header);
      const headerRect = header.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      const attestationRect = attestation.getBoundingClientRect();
      const authorRect = author.getBoundingClientRect();
      const actionChildRects = Array.from(actions.children)
        .map((child) => child.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const actionContentWidth = actionChildRects.length
        ? Math.max(...actionChildRects.map((rect) => rect.right)) -
          Math.min(...actionChildRects.map((rect) => rect.left))
        : 0;

      return {
        titleUsesHeadingColumn: Math.abs(titleRect.width - contentRect.width),
        actionsFitContent: Math.abs(actionsRect.width - actionContentWidth),
        attestationAboveAuthor: attestationRect.bottom <= authorRect.top,
        columnGap: actionsRect.left - contentRect.right,
        remainingWidthDelta: Math.abs(
          contentRect.width -
            (headerRect.width -
              Number.parseFloat(headerStyle.paddingLeft) -
              Number.parseFloat(headerStyle.paddingRight) -
              actionsRect.width -
              24),
        ),
      };
    });
    assert.ok(publishedHeaderGeometry.titleUsesHeadingColumn < 0.5);
    assert.ok(publishedHeaderGeometry.actionsFitContent < 0.5);
    assert.equal(publishedHeaderGeometry.attestationAboveAuthor, true);
    assert.ok(Math.abs(publishedHeaderGeometry.columnGap - 24) < 0.5);
    assert.ok(publishedHeaderGeometry.remainingWidthDelta < 0.5);
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
      .getByRole("button", { name: "Показать все курсы", exact: true })
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
      "0px",
      "0px",
      "0px",
      "0px",
    ]);
    assert.equal(ownedCourseTableSurface.wrapperBorderRadius, "12px");
    assert.notEqual(ownedCourseTableSurface.wrapperBoxShadow, "none");
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
      boxShadow: "rgba(20, 20, 20, 0.18) 0px 18px 46px 0px",
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

    await Promise.all([
      runtime.page.waitForURL(new RegExp(`/courses/${E2E_COURSE_ID}$`)),
      courseLink.click(),
    ]);

    const courseHeading = runtime.page.getByRole("heading", {
      name: E2E_COURSE_TITLE,
      exact: true,
      level: 1,
    });
    await courseHeading.waitFor();
    const courseVisual = await runtime.page.evaluate(() => {
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
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
        !pageHeaderContent ||
        !title ||
        !description ||
        !tab ||
        !inactiveTab ||
        !tabs ||
        !headerActions ||
        !backLink ||
        !backIcon ||
        !backLabel ||
        !siteHeader
      ) {
        throw new Error(
          "Course workspace visual contract elements are missing",
        );
      }

      const headerStyle = getComputedStyle(pageHeader);
      const headingStyle = getComputedStyle(pageHeading);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const tabsStyle = getComputedStyle(tabs);
      const tabStyle = getComputedStyle(tab);
      const inactiveTabStyle = getComputedStyle(inactiveTab);
      const markerStyle = getComputedStyle(tab, "::after");
      const baselineStyle = getComputedStyle(tabs, "::before");
      const baselineScaleY = new DOMMatrixReadOnly(baselineStyle.transform).m22;
      const tabRect = tab.getBoundingClientRect();
      const tabsRect = tabs.getBoundingClientRect();
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const pageHeaderContentRect = pageHeaderContent.getBoundingClientRect();
      const pageHeadingRect = pageHeading.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();
      const backLinkRect = backLink.getBoundingClientRect();
      const siteHeaderRect = siteHeader.getBoundingClientRect();
      const actionChildRects = Array.from(headerActions.children)
        .map((child) => child.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
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
          titleWidthDelta: Math.abs(titleRect.width - pageHeadingRect.width),
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
          columnGap: headerActionsRect.left - pageHeaderContentRect.right,
          remainingWidthDelta: Math.abs(
            pageHeaderContentRect.width -
              (pageHeaderRect.width -
                Number.parseFloat(headerStyle.paddingLeft) -
                Number.parseFloat(headerStyle.paddingRight) -
                headerActionsRect.width -
                24),
          ),
          actionCenterDelta: Math.abs(
            headerActionsRect.top +
              headerActionsRect.height / 2 -
              (pageHeaderRect.top + pageHeaderRect.height / 2),
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
    assert.equal(courseVisual.headerLayout.minHeight, "200px");
    assert.ok(Math.abs(courseVisual.headerLayout.height - 200) < 0.5);
    assert.equal(
      courseVisual.headerLayout.height,
      coursesVisual.pageHeaderLayout.height,
    );
    assert.ok(courseVisual.headerLayout.actionCenterDelta < 0.5);
    assert.equal(courseVisual.headerLayout.headingMinWidth, "0px");
    assert.ok(
      courseVisual.headerLayout.headingWidth >
        courseVisual.headerLayout.actionsWidth,
    );
    assert.ok(courseVisual.headerLayout.actionsContentWidth > 0);
    assert.ok(courseVisual.headerLayout.actionsFitContentDelta < 0.5);
    assert.ok(courseVisual.headerLayout.actionsRightDelta < 0.5);
    assert.ok(courseVisual.headerLayout.titleWidthDelta < 0.5);
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
      courseVisual.headerSignature,
      coursesVisual.headerSignature,
    );
    assert.deepEqual(courseVisual.tabSignature, {
      height: "40px",
      radius: "12px 12px 0px 0px",
      fontWeight: "400",
      activeColor: "rgb(20, 20, 20)",
      inactiveColor: "rgba(20, 20, 20, 0.5)",
      gap: "12px",
      tabZIndex: "auto",
      baselinePaintHeight: "3px",
      baselineScaleY: 0.4,
      baselineVisualHeight: 1.2,
      baselineColor: "rgba(20, 20, 20, 0.5)",
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
      "0px",
      "0px",
      "0px",
      "0px",
    ]);
    assert.equal(courseLessonsVisual.wrapperBorderRadius, "12px");
    assert.notEqual(courseLessonsVisual.wrapperBoxShadow, "none");
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
    await runtime.page
      .getByRole("link", {
        name: `4. ${E2E_LESSON_TITLE}`,
        exact: true,
      })
      .click();

    const lessonHeading = runtime.page.getByRole("heading", {
      name: `Урок 4. ${E2E_LESSON_TITLE}`,
      exact: true,
      level: 1,
    });
    await lessonHeading.waitFor();
    const lessonVisual = await runtime.page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".course-demo-shell");
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
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
      const headerActionButtons = Array.from(
        headerActions?.querySelectorAll<HTMLButtonElement>(
          ".product-btn-secondary",
        ) ?? [],
      );

      if (
        !shell ||
        !pageHeader ||
        !title ||
        !description ||
        !headerActions ||
        !tab ||
        !inactiveTab ||
        !tabs
      ) {
        throw new Error("Lesson visual contract elements are missing");
      }
      if (headerActionButtons.length !== 4) {
        throw new Error("Lesson header action button contract is incomplete");
      }

      const pageHeaderStyle = getComputedStyle(pageHeader);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const tabsStyle = getComputedStyle(tabs);
      const tabStyle = getComputedStyle(tab);
      const inactiveTabStyle = getComputedStyle(inactiveTab);
      const markerStyle = getComputedStyle(tab, "::after");
      const baselineStyle = getComputedStyle(tabs, "::before");
      const baselineScaleY = new DOMMatrixReadOnly(baselineStyle.transform).m22;
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();
      return {
        shellBackgroundImage: getComputedStyle(shell).backgroundImage,
        headerLayout: {
          minHeight: pageHeaderStyle.minHeight,
          height: pageHeaderRect.height,
          actionCenterDelta: Math.abs(
            headerActionsRect.top +
              headerActionsRect.height / 2 -
              (pageHeaderRect.top + pageHeaderRect.height / 2),
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
        headerActionButtons: headerActionButtons.map((button) => {
          const style = getComputedStyle(button);
          return {
            label: button.textContent?.trim().replace(/\s+/g, " ") ?? "",
            isDanger: button.classList.contains("product-btn-danger"),
            offsetHeight: button.offsetHeight,
            clientHeight: button.clientHeight,
            height: style.height,
            boxSizing: style.boxSizing,
            borderTopWidth: style.borderTopWidth,
            borderBottomWidth: style.borderBottomWidth,
            borderColor: style.borderColor,
            backgroundColor: style.backgroundColor,
            boxShadow: style.boxShadow,
            color: style.color,
          };
        }),
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
          allTabsHaveIcons: Array.from(
            tabs.querySelectorAll<HTMLElement>(".workspace-tab"),
          ).every((item) => Boolean(item.querySelector(".workspace-tab-icon"))),
        },
      };
    });

    assert.equal(lessonVisual.shellBackgroundImage, "none");
    assert.equal(lessonVisual.headerLayout.minHeight, "200px");
    assert.ok(Math.abs(lessonVisual.headerLayout.height - 200) < 0.5);
    assert.equal(
      lessonVisual.headerLayout.height,
      coursesVisual.pageHeaderLayout.height,
    );
    assert.ok(lessonVisual.headerLayout.actionCenterDelta < 0.5);
    assert.deepEqual(
      lessonVisual.headerSignature,
      coursesVisual.headerSignature,
    );
    assert.equal(lessonVisual.headerActionButtons.length, 4);
    for (const button of lessonVisual.headerActionButtons) {
      assert.equal(button.offsetHeight, 40);
      assert.equal(button.clientHeight, 40);
      assert.equal(button.height, "40px");
      assert.equal(button.boxSizing, "border-box");
      assert.equal(button.borderTopWidth, "0px");
      assert.equal(button.borderBottomWidth, "0px");
      assert.equal(button.backgroundColor, "rgb(255, 255, 255)");
      assert.equal(button.boxShadow, E2E_RAISED_CONTROL_SHADOW);
    }
    const lessonDeleteAction = lessonVisual.headerActionButtons.find(
      (button) => button.label === "Удалить",
    );
    assert.ok(lessonDeleteAction);
    assert.equal(lessonDeleteAction.isDanger, true);
    assert.equal(lessonDeleteAction.color, "rgb(190, 18, 60)");

    const lessonDeleteButton = runtime.page.getByRole("button", {
      name: "Удалить",
      exact: true,
    });
    await lessonDeleteButton.hover();
    await runtime.page.waitForTimeout(220);
    assert.deepEqual(
      await lessonDeleteButton.evaluate((button) => {
        const style = getComputedStyle(button);
        return {
          borderTopWidth: style.borderTopWidth,
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
        };
      }),
      {
        borderTopWidth: "0px",
        backgroundColor: "rgb(255, 255, 255)",
        boxShadow: E2E_RAISED_CONTROL_HOVER_SHADOW,
      },
    );
    assert.deepEqual(lessonVisual.tabSignature, courseVisual.tabSignature);

    await runtime.page.setViewportSize({ width: 1120, height: 900 });
    const narrowLessonHeader = await runtime.page.evaluate(() => {
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
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
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const backLabelStyle = getComputedStyle(backLabel);
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const pageHeaderContentRect = pageHeaderContent.getBoundingClientRect();
      const pageHeadingRect = pageHeading.getBoundingClientRect();
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
        headingOwnsContentDelta: Math.abs(pageHeadingRect.width - contentWidth),
        actionsInsideHeader:
          actionsRect.left >=
            pageHeaderRect.left +
              Number.parseFloat(headerStyle.paddingLeft) -
              0.5 &&
          actionsRect.right <=
            pageHeaderRect.right -
              Number.parseFloat(headerStyle.paddingRight) +
              0.5,
        actionsDoNotOverlapHeading:
          actionsRect.top >= pageHeaderContentRect.bottom - 0.5,
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
        actionsInsideHeader: narrowLessonHeader.actionsInsideHeader,
        actionsDoNotOverlapHeading:
          narrowLessonHeader.actionsDoNotOverlapHeading,
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
        actionsInsideHeader: true,
        actionsDoNotOverlapHeading: true,
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
        cardBoxShadow: cardStyle.boxShadow,
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
      "0px",
      "0px",
      "0px",
      "0px",
    ]);
    assert.equal(fileComponentCardVisual.cardBackground, "rgb(255, 255, 255)");
    assert.equal(
      fileComponentCardVisual.cardBoxShadow,
      "rgba(0, 0, 0, 0.05) 0px 3px 6px 0px",
    );
    assert.equal(fileComponentCardVisual.cardTransitionProperty, "box-shadow");
    assert.equal(fileComponentCardVisual.cardTransitionDuration, "0.18s");
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
        cardBoxShadow: "rgba(0, 0, 0, 0.1) 0px 3px 12px 0px",
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
        };
      }),
      {
        opacity: "0",
        cardBoxShadow: "rgba(0, 0, 0, 0.05) 0px 3px 6px 0px",
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
        cardBoxShadow: "rgba(0, 0, 0, 0.1) 0px 3px 12px 0px",
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
        if (!editor || controls.length === 0) {
          throw new Error("Modal component editor controls are missing");
        }
        const dialogRect = dialog.getBoundingClientRect();
        const editorStyle = getComputedStyle(editor);
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

    await runtime.page
      .getByRole("button", {
        name: `Вернуться: ${E2E_COURSE_TITLE}`,
        exact: true,
      })
      .click();
    await courseHeading.waitFor();

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
  });

  try {
    await runtime.page.goto("/courses", { waitUntil: "networkidle" });
    const mobileCourseLink = runtime.page.getByRole("link", {
      name: E2E_COURSE_TITLE,
      exact: true,
    });
    await mobileCourseLink.waitFor();

    const mobileCoursesToolbar = await runtime.page.evaluate(() => {
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const pageHeading =
        pageHeader?.querySelector<HTMLElement>(".app-page-heading");
      const headerActions =
        pageHeader?.querySelector<HTMLElement>(".app-page-actions");
      const headerAction = headerActions?.firstElementChild;
      const toolbar = document.querySelector<HTMLElement>(
        ".course-index-toolbar",
      );
      const toolbarSearch = toolbar?.querySelector<HTMLElement>(
        ".compact-toolbar-search",
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
        !pageHeader ||
        !pageHeading ||
        !headerActions ||
        !headerAction ||
        !toolbar ||
        !toolbarSearch ||
        !toolbarRail ||
        !viewSwitch ||
        !activeViewButton
      ) {
        throw new Error("Mobile Courses toolbar controls are missing");
      }
      const viewportWidth = document.documentElement.clientWidth;
      const pageHeaderStyle = getComputedStyle(pageHeader);
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const pageHeadingRect = pageHeading.getBoundingClientRect();
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
      return {
        clientWidth: viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        pageHeader: {
          contentWidth: pageHeaderContentWidth,
          headingWidth: pageHeadingRect.width,
          actionsWidth: headerActionsRect.width,
          actionWidth: headerActionRect.width,
          actionsFitContentDelta: Math.abs(
            headerActionsRect.width - headerActionRect.width,
          ),
          headingOwnsContentDelta: Math.abs(
            pageHeadingRect.width - pageHeaderContentWidth,
          ),
          actionsInsideViewport:
            headerActionsRect.left >= 0 &&
            headerActionsRect.right <= viewportWidth,
        },
        toolbarInsideViewport:
          toolbarRect.left >= 0 && toolbarRect.right <= viewportWidth,
        toolbarPaddingLeft: toolbarStyle.paddingLeft,
        toolbarPaddingRight: toolbarStyle.paddingRight,
        searchStartInset: toolbarSearchRect.left - toolbarRect.left,
        railEndInset: toolbarRect.right - toolbarRailRect.right,
        shellHeight: getComputedStyle(viewSwitch).height,
        activeButtonHeight: getComputedStyle(activeViewButton).height,
        activeLabel: activeViewButton.getAttribute("aria-label"),
        activePressed: activeViewButton.getAttribute("aria-pressed"),
        viewButtons: Array.from(viewSwitch.querySelectorAll("button")).map(
          (button) => button.getAttribute("aria-label"),
        ),
      };
    });
    assert.deepEqual(
      {
        clientWidth: mobileCoursesToolbar.clientWidth,
        scrollWidth: mobileCoursesToolbar.scrollWidth,
        toolbarInsideViewport: mobileCoursesToolbar.toolbarInsideViewport,
        toolbarPaddingLeft: mobileCoursesToolbar.toolbarPaddingLeft,
        toolbarPaddingRight: mobileCoursesToolbar.toolbarPaddingRight,
        shellHeight: mobileCoursesToolbar.shellHeight,
        activeButtonHeight: mobileCoursesToolbar.activeButtonHeight,
        activeLabel: mobileCoursesToolbar.activeLabel,
        activePressed: mobileCoursesToolbar.activePressed,
        viewButtons: mobileCoursesToolbar.viewButtons,
      },
      {
        clientWidth: 375,
        scrollWidth: 375,
        toolbarInsideViewport: true,
        toolbarPaddingLeft: "0px",
        toolbarPaddingRight: "0px",
        shellHeight: "40px",
        activeButtonHeight: "32px",
        activeLabel: "Показать таблицей",
        activePressed: "true",
        viewButtons: ["Показать таблицей", "Показать карточками"],
      },
    );
    assert.ok(mobileCoursesToolbar.pageHeader.contentWidth > 0);
    assert.ok(Math.abs(mobileCoursesToolbar.searchStartInset) < 0.5);
    assert.ok(Math.abs(mobileCoursesToolbar.railEndInset) < 0.5);
    assert.ok(mobileCoursesToolbar.pageHeader.actionWidth > 0);
    assert.ok(
      mobileCoursesToolbar.pageHeader.headingWidth >
        mobileCoursesToolbar.pageHeader.actionsWidth,
    );
    assert.ok(mobileCoursesToolbar.pageHeader.actionsFitContentDelta < 0.5);
    assert.ok(mobileCoursesToolbar.pageHeader.headingOwnsContentDelta < 0.5);
    assert.equal(mobileCoursesToolbar.pageHeader.actionsInsideViewport, true);

    const mobileCourseFilterTrigger = runtime.page.locator(
      ".course-index-toolbar .course-filter-trigger",
    );
    await mobileCourseFilterTrigger.click();
    await runtime.page
      .getByRole("group", { name: "Фильтры курсов", exact: true })
      .waitFor();
    const mobileFilterPopover = await runtime.page.evaluate(() => {
      const popover = document.querySelector<HTMLElement>(
        ".course-index-toolbar .course-filter-popover",
      );
      if (!popover) throw new Error("Mobile course filter popover is missing");
      const viewportWidth = document.documentElement.clientWidth;
      const rect = popover.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        insideViewport: rect.left >= 0 && rect.right <= viewportWidth,
      };
    });
    assert.deepEqual(mobileFilterPopover, {
      scrollWidth: 375,
      insideViewport: true,
    });
    await mobileCourseFilterTrigger.press("Escape");

    await runtime.page
      .getByRole("tab", { name: "Каталог", exact: true })
      .click();
    await runtime.page.waitForURL(/\/courses\?tab=catalog$/);
    const mobileCatalogView = runtime.page.getByRole("group", {
      name: "Вид каталога курсов",
      exact: true,
    });
    await mobileCatalogView.waitFor();
    const mobileCatalogToolbar = await runtime.page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(
        ".course-catalog-toolbar",
      );
      const search = toolbar?.querySelector<HTMLElement>(
        ".compact-toolbar-search",
      );
      const rail = toolbar?.querySelector<HTMLElement>(".compact-toolbar-rail");
      const viewSwitch = toolbar?.querySelector<HTMLElement>(
        '[role="group"][aria-label="Вид каталога курсов"]',
      );
      const filter = rail?.querySelector<HTMLElement>(".course-filter-menu");
      const audience = rail?.querySelector<HTMLElement>(
        ".course-catalog-audience-control",
      );
      if (!toolbar || !search || !rail || !viewSwitch || !filter || !audience) {
        throw new Error("Mobile Catalog toolbar controls are missing");
      }
      const viewportWidth = document.documentElement.clientWidth;
      const rect = toolbar.getBoundingClientRect();
      const style = getComputedStyle(toolbar);
      const searchRect = search.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const audienceRect = audience.getBoundingClientRect();
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
        filterBeforeAudience: Boolean(
          filter.compareDocumentPosition(audience) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        audienceBeforeView: Boolean(
          audience.compareDocumentPosition(viewSwitch) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        shellHeight: getComputedStyle(viewSwitch).height,
        visibleResultCount: toolbar.querySelectorAll(".compact-toolbar-result")
          .length,
      };
    });
    assert.deepEqual(mobileCatalogToolbar, {
      scrollWidth: 375,
      insideViewport: true,
      paddingLeft: "0px",
      paddingRight: "0px",
      searchStartInset: 0,
      railEndInset: 0,
      audienceInsideViewport: true,
      audienceInsideRail: true,
      searchBeforeRail: true,
      filterBeforeAudience: true,
      audienceBeforeView: true,
      shellHeight: "40px",
      visibleResultCount: 0,
    });
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
    const mobileCourseLessons = await runtime.page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(
        ".course-lessons-toolbar",
      );
      const wrapper = document.querySelector<HTMLElement>(
        ".course-lessons-table-wrap",
      );
      const addButton = toolbar?.querySelector<HTMLElement>(".product-btn");
      if (!toolbar || !wrapper || !addButton) {
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
      const title = pageHeader?.querySelector<HTMLElement>(".app-page-title");
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
        !title ||
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
      const backLinkStyle = getComputedStyle(backLink);
      const backIconStyle = getComputedStyle(backIcon);
      const backLabelStyle = getComputedStyle(backLabel);
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const pageHeaderContentRect = pageHeaderContent.getBoundingClientRect();
      const pageHeadingRect = pageHeading.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const backLinkRect = backLink.getBoundingClientRect();
      const backLabelRect = backLabel.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
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
          actionsBelowContent:
            actionsRect.top >= pageHeaderContentRect.bottom - 0.5,
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
        actionsBelowContent: mobileVisual.pageHeader.actionsBelowContent,
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
        actionsBelowContent: true,
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
    assert.ok(mobileVisual.pageHeader.backLabelSingleLineDelta < 0.5);
    assert.ok(Math.abs(mobileVisual.pageHeader.headerToBackGap - 16) < 0.5);
    assert.ok(Math.abs(mobileVisual.pageHeader.backToHeadingGap - 16) < 0.5);
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
    assert.ok(mobileVisual.selectedTabLeft >= mobileVisual.tabStripLeft - 1);
    assert.ok(mobileVisual.selectedTabRight <= mobileVisual.tabStripRight + 1);
  } finally {
    await runtime.close();
  }
});
