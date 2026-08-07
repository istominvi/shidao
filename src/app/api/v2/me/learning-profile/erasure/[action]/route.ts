import { NextRequest, NextResponse } from "next/server";
import {
  assertAction,
  identityMutationRateLimit,
  readIdentityJson,
} from "@/modules/learner-identity/http";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";
type Context = { params: Promise<{ action: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(request, "learner-erasure", 4);
  if (limited) return limited;
  try {
    const action = assertAction((await params).action, [
      "preview",
      "confirm",
    ] as const);
    const context = await getLearnerIdentityContext();
    if (action === "preview") {
      return NextResponse.json({
        preview: await context.service.previewErasure(context.actor),
      });
    }
    return NextResponse.json({
      profile: await context.service.confirmErasure(
        context.actor,
        await readIdentityJson(request),
        { recentlyReauthenticated: context.recentlyReauthenticated },
      ),
    });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
