import { NextRequest, NextResponse } from "next/server";
import {
  assertAction,
  identityMutationRateLimit,
  readIdentityJson,
} from "@/modules/learner-identity/http";
import {
  clearIdentityEmailHandoff,
  readIdentityEmailHandoff,
} from "@/modules/learner-identity/email-handoff";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";
import { LearnerIdentityApplicationError } from "@/modules/learner-identity/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ invitationId: string; action: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(
    request,
    "identity-invitation-action",
    10,
  );
  if (limited) return limited;
  try {
    const { invitationId, action: rawAction } = await params;
    const action = assertAction(rawAction, [
      "preview",
      "accept",
      "reject",
      "revoke",
      "activate-child",
    ] as const);
    const input = await readIdentityJson(request);
    const context = await getLearnerIdentityContext();
    if (action === "revoke") {
      return NextResponse.json({
        invitation: await context.service.revokeProfileInvitation(
          context.actor,
          invitationId,
        ),
      });
    }
    const token =
      input &&
      typeof input === "object" &&
      "token" in input &&
      typeof input.token === "string" &&
      input.token
        ? input.token
        : null;
    const handoff = token
      ? null
      : readIdentityEmailHandoff(
          request,
          context.actor,
          invitationId,
          "profile",
        );
    if (!token && !handoff) {
      throw new LearnerIdentityApplicationError(
        "Запрос недоступен или больше не существует.",
        "learner_identity_not_found",
        404,
      );
    }
    if (action === "preview") {
      const result = token
        ? await context.service.previewProfileInvitation(
            context.actor,
            invitationId,
            token,
          )
        : await context.service.previewVerifiedProfileInvitation(
            context.actor,
            invitationId,
          );
      const response = NextResponse.json(result);
      if (!token && result.completed) clearIdentityEmailHandoff(response);
      return response;
    }
    if (action === "activate-child") {
      const result = token
        ? await context.service.activateChildAccount(
            context.actor,
            invitationId,
            input,
            { recentlyReauthenticated: context.recentlyReauthenticated },
          )
        : await context.service.activateVerifiedChildAccount(
            context.actor,
            invitationId,
            input,
            { recentlyReauthenticated: context.recentlyReauthenticated },
          );
      const response = NextResponse.json(result);
      clearIdentityEmailHandoff(response);
      return response;
    }
    const result = token
      ? await context.service.actOnProfileInvitation(
          context.actor,
          invitationId,
          { ...(input && typeof input === "object" ? input : {}), action },
        )
      : await context.service.actOnVerifiedProfileInvitation(
          context.actor,
          invitationId,
          action,
        );
    const response = NextResponse.json(result);
    clearIdentityEmailHandoff(response);
    return response;
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
