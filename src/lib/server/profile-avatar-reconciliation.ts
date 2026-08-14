import {
  getCurrentAccountAuthContext,
  type AccountAvatarAuthContext,
} from "@/lib/server/account-auth";
import { isSessionRevoked } from "@/lib/server/app-session";

export type ProfileAvatarReconciliationOutcome =
  | { status: "committed"; avatar: AccountAvatarAuthContext }
  | { status: "not_committed" }
  | { status: "ambiguous" };

type ReconciliationDependencies = {
  readAccount?: typeof getCurrentAccountAuthContext;
};

export async function reconcileProfileAvatarCustomSwitch(
  input: {
    accessToken: string;
    accountId: string;
    authUserId: string;
    sessionIssuedAt: number;
    storagePath: string;
  },
  dependencies: ReconciliationDependencies = {},
): Promise<ProfileAvatarReconciliationOutcome> {
  try {
    const account = await (
      dependencies.readAccount ?? getCurrentAccountAuthContext
    )(input.accessToken);
    if (
      account.accountId !== input.accountId ||
      account.authUserId !== input.authUserId ||
      isSessionRevoked(input.sessionIssuedAt, account.sessionsInvalidBefore)
    ) {
      return { status: "ambiguous" };
    }

    if (
      account.avatar.kind === "custom" &&
      account.avatar.storagePath === input.storagePath
    ) {
      return { status: "committed", avatar: account.avatar };
    }
    return { status: "not_committed" };
  } catch {
    return { status: "ambiguous" };
  }
}
