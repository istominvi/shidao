import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createLearnerIdentityAdminRepository } from "./admin-repository";

const userRepositorySource = readFileSync(
  "src/modules/learner-identity/repository.ts",
  "utf8",
);
const invitationWorkspaceSource = readFileSync(
  "src/components/learner-identity/invitation-accept-workspace.tsx",
  "utf8",
);
const studentsWorkspaceSource = readFileSync(
  "src/components/teaching-hub/students-workspace.tsx",
  "utf8",
);
const historyRouteSource = readFileSync(
  "src/app/api/v2/learner-profiles/[learnerProfileId]/history/route.ts",
  "utf8",
);
const authConfirmRouteSource = readFileSync(
  "src/app/(auth)/auth/confirm/route.ts",
  "utf8",
);
const inviteTemplateSource = readFileSync(
  "public/email-templates/invite.html",
  "utf8",
);
const confirmationTemplateSource = readFileSync(
  "public/email-templates/confirmation.html",
  "utf8",
);
const recoveryTemplateSource = readFileSync(
  "public/email-templates/recovery.html",
  "utf8",
);
const emailChangeTemplateSource = readFileSync(
  "public/email-templates/email-change.html",
  "utf8",
);
const identityDbHarnessSource = readFileSync(
  "scripts/db-identity-tests.sh",
  "utf8",
);

function configureAdminEnvironment(t: test.TestContext) {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL",
    "LEARNER_IDENTITY_DIGEST_KEY",
  ] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
  process.env.NEXT_PUBLIC_APP_URL = "https://v2.shidao.test";
  process.env.LEARNER_IDENTITY_DIGEST_KEY =
    "test-only-learner-identity-key-0123456789";
  t.after(() => {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

test("authenticated PostgREST repository has no secret-bearing RPC arguments", () => {
  assert.doesNotMatch(userRepositorySource, /p_token_digest/);
  assert.doesNotMatch(userRepositorySource, /p_recipient_email_digest/);
  assert.doesNotMatch(userRepositorySource, /p_raw_pin/);
  assert.doesNotMatch(userRepositorySource, /createProfileInvitation/);
});

test("destructive erasure admin RPC binds the verified Supabase session", async (t) => {
  configureAdminEnvironment(t);
  const actorAuthUserId = "00000000-0000-4000-8000-000000000101";
  const supabaseSessionId = "00000000-0000-4000-8000-000000000102";
  const previewFingerprint = "a".repeat(64);
  let requestBody: Record<string, unknown> | undefined;
  const repository = createLearnerIdentityAdminRepository({
    fetcher: async (input, init) => {
      assert.equal(
        new URL(String(input)).pathname,
        "/rest/v1/rpc/confirm_my_learning_data_erasure",
      );
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        learner_profile_id: "00000000-0000-4000-8000-000000000103",
        display_name: "Ученик",
        created_at: "2026-08-21T00:00:00.000Z",
        merged_lineage_count: 0,
        can_safe_unlink: true,
        pending_connections: [],
      });
    },
  });

  await repository.confirmErasure(
    actorAuthUserId,
    supabaseSessionId,
    previewFingerprint,
  );
  assert.deepEqual(requestBody, {
    p_actor_auth_user_id: actorAuthUserId,
    p_session_id: supabaseSessionId,
    p_preview_fingerprint: previewFingerprint,
  });
});

test("identity DB harness models the trusted Auth writer without weakening auth RLS", () => {
  const rollbackBoundary = identityDbHarnessSource.indexOf("rollback;\nSQL");
  const createRole = identityDbHarnessSource.indexOf(
    "create role shidao_identity_auth_harness nologin nosuperuser nocreatedb nocreaterole noinherit noreplication bypassrls",
  );
  const alterRole = identityDbHarnessSource.indexOf(
    "alter role shidao_identity_auth_harness nologin nosuperuser nocreatedb nocreaterole noinherit noreplication bypassrls",
  );

  assert.ok(createRole > -1 && createRole < rollbackBoundary);
  assert.ok(alterRole > -1 && alterRole < rollbackBoundary);
  assert.match(
    identityDbHarnessSource,
    /reserved Auth harness role is not isolated/,
  );
  assert.doesNotMatch(
    identityDbHarnessSource,
    /alter table auth\.users (?:disable|no force) row level security/i,
  );
  assert.doesNotMatch(
    identityDbHarnessSource,
    /create policy[\s\S]*?on auth\.users/i,
  );
});

test("email delivery sends GoTrue only a non-secret invitation handoff", async (t) => {
  configureAdminEnvironment(t);
  const requests: Array<{
    url: URL;
    headers: Headers;
    body: Record<string, unknown>;
  }> = [];
  const repository = createLearnerIdentityAdminRepository({
    fetcher: async (input, init) => {
      requests.push({
        url: new URL(String(input)),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response("{}", { status: 200 });
    },
  });

  const delivered = await repository.deliverIdentityEmail({
    recipientEmail: "recipient@example.com",
    invitationId: "00000000-0000-4000-8000-000000000001",
    kind: "profile",
  });
  assert.equal(delivered, true);
  assert.equal(requests.length, 1);
  const request = requests[0]!;
  assert.equal(request.url.pathname, "/auth/v1/otp");
  assert.equal(request.headers.get("apikey"), "anon-test");
  assert.equal(request.headers.get("authorization"), "Bearer anon-test");
  assert.deepEqual(request.body, {
    email: "recipient@example.com",
    data: { identity_invitation: true },
    create_user: true,
  });
  const redirect = new URL(request.url.searchParams.get("redirect_to")!);
  assert.equal(redirect.pathname, "/auth/confirm");
  assert.equal(
    redirect.searchParams.get("next"),
    "/identity/invitations/00000000-0000-4000-8000-000000000001",
  );
  assert.equal(redirect.hash, "");
  assert.equal(
    redirect.searchParams.get("identity_invitation"),
    "00000000-0000-4000-8000-000000000001",
  );
  assert.equal(redirect.searchParams.get("identity_kind"), "profile");
  assert.doesNotMatch(
    JSON.stringify(requests),
    /raw-custom-token|token_digest|service-test/,
  );
});

test("ambiguous email delivery failure returns the one-time copy fallback", async (t) => {
  configureAdminEnvironment(t);
  const repository = createLearnerIdentityAdminRepository({
    fetcher: async () => {
      throw new TypeError("network failed");
    },
  });
  assert.equal(
    await repository.deliverIdentityEmail({
      recipientEmail: "recipient@example.com",
      invitationId: "00000000-0000-4000-8000-000000000001",
      kind: "observer",
    }),
    false,
  );
});

test("new and existing recipients use the same generic OTP delivery path", async (t) => {
  configureAdminEnvironment(t);
  const requests: Array<{ url: URL; body: Record<string, unknown> }> = [];
  const repository = createLearnerIdentityAdminRepository({
    fetcher: async (input, init) => {
      requests.push({
        url: new URL(String(input)),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response("{}", { status: 200 });
    },
  });
  for (const recipientEmail of ["new@example.com", "existing@example.com"]) {
    assert.equal(
      await repository.deliverIdentityEmail({
        recipientEmail,
        invitationId: "00000000-0000-4000-8000-000000000001",
        kind: "connection",
      }),
      true,
    );
  }
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.url.pathname, "/auth/v1/otp");
    assert.ok(request.url.searchParams.has("redirect_to"));
    assert.equal(request.body.create_user, true);
    assert.deepEqual(request.body.data, { identity_invitation: true });
  }
  assert.equal(requests[0]!.url.pathname, requests[1]!.url.pathname);
});

test("browser invitation and QR flows stage secrets only in fragment/session storage", () => {
  assert.match(invitationWorkspaceSource, /window\.sessionStorage\.setItem/);
  assert.match(
    invitationWorkspaceSource,
    /History\.prototype\.replaceState\.call/,
  );
  assert.match(
    invitationWorkspaceSource,
    /window\.location\.pathname[\s\S]*window\.location\.search/,
  );
  assert.match(invitationWorkspaceSource, /\/login\?next=/);
  assert.doesNotMatch(invitationWorkspaceSource, /\?token=/);
  assert.match(studentsWorkspaceSource, /fragment\.get\("connect-code"\)/);
  assert.match(studentsWorkspaceSource, /setAddLearnerOpen\(true\)/);
});

test("all deployed Auth templates verify on the application RedirectTo", () => {
  for (const [template, type] of [
    [inviteTemplateSource, "invite"],
    [confirmationTemplateSource, "email"],
    [recoveryTemplateSource, "recovery"],
    [emailChangeTemplateSource, "email_change"],
  ] as const) {
    assert.match(template, /href="\{\{ \.RedirectTo \}\}/);
    assert.match(template, new RegExp(`&amp;type=${type}`));
    assert.doesNotMatch(template, /href="\{\{ \.SiteURL \}\}\/auth\/confirm/);
  }
  assert.match(authConfirmRouteSource, /readRedirectContract\(req\)/);
  assert.match(authConfirmRouteSource, /setIdentityEmailHandoff/);
  assert.doesNotMatch(authConfirmRouteSource, /destination\.hash/);
  assert.doesNotMatch(authConfirmRouteSource, /identity_(state|token)/i);
});

test("teacher history resolves old IDs only through the actor-scoped alias RPC", () => {
  assert.match(historyRouteSource, /resolveTeacherLearnerAlias/);
  assert.match(historyRouteSource, /getLearnerIdentityContext/);
  assert.doesNotMatch(historyRouteSource, /resolve_learner_profile_alias/);
});

test("ambiguous provisional Auth create retries deterministically and recovers only its marked user", async (t) => {
  configureAdminEnvironment(t);
  const invitationId = "00000000-0000-4000-8000-000000000071";
  const authUserId = "00000000-0000-4000-8000-000000000072";
  const createBodies: string[] = [];
  let generateLinkCalls = 0;
  const repository = createLearnerIdentityAdminRepository({
    fetcher: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/admin/users")) {
        createBodies.push(String(init?.body));
        if (createBodies.length === 1) throw new TypeError("response lost");
        return new Response(JSON.stringify({ message: "already exists" }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/auth/v1/admin/generate_link")) {
        generateLinkCalls += 1;
        const createBody = JSON.parse(createBodies[0]!) as {
          email: string;
          app_metadata: Record<string, unknown>;
        };
        return Response.json({
          user: {
            id: authUserId,
            email: createBody.email,
            app_metadata: createBody.app_metadata,
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  });

  const result = await repository.createProvisionalLearnerAuthUser(
    invitationId,
    "Учащийся",
  );
  assert.equal(result.authUserId, authUserId);
  assert.equal(createBodies.length, 2);
  assert.equal(createBodies[0], createBodies[1]);
  assert.equal(generateLinkCalls, 1);
  const body = JSON.parse(createBodies[0]!) as {
    email: string;
    password: string;
    app_metadata: Record<string, unknown>;
  };
  assert.equal(body.email, result.internalAuthEmail);
  assert.equal(body.app_metadata.activation_invitation_id, invitationId);
  assert.equal(body.app_metadata.identity_status, "provisional");
  assert.doesNotMatch(body.email, new RegExp(invitationId, "i"));
  assert.ok(body.password.length >= 32);
});

test("concurrent provisional Auth creation converges on one invitation-marked user", async (t) => {
  configureAdminEnvironment(t);
  const invitationId = "00000000-0000-4000-8000-000000000081";
  const authUserId = "00000000-0000-4000-8000-000000000082";
  let existing:
    | { id: string; email: string; app_metadata: Record<string, unknown> }
    | undefined;
  let createCalls = 0;
  const repository = createLearnerIdentityAdminRepository({
    fetcher: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/admin/users")) {
        createCalls += 1;
        const body = JSON.parse(String(init?.body)) as {
          email: string;
          app_metadata: Record<string, unknown>;
        };
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (!existing) {
          existing = {
            id: authUserId,
            email: body.email,
            app_metadata: body.app_metadata,
          };
          return Response.json(existing);
        }
        return new Response(JSON.stringify({ message: "already exists" }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/auth/v1/admin/generate_link") && existing) {
        return Response.json({ user: existing });
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  });

  const [left, right] = await Promise.all([
    repository.createProvisionalLearnerAuthUser(invitationId, "Учащийся"),
    repository.createProvisionalLearnerAuthUser(invitationId, "Учащийся"),
  ]);
  assert.equal(createCalls, 2);
  assert.deepEqual(left, right);
  assert.equal(left.authUserId, authUserId);
});

test("provisional Auth recovery rejects a user with different invitation metadata", async (t) => {
  configureAdminEnvironment(t);
  const invitationId = "00000000-0000-4000-8000-000000000091";
  let expectedEmail = "";
  const repository = createLearnerIdentityAdminRepository({
    fetcher: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/admin/users")) {
        expectedEmail = (JSON.parse(String(init?.body)) as { email: string })
          .email;
        return new Response(JSON.stringify({ message: "already exists" }), {
          status: 422,
        });
      }
      if (url.endsWith("/auth/v1/admin/generate_link")) {
        return Response.json({
          user: {
            id: "00000000-0000-4000-8000-000000000092",
            email: expectedEmail,
            app_metadata: {
              identity_status: "provisional",
              activation_invitation_id: "00000000-0000-4000-8000-000000000099",
            },
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  });

  await assert.rejects(
    () => repository.createProvisionalLearnerAuthUser(invitationId, "Учащийся"),
    /failed validation/,
  );
});
