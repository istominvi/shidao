import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveProvisionalAuthEmail,
  deriveProvisionalAuthPassword,
  digestIdentityEmail,
  digestInvitationToken,
  digestShareCode,
  generateInvitationToken,
  generateShareCode,
  normalizeIdentityEmail,
  normalizeShareCode,
  sealIdentityEmailHandoff,
  unsealIdentityEmailHandoff,
} from "./server-secrets";

test("identity secrets are normalized, domain-separated HMAC digests", (t) => {
  const previous = process.env.LEARNER_IDENTITY_DIGEST_KEY;
  process.env.LEARNER_IDENTITY_DIGEST_KEY =
    "test-only-learner-identity-key-0123456789";
  t.after(() => {
    if (previous === undefined) delete process.env.LEARNER_IDENTITY_DIGEST_KEY;
    else process.env.LEARNER_IDENTITY_DIGEST_KEY = previous;
  });

  assert.equal(
    normalizeIdentityEmail("  Person@Example.COM "),
    "person@example.com",
  );
  assert.equal(normalizeShareCode(" abcdE- 23456 "), "ABCDE23456");
  assert.equal(
    digestIdentityEmail("Person@Example.COM"),
    digestIdentityEmail(" person@example.com "),
  );
  assert.equal(digestShareCode("ABCDE-23456"), digestShareCode("abcde23456"));
  assert.notEqual(
    digestShareCode("ABCDE-23456"),
    digestInvitationToken("ABCDE23456"),
  );
  const invitationId = "00000000-0000-4000-8000-000000000001";
  assert.equal(
    deriveProvisionalAuthEmail(invitationId),
    deriveProvisionalAuthEmail(invitationId.toUpperCase()),
  );
  assert.match(
    deriveProvisionalAuthEmail(invitationId),
    /^[0-9a-f]{64}@learners\.shidao\.internal$/,
  );
  assert.match(deriveProvisionalAuthPassword(invitationId), /^[0-9a-f]{64}$/);
  assert.notEqual(
    deriveProvisionalAuthEmail(invitationId).split("@")[0],
    deriveProvisionalAuthPassword(invitationId),
  );

  for (const digest of [
    digestIdentityEmail("person@example.com"),
    digestShareCode("ABCDE-23456"),
    digestInvitationToken("secret-token-value"),
  ]) {
    assert.match(digest, /^\\x[0-9a-f]{64}$/);
    assert.doesNotMatch(digest, /person|ABCDE|secret-token-value/i);
  }
});

test("identity email handoff is account-bound, opaque and expires fail closed", (t) => {
  const previous = process.env.LEARNER_IDENTITY_DIGEST_KEY;
  process.env.LEARNER_IDENTITY_DIGEST_KEY =
    "test-only-learner-identity-key-0123456789";
  t.after(() => {
    if (previous === undefined) delete process.env.LEARNER_IDENTITY_DIGEST_KEY;
    else process.env.LEARNER_IDENTITY_DIGEST_KEY = previous;
  });
  const input = {
    invitationId: "00000000-0000-4000-8000-000000000001",
    kind: "observer" as const,
    authUserId: "00000000-0000-4000-8000-000000000002",
    recipientEmailDigest: digestIdentityEmail("recipient@example.com"),
  };
  const sealed = sealIdentityEmailHandoff(input, 1_000);
  assert.doesNotMatch(sealed, /recipient|00000000/);
  assert.deepEqual(unsealIdentityEmailHandoff(sealed, 1_001), {
    ...input,
    issuedAt: 1_000,
    expiresAt: 901_000,
  });
  const [iv, encrypted, tag] = sealed.split(".");
  assert.ok(iv && encrypted && tag);
  const tamperedEncrypted = `${encrypted.startsWith("A") ? "B" : "A"}${encrypted.slice(1)}`;
  const tampered = `${iv}.${tamperedEncrypted}.${tag}`;
  assert.equal(unsealIdentityEmailHandoff(tampered, 1_001), null);
  assert.equal(unsealIdentityEmailHandoff(sealed, 901_000), null);
});

test("generated invitation tokens and share codes have usable entropy-friendly shapes", () => {
  const tokens = new Set(Array.from({ length: 32 }, generateInvitationToken));
  const codes = new Set(Array.from({ length: 32 }, generateShareCode));
  assert.equal(tokens.size, 32);
  assert.equal(codes.size, 32);
  for (const token of tokens) assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  for (const code of codes)
    assert.match(code, /^[23456789A-HJ-NP-Z]{5}-[23456789A-HJ-NP-Z]{5}$/);
});
