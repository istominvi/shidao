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
const E2E_LESSON_ID = "44444444-4444-4444-8444-444444444444";
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

const E2E_COURSE_ROW = {
  id: E2E_COURSE_ID,
  owner_account_id: E2E_ACCOUNT_ID,
  title: E2E_COURSE_TITLE,
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

const E2E_LESSON_ROW = {
  id: E2E_LESSON_ID,
  course_id: E2E_COURSE_ID,
  position: 4,
  title: E2E_LESSON_TITLE,
  summary: "Связываем форму времени с реальными историями ученика.",
  components: [],
  studentSlides: [],
  created_at: "2026-08-05T08:30:00.000Z",
  updated_at: "2026-08-05T09:00:00.000Z",
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
const e2eSupabaseReferers: string[] = [];

type PlaywrightLocator = {
  click: () => Promise<void>;
  check: () => Promise<void>;
  fill: (value: string) => Promise<void>;
  inputValue: () => Promise<string>;
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
  waitFor: (options?: {
    state?: "attached" | "detached" | "visible" | "hidden";
    timeout?: number;
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
        url: () => string;
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

  if (
    requestUrl.pathname === "/rest/v1/rpc/delete_learner_group" ||
    requestUrl.pathname === "/rest/v1/rpc/replace_course_audience" ||
    requestUrl.pathname === "/rest/v1/rpc/replace_course_learners"
  ) {
    json(response, 200, null);
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
    json(
      response,
      200,
      requestedCourseId && requestedCourseId !== E2E_COURSE_ID
        ? []
        : [E2E_COURSE_ROW],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course_publication") {
    json(response, 200, []);
    return;
  }

  if (
    requestUrl.pathname === "/rest/v1/rpc/list_course_publication_catalog_admin"
  ) {
    json(response, 200, {
      courses: [],
      facets: { subjects: [], levels: [] },
      nextOffset: null,
    });
    return;
  }

  if (requestUrl.pathname === "/rest/v1/lesson") {
    const courseFilter = requestUrl.searchParams.get("course_id");
    if (courseFilter && !courseFilter.includes(E2E_COURSE_ID)) {
      json(response, 200, []);
      return;
    }

    const select = requestUrl.searchParams.get("select") ?? "";
    json(
      response,
      200,
      select.includes("components:lesson_component")
        ? [E2E_LESSON_ROW]
        : [{ id: E2E_LESSON_ID, course_id: E2E_COURSE_ID }],
    );
    return;
  }

  if (requestUrl.pathname === "/rest/v1/course_attachment") {
    json(response, 200, []);
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

  for (const protectedPath of ["/courses", "/schedule", "/students"]) {
    const runtime = await openPage();
    try {
      await runtime.page.goto(protectedPath, { waitUntil: "domcontentloaded" });
      assert.equal(new URL(runtime.page.url()).pathname, "/login");
    } finally {
      await runtime.close();
    }
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
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("heading", { name: "Расписание", exact: true, level: 1 })
      .waitFor();
    await runtime.page
      .getByRole("heading", { name: "Занятий нет", exact: true, level: 2 })
      .waitFor();

    const scheduleContract = await runtime.page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".course-demo-shell");
      const pageHeader =
        document.querySelector<HTMLElement>(".app-page-header");
      const title = document.querySelector<HTMLElement>(".app-page-title");
      const description = document.querySelector<HTMLElement>(
        ".app-page-description",
      );
      const headerActions =
        document.querySelector<HTMLElement>(".app-page-actions");
      const toolbar = document.querySelector<HTMLElement>(
        ".teaching-hub-toolbar",
      );
      const navLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          ".site-header-shell-demo .site-header-nav-pill",
        ),
      ).map((link) => ({
        label: link.textContent?.trim() ?? "",
        href: link.getAttribute("href"),
        current: link.getAttribute("aria-current"),
      }));

      if (
        !shell ||
        !pageHeader ||
        !title ||
        !description ||
        !headerActions ||
        !toolbar
      ) {
        throw new Error("Schedule shell contract is missing");
      }

      const pageHeaderStyle = getComputedStyle(pageHeader);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();

      return {
        backgroundColor: getComputedStyle(shell).backgroundColor,
        backgroundImage: getComputedStyle(shell).backgroundImage,
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
        },
        headerActions: headerActions.textContent?.trim() ?? "",
        toolbarText: toolbar.textContent?.trim() ?? "",
        navLinks,
      };
    });

    assert.equal(scheduleContract.backgroundColor, "rgb(245, 241, 232)");
    assert.equal(scheduleContract.backgroundImage, "none");
    assert.equal(scheduleContract.headerLayout.minHeight, "200px");
    assert.ok(Math.abs(scheduleContract.headerLayout.height - 200) < 0.5);
    assert.ok(scheduleContract.headerLayout.actionCenterDelta < 0.5);
    assert.equal(scheduleContract.headerSignature.titleFontWeight, "400");
    assert.match(scheduleContract.headerActions, /Назначить урок в курсе/);
    assert.doesNotMatch(scheduleContract.toolbarText, /Назначить урок в курсе/);
    assert.deepEqual(scheduleContract.navLinks, [
      { label: "Расписание", href: "/schedule", current: "page" },
      { label: "Ученики", href: "/students", current: null },
      { label: "Курсы", href: "/courses", current: null },
    ]);

    let html = await runtime.page.content();
    assert.match(html, /Занятий нет/);
    assert.match(html, /Назначить урок в курсе/);
    assert.doesNotMatch(html, /Миша Орлов|Food around the world/);

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
      .getByRole("table", { name: "Ученики и их группы", exact: true })
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
      const tabs = document.querySelector<HTMLElement>(".workspace-tabs");
      const tabsScroll = document.querySelector<HTMLElement>(
        ".workspace-tabs-scroll",
      );
      const headerActions =
        document.querySelector<HTMLElement>(".app-page-actions");
      const toolbar = document.querySelector<HTMLElement>(
        ".student-directory-toolbar",
      );

      if (
        !pageHeader ||
        !title ||
        !description ||
        !activeTab ||
        !tabs ||
        !tabsScroll ||
        !headerActions ||
        !toolbar
      ) {
        throw new Error("Students visual contract is missing");
      }

      const pageHeaderStyle = getComputedStyle(pageHeader);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const tabsStyle = getComputedStyle(tabs);
      const tabStyle = getComputedStyle(activeTab);
      const markerStyle = getComputedStyle(activeTab, "::after");
      const baselineStyle = getComputedStyle(tabs, "::before");
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();
      const tabsScrollRect = tabsScroll.getBoundingClientRect();
      const tabsRect = tabs.getBoundingClientRect();
      const activeTabRect = activeTab.getBoundingClientRect();
      const baselineLeft = Number.parseFloat(baselineStyle.left);
      const baselineRight = Number.parseFloat(baselineStyle.right);

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
        },
        tabSignature: {
          height: tabStyle.height,
          radius: tabStyle.borderRadius,
          fontWeight: tabStyle.fontWeight,
          baselineHeight: baselineStyle.height,
          baselineColor: baselineStyle.backgroundColor,
          baselineLeft: baselineStyle.left,
          baselineRight: baselineStyle.right,
          tabsPaddingLeft: tabsStyle.paddingLeft,
          tabsPaddingRight: tabsStyle.paddingRight,
          markerHeight: markerStyle.height,
          markerColor: markerStyle.backgroundColor,
          markerRadius: markerStyle.borderRadius,
          markerBottom: markerStyle.bottom,
        },
        tabGeometry: {
          firstTabIsActive:
            activeTab === tabs.querySelector<HTMLElement>(".workspace-tab"),
          activeStartInset: activeTabRect.left - tabsScrollRect.left,
          baselineStartInset:
            tabsRect.left + baselineLeft - tabsScrollRect.left,
          baselineEndInset:
            tabsScrollRect.right - (tabsRect.right - baselineRight),
        },
        headerActions: headerActions.textContent?.trim() ?? "",
        toolbarText: toolbar.textContent?.trim() ?? "",
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
      radius: "0px",
      fontWeight: "500",
      baselineHeight: "1px",
      baselineColor: "rgb(20, 20, 20)",
      baselineLeft: "12px",
      baselineRight: "12px",
      tabsPaddingLeft: "12px",
      tabsPaddingRight: "12px",
      markerHeight: "4px",
      markerColor: "rgb(20, 20, 20)",
      markerRadius: "0px",
      markerBottom: "0px",
    });
    assert.equal(studentsVisual.tabGeometry.firstTabIsActive, true);
    assert.ok(Math.abs(studentsVisual.tabGeometry.activeStartInset - 12) < 0.5);
    assert.ok(
      Math.abs(studentsVisual.tabGeometry.baselineStartInset - 12) < 0.5,
    );
    assert.ok(Math.abs(studentsVisual.tabGeometry.baselineEndInset - 12) < 0.5);
    assert.ok(
      Math.abs(
        studentsVisual.tabGeometry.activeStartInset -
          studentsVisual.tabGeometry.baselineStartInset,
      ) < 0.5,
    );
    assert.match(studentsVisual.headerActions, /Новый ученик/);
    assert.doesNotMatch(studentsVisual.toolbarText, /Новый ученик/);

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
    await runtime.page
      .getByRole("table", { name: "Группы учеников", exact: true })
      .waitFor();
    html = await runtime.page.content();
    assert.match(html, /Подготовка к экзамену/);
    assert.match(html, /2 ученика/);
    assert.match(html, /Новая группа/);

    const studentsCurrent = await runtime.page.evaluate(() =>
      document
        .querySelector<HTMLAnchorElement>(
          '.site-header-nav-pill[href="/students"]',
        )
        ?.getAttribute("aria-current"),
    );
    assert.equal(studentsCurrent, "page");
  } finally {
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
      name: "Наблюдение",
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
      name: "Наблюдение",
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

    await runtime.page
      .getByRole("button", { name: "Архив · 1", exact: true })
      .click();
    await runtime.page.getByText("Архивная Ольга", { exact: true }).waitFor();
    await runtime.page
      .getByRole("button", { name: "Восстановить", exact: true })
      .click();
    await runtime.page.getByText(/Ученик снова в активном списке/).waitFor();
    assert.equal(e2eArchivedLearnerRestored, true);

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
    const audienceButton = runtime.page.getByRole("button", {
      name: "Аудитория · 2",
      exact: true,
    });
    await audienceButton.waitFor();
    await audienceButton.click();
    await runtime.page
      .getByRole("heading", {
        name: "Аудитория курса",
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
      const dialogText = document
        .querySelector<HTMLElement>("[role='dialog']")
        ?.textContent?.replace(/\s+/g, " ")
        .trim();

      return {
        summary,
        selectedGroups,
        selectedDirectLearners,
        dialogText,
      };
    });

    assert.equal(
      audienceContract.summary,
      "Выбрано: 1 группа, 1 ученик отдельно · 2 ученика в курсе",
    );
    assert.equal(audienceContract.selectedGroups, 1);
    assert.equal(audienceContract.selectedDirectLearners, 1);
    assert.match(
      audienceContract.dialogText ?? "",
      /Уже входит через: Teen Talk/,
    );
    assert.match(
      audienceContract.dialogText ?? "",
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
    await runtime.page
      .getByRole("button", {
        name: "Идёт сейчас. Настроить проведение урока",
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

  const runtime = await openPage({
    cookie: authenticatedCookieValue(),
    viewport: { width: 375, height: 812 },
  });

  try {
    await runtime.page.goto("/schedule", { waitUntil: "networkidle" });
    await runtime.page
      .getByRole("button", { name: "Открыть меню пользователя", exact: true })
      .click();

    await runtime.page
      .getByRole("menuitem", { name: "Расписание", exact: true })
      .waitFor();
    await runtime.page
      .getByRole("menuitem", { name: "Курсы", exact: true })
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

    const mobileContract = await runtime.page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heading: document.querySelector("h1")?.textContent?.trim() ?? "",
    }));
    assert.equal(mobileContract.clientWidth, 375);
    assert.equal(mobileContract.scrollWidth, mobileContract.clientWidth);
    assert.equal(mobileContract.heading, "Ученики");
  } finally {
    await runtime.close();
  }
});

test("browser smoke: course opens lesson workspace and returns to the course", async (t) => {
  if (browserSmokeUnavailableReason) {
    t.skip(browserSmokeUnavailableReason);
    return;
  }

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
        !userTrigger
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
        },
        bodyFontFamily: getComputedStyle(document.body).fontFamily,
        buttonRadius: buttonStyle.borderRadius,
        buttonFontSize: buttonStyle.fontSize,
        buttonFontWeight: buttonStyle.fontWeight,
        navPillRadius: navPillStyle.borderRadius,
        navPillFontWeight: navPillStyle.fontWeight,
        userTriggerRadius: userTriggerStyle.borderRadius,
        userTriggerFontWeight: userTriggerStyle.fontWeight,
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
    assert.equal(coursesVisual.buttonFontWeight, "500");
    assert.equal(coursesVisual.navPillRadius, "12px");
    assert.equal(coursesVisual.navPillFontWeight, "500");
    assert.equal(coursesVisual.userTriggerRadius, "12px");
    assert.equal(coursesVisual.userTriggerFontWeight, "500");
    assert.ok(
      Math.abs(Number.parseFloat(coursesVisual.buttonFontSize) - 14.08) < 0.1,
    );

    await runtime.page
      .getByRole("tab", { name: "Каталог", exact: true })
      .click();
    await runtime.page.waitForURL(/\/courses\?tab=catalog$/);
    await runtime.page
      .getByRole("heading", { name: "Готовые курсы", exact: true, level: 2 })
      .waitFor();
    await runtime.page
      .getByRole("heading", {
        name: "В каталоге пока нет курсов",
        exact: true,
      })
      .waitFor();
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
      .getByRole("button", { name: "Таблица", exact: true })
      .click();
    await runtime.page
      .getByRole("region", { name: "Таблица курсов", exact: true })
      .waitFor();
    const tableViewPressed = await runtime.page.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .find((button) => button.textContent?.trim() === "Таблица")
        ?.getAttribute("aria-pressed"),
    );
    assert.equal(tableViewPressed, "true");
    await runtime.page
      .getByRole("button", { name: "Плитки", exact: true })
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
      const title = pageHeader?.querySelector<HTMLElement>(".app-page-title");
      const description = pageHeader?.querySelector<HTMLElement>(
        ".app-page-description",
      );
      const tab = document.querySelector<HTMLElement>(".workspace-tab-active");
      const tabs = document.querySelector<HTMLElement>(".workspace-tabs");
      const headerActions =
        pageHeader?.querySelector<HTMLElement>(".app-page-actions");

      if (
        !pageHeader ||
        !title ||
        !description ||
        !tab ||
        !tabs ||
        !headerActions
      ) {
        throw new Error(
          "Course workspace visual contract elements are missing",
        );
      }

      const headerStyle = getComputedStyle(pageHeader);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const tabsStyle = getComputedStyle(tabs);
      const tabStyle = getComputedStyle(tab);
      const markerStyle = getComputedStyle(tab, "::after");
      const baselineStyle = getComputedStyle(tabs, "::before");
      const tabRect = tab.getBoundingClientRect();
      const tabsRect = tabs.getBoundingClientRect();
      const pageHeaderRect = pageHeader.getBoundingClientRect();
      const headerActionsRect = headerActions.getBoundingClientRect();

      return {
        headerBackgroundColor: headerStyle.backgroundColor,
        headerBackgroundImage: headerStyle.backgroundImage,
        headerBorderWidth: headerStyle.borderWidth,
        headerShadow: headerStyle.boxShadow,
        headerLayout: {
          minHeight: headerStyle.minHeight,
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
        },
        tabSignature: {
          height: tabStyle.height,
          radius: tabStyle.borderRadius,
          fontWeight: tabStyle.fontWeight,
          baselineHeight: baselineStyle.height,
          baselineColor: baselineStyle.backgroundColor,
          baselineLeft: baselineStyle.left,
          baselineRight: baselineStyle.right,
          tabsPaddingLeft: tabsStyle.paddingLeft,
          tabsPaddingRight: tabsStyle.paddingRight,
          markerHeight: markerStyle.height,
          markerColor: markerStyle.backgroundColor,
          markerRadius: markerStyle.borderRadius,
          markerBottom: markerStyle.bottom,
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
    assert.deepEqual(
      courseVisual.headerSignature,
      coursesVisual.headerSignature,
    );
    assert.deepEqual(courseVisual.tabSignature, {
      height: "40px",
      radius: "0px",
      fontWeight: "500",
      baselineHeight: "1px",
      baselineColor: "rgb(20, 20, 20)",
      baselineLeft: "12px",
      baselineRight: "12px",
      tabsPaddingLeft: "12px",
      tabsPaddingRight: "12px",
      markerHeight: "4px",
      markerColor: "rgb(20, 20, 20)",
      markerRadius: "0px",
      markerBottom: "0px",
    });
    assert.ok(Math.abs(courseVisual.tabBottom - courseVisual.tabsBottom) < 0.5);

    let html = await runtime.page.content();
    assert.match(html, /aria-label="Разделы курса"/);
    assert.match(html, /Уроки/);
    assert.match(html, /О курсе/);
    assert.match(html, /История/);

    await runtime.page
      .getByRole("tab", { name: "О курсе", exact: true })
      .click();
    await runtime.page
      .getByRole("heading", { name: "Описание курса", exact: true, level: 2 })
      .waitFor();
    await runtime.page
      .getByRole("heading", { name: "Источники", exact: true, level: 2 })
      .waitFor();
    await runtime.page
      .getByRole("heading", { name: "Материалы", exact: true, level: 2 })
      .waitFor();
    await runtime.page.getByRole("tab", { name: /^Уроки/ }).click();

    const lessonButton = runtime.page.getByRole("button", {
      name: new RegExp(E2E_LESSON_TITLE),
    });
    await lessonButton.click();

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
      const tabs = document.querySelector<HTMLElement>(".workspace-tabs");

      if (
        !shell ||
        !pageHeader ||
        !title ||
        !description ||
        !headerActions ||
        !tab ||
        !tabs
      ) {
        throw new Error("Lesson visual contract elements are missing");
      }

      const pageHeaderStyle = getComputedStyle(pageHeader);
      const titleStyle = getComputedStyle(title);
      const descriptionStyle = getComputedStyle(description);
      const tabsStyle = getComputedStyle(tabs);
      const tabStyle = getComputedStyle(tab);
      const markerStyle = getComputedStyle(tab, "::after");
      const baselineStyle = getComputedStyle(tabs, "::before");
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
        },
        tabSignature: {
          height: tabStyle.height,
          radius: tabStyle.borderRadius,
          fontWeight: tabStyle.fontWeight,
          baselineHeight: baselineStyle.height,
          baselineColor: baselineStyle.backgroundColor,
          baselineLeft: baselineStyle.left,
          baselineRight: baselineStyle.right,
          tabsPaddingLeft: tabsStyle.paddingLeft,
          tabsPaddingRight: tabsStyle.paddingRight,
          markerHeight: markerStyle.height,
          markerColor: markerStyle.backgroundColor,
          markerRadius: markerStyle.borderRadius,
          markerBottom: markerStyle.bottom,
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
    assert.deepEqual(lessonVisual.tabSignature, courseVisual.tabSignature);

    html = await runtime.page.content();
    assert.match(html, /aria-label="Разделы урока"/);
    assert.match(html, /План/);
    assert.match(html, /Экран ученика/);
    assert.match(html, /Домашнее задание/);

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
    await runtime.page.goto(`/courses/${E2E_COURSE_ID}`, {
      waitUntil: "networkidle",
    });
    await runtime.page
      .getByRole("heading", {
        name: E2E_COURSE_TITLE,
        exact: true,
        level: 1,
      })
      .waitFor();
    await runtime.page
      .getByRole("button", { name: new RegExp(E2E_LESSON_TITLE) })
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
      const title = document.querySelector<HTMLElement>(
        ".app-page-header .app-page-title",
      );
      const header = document.querySelector<HTMLElement>(
        ".site-header-shell-demo",
      );
      const tabStrip = document.querySelector<HTMLElement>(
        ".workspace-tabs-scroll",
      );
      const selectedTab = document.querySelector<HTMLElement>(
        '.workspace-tab[aria-selected="true"]',
      );

      if (!title || !header || !tabStrip || !selectedTab) {
        throw new Error("Mobile Course visual contract elements are missing");
      }

      const titleStyle = getComputedStyle(title);
      const titleRect = title.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const tabStripRect = tabStrip.getBoundingClientRect();
      const selectedTabRect = selectedTab.getBoundingClientRect();

      return {
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        headerLeft: headerRect.left,
        headerRight: headerRect.right,
        titleLeft: titleRect.left,
        titleRight: titleRect.right,
        titleFontSize: titleStyle.fontSize,
        titleFontWeight: titleStyle.fontWeight,
        tabStripClientWidth: tabStrip.clientWidth,
        tabStripScrollWidth: tabStrip.scrollWidth,
        tabStripScrollLeft: tabStrip.scrollLeft,
        tabStripOverflowX: getComputedStyle(tabStrip).overflowX,
        selectedTab: selectedTab.textContent?.trim() ?? "",
        selectedTabAriaSelected: selectedTab.getAttribute("aria-selected"),
        selectedTabLeft: selectedTabRect.left,
        selectedTabRight: selectedTabRect.right,
        tabStripLeft: tabStripRect.left,
        tabStripRight: tabStripRect.right,
      };
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
    assert.equal(mobileVisual.tabStripOverflowX, "auto");
    assert.ok(
      mobileVisual.tabStripScrollWidth > mobileVisual.tabStripClientWidth,
    );
    assert.ok(mobileVisual.tabStripScrollLeft > 0);
    assert.match(mobileVisual.selectedTab, /^История/);
    assert.equal(mobileVisual.selectedTabAriaSelected, "true");
    assert.ok(mobileVisual.selectedTabLeft >= mobileVisual.tabStripLeft - 1);
    assert.ok(mobileVisual.selectedTabRight <= mobileVisual.tabStripRight + 1);
  } finally {
    await runtime.close();
  }
});
