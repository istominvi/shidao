import { NextResponse } from "next/server";
import {
  getLearnerIdentityContext,
  learnerIdentityApiError,
} from "@/modules/learner-identity/server-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const status = new URL(request.url).searchParams.get("status") ?? "active";
    const { actor, service } = await getLearnerIdentityContext();
    return NextResponse.json({
      learners: await service.listTeacherDirectory(actor, status),
    });
  } catch (error) {
    return learnerIdentityApiError(error);
  }
}
