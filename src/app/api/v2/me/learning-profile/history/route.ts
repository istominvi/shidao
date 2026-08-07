import { NextResponse } from "next/server";
import { cursorQuery } from "@/modules/learner-identity/http";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json(
      await service.getSelfHistory(actor, cursorQuery(request)),
    );
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
