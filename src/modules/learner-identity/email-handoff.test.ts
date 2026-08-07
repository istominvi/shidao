import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";
import {
  clearIdentityEmailHandoff,
  IDENTITY_EMAIL_HANDOFF_COOKIE,
  readIdentityEmailHandoff,
  setIdentityEmailHandoff,
} from "./email-handoff";

const actor = {
  authUserId: "00000000-0000-4000-8000-000000000001",
  verifiedEmail: "recipient@example.com",
};
const invitationId = "00000000-0000-4000-8000-000000000002";

test("HttpOnly email handoff is bound to invitation, kind, account and verified email", (t) => {
  const previous = process.env.LEARNER_IDENTITY_DIGEST_KEY;
  process.env.LEARNER_IDENTITY_DIGEST_KEY =
    "test-only-learner-identity-key-0123456789";
  t.after(() => {
    if (previous === undefined) delete process.env.LEARNER_IDENTITY_DIGEST_KEY;
    else process.env.LEARNER_IDENTITY_DIGEST_KEY = previous;
  });

  const response = NextResponse.json({ ok: true });
  setIdentityEmailHandoff(response, {
    invitationId,
    kind: "profile",
    authUserId: actor.authUserId,
    verifiedEmail: actor.verifiedEmail,
  });
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, new RegExp(`^${IDENTITY_EMAIL_HANDOFF_COOKIE}=`));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=lax/i);
  assert.doesNotMatch(setCookie, /recipient@example\.com|00000000-0000/);
  const cookie = setCookie.split(";", 1)[0]!;
  const request = new NextRequest(
    `https://v2.shidao.test/api/v2/identity-invitations/${invitationId}/preview`,
    { headers: { Cookie: cookie } },
  );

  assert.ok(readIdentityEmailHandoff(request, actor, invitationId, "profile"));
  assert.equal(
    readIdentityEmailHandoff(
      request,
      { ...actor, authUserId: "00000000-0000-4000-8000-000000000009" },
      invitationId,
      "profile",
    ),
    null,
  );
  assert.equal(
    readIdentityEmailHandoff(request, actor, invitationId, "observer"),
    null,
  );

  const terminal = NextResponse.json({ completed: true });
  clearIdentityEmailHandoff(terminal);
  assert.match(terminal.headers.get("set-cookie") ?? "", /Max-Age=0/i);
});
