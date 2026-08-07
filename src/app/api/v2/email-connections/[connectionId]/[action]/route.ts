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
type Context = { params: Promise<{ connectionId: string; action: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const limited = identityMutationRateLimit(
    request,
    "email-connection-action",
    8,
  );
  if (limited) return limited;
  try {
    const { connectionId, action: rawAction } = await params;
    const action = assertAction(rawAction, [
      "preview",
      "accept",
      "reject",
    ] as const);
    const body = await readIdentityJson(request);
    const token =
      body &&
      typeof body === "object" &&
      "token" in body &&
      typeof body.token === "string" &&
      body.token
        ? body.token
        : null;
    const { actor, service } = await getLearnerIdentityContext();
    const handoff = token
      ? null
      : readIdentityEmailHandoff(request, actor, connectionId, "connection");
    if (!token && !handoff) {
      throw new LearnerIdentityApplicationError(
        "Запрос недоступен или больше не существует.",
        "learner_identity_not_found",
        404,
      );
    }
    if (action === "preview") {
      const preview = token
        ? await service.previewEmailConnection(actor, connectionId, token)
        : await service.previewVerifiedEmailConnection(actor, connectionId);
      const response = NextResponse.json({ preview });
      if (!token && !preview.canAccept) clearIdentityEmailHandoff(response);
      return response;
    }
    const result = token
      ? await service.actOnEmailConnection(actor, connectionId, action, token)
      : await service.actOnVerifiedEmailConnection(actor, connectionId, action);
    const response = NextResponse.json({
      request: result,
    });
    clearIdentityEmailHandoff(response);
    return response;
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
