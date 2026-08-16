import { NextResponse } from "next/server";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { clearAppSession } from "@/lib/server/app-session";
import {
  isSupabaseUserReauthenticationRequiredError,
  requireSupabaseUserAccessToken,
  SupabaseUserReauthenticationRequiredError,
} from "@/lib/server/supabase-user-session";
import { CommunicationApplicationError } from "./contracts";
import type { CommunicationActor } from "./domain";
import {
  CommunicationRepositoryError,
  createCommunicationRepository,
} from "./repository";
import { createCommunicationService } from "./service";

export async function getCommunicationContext() {
  const resolution = await resolveAccessPolicy();
  if (resolution.status !== "account") {
    throw new SupabaseUserReauthenticationRequiredError();
  }
  const accessToken = await requireSupabaseUserAccessToken();
  const actor: CommunicationActor = {
    authUserId: resolution.context.authUserId,
    accountId: resolution.context.accountId,
  };
  return {
    actor,
    service: createCommunicationService({
      repository: createCommunicationRepository(accessToken),
    }),
  };
}

export async function communicationApiError(error: unknown) {
  if (
    isSupabaseUserReauthenticationRequiredError(error) ||
    (error instanceof CommunicationApplicationError && error.status === 401) ||
    (error instanceof CommunicationRepositoryError && error.status === 401)
  ) {
    await clearAppSession();
    return NextResponse.json(
      {
        error: "Войдите снова, чтобы открыть сообщения.",
        code: "communication_reauthentication_required",
        loginRequired: true,
      },
      { status: 401 },
    );
  }
  if (error instanceof CommunicationApplicationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return NextResponse.json(
    {
      error: "Сервис сообщений временно недоступен.",
      code: "communication_unavailable",
    },
    { status: 503 },
  );
}

export function isCommunicationApiError(error: unknown) {
  return (
    isSupabaseUserReauthenticationRequiredError(error) ||
    error instanceof CommunicationApplicationError ||
    error instanceof CommunicationRepositoryError
  );
}

export async function readCommunicationJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new CommunicationApplicationError(
      "Ожидался JSON body.",
      400,
      "communication_validation_error",
    );
  }
}

export function communicationQuery(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
