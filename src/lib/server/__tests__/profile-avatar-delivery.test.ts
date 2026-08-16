import assert from "node:assert/strict";
import test from "node:test";
import {
  createProfileAvatarDeliveryKey,
  PROFILE_AVATAR_DELIVERY_KEY_PATTERN,
} from "../profile-avatar-delivery";

test("profile avatar delivery keys isolate Account identity and revision", () => {
  const previousSecret = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET =
    "profile-avatar-delivery-test-secret-with-32-chars";

  try {
    const first = createProfileAvatarDeliveryKey({
      authUserId: "11111111-1111-4111-8111-111111111111",
      revision: 1,
    });
    const same = createProfileAvatarDeliveryKey({
      authUserId: "11111111-1111-4111-8111-111111111111",
      revision: 1,
    });
    const nextRevision = createProfileAvatarDeliveryKey({
      authUserId: "11111111-1111-4111-8111-111111111111",
      revision: 2,
    });
    const otherAccount = createProfileAvatarDeliveryKey({
      authUserId: "22222222-2222-4222-8222-222222222222",
      revision: 1,
    });

    assert.match(first, PROFILE_AVATAR_DELIVERY_KEY_PATTERN);
    assert.equal(first, same);
    assert.notEqual(first, nextRevision);
    assert.notEqual(first, otherAccount);
    assert.doesNotMatch(first, /11111111|22222222/);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.APP_SESSION_SECRET;
    } else {
      process.env.APP_SESSION_SECRET = previousSecret;
    }
  }
});
