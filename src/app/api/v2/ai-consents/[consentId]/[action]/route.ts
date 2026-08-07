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
type Context = { params: Promise<{ consentId: string; action: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(request, "ai-consent-action", 10);
  if (limited) return limited;
  try {
    const { consentId, action: rawAction } = await params;
    const action = assertAction(rawAction, ["grant", "revoke"] as const);
    const input = await readIdentityJson(request);
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json({
      consent: await service.actOnAiConsent(actor, consentId, {
        ...(input && typeof input === "object" ? input : {}),
        action,
      }),
    });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
