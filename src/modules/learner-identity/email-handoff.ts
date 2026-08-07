import type { NextRequest, NextResponse } from "next/server";
import type { LearnerIdentityActor } from "./service";
import {
  digestIdentityEmail,
  IDENTITY_EMAIL_HANDOFF_TTL_MS,
  sealIdentityEmailHandoff,
  unsealIdentityEmailHandoff,
  type IdentityEmailHandoff,
} from "./server-secrets";

export const IDENTITY_EMAIL_HANDOFF_COOKIE = "shidao_identity_email_handoff";

type IdentityEmailKind = IdentityEmailHandoff["kind"];

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(IDENTITY_EMAIL_HANDOFF_TTL_MS / 1_000),
  };
}

export function setIdentityEmailHandoff(
  response: NextResponse,
  input: {
    invitationId: string;
    kind: IdentityEmailKind;
    authUserId: string;
    verifiedEmail: string;
  },
) {
  response.cookies.set(
    IDENTITY_EMAIL_HANDOFF_COOKIE,
    sealIdentityEmailHandoff({
      invitationId: input.invitationId,
      kind: input.kind,
      authUserId: input.authUserId,
      recipientEmailDigest: digestIdentityEmail(input.verifiedEmail),
    }),
    cookieOptions(),
  );
}

export function clearIdentityEmailHandoff(response: NextResponse) {
  response.cookies.set(IDENTITY_EMAIL_HANDOFF_COOKIE, "", {
    ...cookieOptions(),
    maxAge: 0,
  });
}

export function readIdentityEmailHandoff(
  request: NextRequest,
  actor: LearnerIdentityActor,
  invitationId: string,
  kind: IdentityEmailKind,
) {
  const sealed = request.cookies.get(IDENTITY_EMAIL_HANDOFF_COOKIE)?.value;
  if (!sealed || !actor.verifiedEmail) return null;
  const handoff = unsealIdentityEmailHandoff(sealed);
  if (
    !handoff ||
    handoff.invitationId !== invitationId ||
    handoff.kind !== kind ||
    handoff.authUserId !== actor.authUserId ||
    handoff.recipientEmailDigest !== digestIdentityEmail(actor.verifiedEmail)
  ) {
    return null;
  }
  return handoff;
}
