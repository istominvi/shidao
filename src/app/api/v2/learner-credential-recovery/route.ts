import { NextResponse } from "next/server";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json(await service.listCredentialRecovery(actor));
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
