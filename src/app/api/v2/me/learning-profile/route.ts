import { NextResponse } from "next/server";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json({ profile: await service.getSelfProfile(actor) });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
