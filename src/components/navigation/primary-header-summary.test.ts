import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canCommitPrimaryHeaderSummaryRequest,
  currentPrimaryHeaderScheduleRange,
  parsePrimaryHeaderExactCount,
  primaryHeaderSummarySchema,
  PRIMARY_HEADER_SCHEDULE_RESULT_LIMIT,
} from "../../lib/navigation/primary-header-summary";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("primary header summary accepts counts only and rejects stale shapes", () => {
  const summary = {
    generatedAt: "2026-08-15T04:00:00.000Z",
    ownerKey: "a".repeat(43),
    schedule: {
      from: "2026-08-09T15:00:00.000Z",
      to: "2026-08-16T15:00:00.000Z",
      resultCount: 4,
      visibleRunCount: 3,
      limited: false,
    },
    students: { activeCount: 2, archivedCount: 1, pendingCount: 1 },
    profile: {
      finalizedRunCount: 8,
      attendedRunCount: 7,
      subjectCount: 3,
    },
  };

  assert.equal(primaryHeaderSummarySchema.safeParse(summary).success, true);
  assert.equal(
    primaryHeaderSummarySchema.safeParse({
      ...summary,
      students: { ...summary.students, learnerNames: ["Private learner"] },
    }).success,
    false,
  );
  assert.equal(
    primaryHeaderSummarySchema.safeParse({ ...summary, courseCount: 5 })
      .success,
    false,
  );
  assert.equal(
    primaryHeaderSummarySchema.safeParse({
      ...summary,
      ownerKey: "11111111-1111-4111-8111-111111111111",
    }).success,
    false,
  );
  assert.equal(
    primaryHeaderSummarySchema.safeParse({
      ...summary,
      schedule: null,
      profile: null,
    }).success,
    true,
  );
});

test("summary warmup uses the same Monday-to-Monday local week as Schedule", () => {
  const range = currentPrimaryHeaderScheduleRange(
    new Date(2026, 7, 12, 18, 30),
  );
  const from = new Date(range.from);
  const to = new Date(range.to);

  assert.equal(from.getDay(), 1);
  assert.equal(from.getDate(), 10);
  assert.equal(from.getHours(), 0);
  assert.equal(to.getDay(), 1);
  assert.equal(to.getDate(), 17);
  assert.equal(to.getHours(), 0);
});

test("stale or unauthorized summary requests cannot commit", () => {
  assert.equal(
    canCommitPrimaryHeaderSummaryRequest({
      requestGeneration: 4,
      currentGeneration: 4,
      accountActive: true,
      unauthorized: false,
    }),
    true,
  );
  assert.equal(
    canCommitPrimaryHeaderSummaryRequest({
      requestGeneration: 4,
      currentGeneration: 5,
      accountActive: true,
      unauthorized: false,
    }),
    false,
  );
  assert.equal(
    canCommitPrimaryHeaderSummaryRequest({
      requestGeneration: 5,
      currentGeneration: 5,
      accountActive: true,
      unauthorized: true,
    }),
    false,
  );
});

test("exact PostgREST counts reject wildcard totals and malformed ranges", () => {
  assert.equal(parsePrimaryHeaderExactCount("*/0"), 0);
  assert.equal(parsePrimaryHeaderExactCount("0-0/1"), 1);
  assert.equal(parsePrimaryHeaderExactCount("0-1/3"), 3);
  assert.equal(parsePrimaryHeaderExactCount("0-5/6"), 6);
  assert.equal(parsePrimaryHeaderExactCount("0-0/27"), 27);
  assert.equal(PRIMARY_HEADER_SCHEDULE_RESULT_LIMIT, 500);

  for (const invalid of [
    null,
    "",
    "0-0/*",
    "*/27",
    "1-1/3",
    "0-2/2",
    "2-1/3",
    "00-00/01",
    "items 0-0/1",
    `0-0/${Number.MAX_SAFE_INTEGER + 1}`,
  ]) {
    assert.throws(
      () => parsePrimaryHeaderExactCount(invalid),
      /primary_header_summary_count_invalid/,
    );
  }
});

test("authenticated summary route uses one auth context and lightweight RLS counts", () => {
  const route = source("src/app/api/v2/app-header-summary/route.ts");
  const serverContext = source(
    "src/lib/navigation/primary-header-summary-server.ts",
  );
  const repository = source(
    "src/lib/navigation/primary-header-summary-repository.ts",
  );
  const ownerKey = source("src/lib/navigation/primary-header-summary-owner.ts");

  assert.match(route, /getPrimaryHeaderSummaryContext\(\)/);
  assert.doesNotMatch(route, /getLearnerIdentityContext|getLessonRunsContext/);
  assert.equal(
    serverContext.match(/requireSupabaseUserSession\(\)/g)?.length,
    1,
  );
  assert.doesNotMatch(serverContext, /requireSupabaseUserAccessToken/);
  assert.match(serverContext, /primaryHeaderSummaryOwnerKey\(session\.uid\)/);
  assert.match(ownerKey, /createHash\("sha256"\)/);
  assert.match(ownerKey, /primary-header-summary-owner:v1/);
  assert.match(ownerKey, /\.digest\("base64url"\)/);
  assert.match(route, /counts\.countScheduleWindow\(from, to\)/);
  assert.match(
    route,
    /visibleRunCount: Math\.min\([\s\S]*?PRIMARY_HEADER_SCHEDULE_RESULT_LIMIT/,
  );
  assert.match(
    route,
    /limited:[\s\S]*?scheduleResult\.value >= PRIMARY_HEADER_SCHEDULE_RESULT_LIMIT/,
  );
  assert.equal(route.match(/counts\.countTeacherLearners\(/g)?.length, 2);
  assert.doesNotMatch(
    route,
    /service\.listSchedule|service\.listTeacherDirectory/,
  );
  assert.match(route, /service\.listConnections/);
  assert.match(route, /service\.getSelfProgress/);
  assert.match(route, /Promise\.allSettled/);
  assert.match(route, /ownerKey,/);
  assert.match(route, /schedule:[\s\S]*?: null/);
  assert.match(route, /students:[\s\S]*?: null/);
  assert.match(route, /profile:[\s\S]*?: null/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(
    route,
    /create[A-Za-z]+Repository|supabase\/rest|\.from\(/,
  );
  assert.match(
    serverContext,
    /createPrimaryHeaderSummaryRepository\(accessToken\)/,
  );
  assert.doesNotMatch(
    serverContext,
    /createLessonRunsRepository|createLessonRunsService/,
  );
  assert.match(repository, /import "server-only"/);
  assert.match(repository, /method: "HEAD"/);
  assert.match(repository, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(repository, /Prefer: "count=exact"/);
  assert.match(repository, /Range: "0-0"/);
  assert.match(repository, /"Range-Unit": "items"/);
  assert.match(repository, /cache: "no-store"/);
  assert.match(repository, /\/rest\/v1\/lesson_run\?select=id/);
  assert.match(repository, /scheduled_at=gte\./);
  assert.match(repository, /scheduled_at=lt\./);
  assert.match(repository, /cancelled_at=is\.null/);
  assert.match(
    repository,
    /\/rest\/v1\/teacher_learner\?select=learner_profile_id/,
  );
  assert.match(repository, /archived_at=is\.null/);
  assert.match(repository, /archived_at=not\.is\.null/);
  assert.doesNotMatch(repository, /response\.json|response\.text|select=\*/);
  assert.doesNotMatch(repository, /service[_-]?role|SUPABASE_SERVICE/i);
  assert.match(route, /PrimaryHeaderSummaryRepositoryError/);
  assert.match(route, /error\.status === 401/);
  assert.match(route, /schedule:[\s\S]*?: null/);
  assert.match(route, /students:[\s\S]*?: null/);
  assert.match(route, /profile:[\s\S]*?: null/);
});

test("persistent provider warms once, deduplicates requests, revalidates and prefetches all app sections", () => {
  const provider = source(
    "src/components/navigation/primary-header-summary-provider.tsx",
  );
  const layout = source("src/app/(app)/layout.tsx");

  assert.match(
    layout,
    /<PrimaryHeaderSummaryProvider key=\{accountKey\} accountKey=\{accountKey\}>/,
  );
  assert.match(
    layout,
    /primaryHeaderSummaryOwnerKey\(resolution\.context\.authUserId\)/,
  );
  assert.match(provider, /inFlightRef\.current/);
  assert.match(provider, /PRIMARY_HEADER_SUMMARY_TTL_MS/);
  assert.match(provider, /const pathname = usePathname\(\)/);
  assert.match(provider, /\[pathname, requestSummary, session\.kind\]/);
  assert.match(provider, /window\.addEventListener\("focus", handleFocus\)/);
  assert.match(provider, /\/api\/v2\/app-header-summary\?/);
  for (const route of ["schedule", "students", "courses", "store", "profile"]) {
    assert.match(provider, new RegExp(`ROUTES\\.${route}`));
  }
  assert.match(provider, /router\.prefetch\(href\)/);
  assert.match(provider, /summaryRef\.current = null/);
  assert.match(provider, /controllerRef\.current\?\.abort\(\)/);
  assert.match(provider, /sessionRef\.current === requestOwner\.session/);
  assert.match(provider, /requestGeneration,[\s\S]*?generationRef\.current/);
  assert.match(provider, /response\.status === 401/);
  assert.match(provider, /parsed\.data\.ownerKey !== requestOwner\.accountKey/);
  assert.match(provider, /unauthorizedRef\.current = true/);
  assert.match(
    provider,
    /void refetchSession\(\)\.finally\(\(\) => router\.refresh\(\)\)/,
  );
  assert.doesNotMatch(
    provider,
    /ownerKey.*URLSearchParams|query\.set\([^)]*owner/i,
  );
});
