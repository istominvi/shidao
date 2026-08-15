import { NextResponse } from "next/server";
import {
  primaryHeaderSummarySchema,
  PRIMARY_HEADER_SCHEDULE_RESULT_LIMIT,
} from "@/lib/navigation/primary-header-summary";
import { PrimaryHeaderSummaryRepositoryError } from "@/lib/navigation/primary-header-summary-repository";
import { getPrimaryHeaderSummaryContext } from "@/lib/navigation/primary-header-summary-server";
import {
  isSupabaseUserReauthenticationRequiredError,
  SupabaseUserReauthenticationRequiredError,
} from "@/lib/server/supabase-user-session";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import { courseBuilderApiError } from "@/modules/course-builder/server-context";
import { lessonRunWindowInputSchema } from "@/modules/lesson-runs/contracts";
import { LearnerIdentityApplicationError } from "@/modules/learner-identity/service";

export const runtime = "nodejs";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

function privateNoStore(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    PRIVATE_NO_STORE_HEADERS["Cache-Control"],
  );
  return response;
}

function isAuthenticationFailure(error: unknown) {
  return (
    isSupabaseUserReauthenticationRequiredError(error) ||
    (error instanceof PrimaryHeaderSummaryRepositoryError &&
      error.status === 401) ||
    (error instanceof CourseBuilderRepositoryError && error.status === 401) ||
    (error instanceof LearnerIdentityApplicationError && error.status === 401)
  );
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const windowResult = lessonRunWindowInputSchema.safeParse({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    if (!windowResult.success) {
      return NextResponse.json(
        {
          error: "Укажите корректные границы текущей недели.",
          code: "app_header_summary_window_invalid",
        },
        { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const { counts, identity, ownerKey } =
      await getPrimaryHeaderSummaryContext();
    const { from, to } = windowResult.data;

    const [scheduleResult, studentsResult, profileResult] =
      await Promise.allSettled([
        counts.countScheduleWindow(from, to),
        Promise.all([
          counts.countTeacherLearners("active"),
          counts.countTeacherLearners("archived"),
          identity.service.listConnections(identity.actor),
        ]),
        identity.service.getSelfProgress(identity.actor),
      ]);

    const authenticationFailure = [
      scheduleResult,
      studentsResult,
      profileResult,
    ].find(
      (result) =>
        result.status === "rejected" && isAuthenticationFailure(result.reason),
    );
    if (authenticationFailure?.status === "rejected") {
      throw new SupabaseUserReauthenticationRequiredError();
    }

    const summary = primaryHeaderSummarySchema.parse({
      generatedAt: new Date().toISOString(),
      ownerKey,
      schedule:
        scheduleResult.status === "fulfilled"
          ? {
              from,
              to,
              resultCount: scheduleResult.value,
              visibleRunCount: Math.min(
                scheduleResult.value,
                PRIMARY_HEADER_SCHEDULE_RESULT_LIMIT,
              ),
              limited:
                scheduleResult.value >= PRIMARY_HEADER_SCHEDULE_RESULT_LIMIT,
            }
          : null,
      students:
        studentsResult.status === "fulfilled"
          ? {
              activeCount: studentsResult.value[0],
              archivedCount: studentsResult.value[1],
              pendingCount: studentsResult.value[2].filter(
                (connection) =>
                  connection.direction === "outgoing" &&
                  connection.status === "pending",
              ).length,
            }
          : null,
      // An Account without an owned learner profile (including a provisional
      // learner before activation finishes) legitimately has no progress
      // projection. Keep the other header metrics useful in that case.
      profile:
        profileResult.status === "fulfilled"
          ? {
              finalizedRunCount: profileResult.value.finalizedRunCount,
              attendedRunCount: profileResult.value.attendedRunCount,
              subjectCount: profileResult.value.subjects.length,
            }
          : null,
    });

    return NextResponse.json(summary, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    return privateNoStore(await courseBuilderApiError(error));
  }
}
