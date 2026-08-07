import { NextRequest, NextResponse } from "next/server";
import {
  identityMutationRateLimit,
  readIdentityJson,
} from "@/modules/learner-identity/http";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";
type Context = { params: Promise<{ courseId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(request, "ai-consent-request", 12);
  if (limited) return limited;
  try {
    const { courseId } = await params;
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json(
      {
        consent: await service.requestAiConsent(
          actor,
          courseId,
          await readIdentityJson(request),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
