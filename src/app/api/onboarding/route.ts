import { NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/lib/auth";
import { apiError, parseJsonWithSchema } from "@/lib/server/api";
import { readAppSession } from "@/lib/server/app-session";
import {
  ensureUserPreference,
  getUserContextById,
  setLastActiveProfile,
  upsertParentProfile,
  upsertTeacherProfile,
} from "@/lib/server/supabase-admin";
import { onboardingPayloadSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await readAppSession();
  if (!session) return apiError(401, "Не авторизовано.");

  const parsed = await parseJsonWithSchema(
    req,
    onboardingPayloadSchema,
    "Некорректный профиль.",
  );
  if (!parsed.ok) return parsed.response;
  const { profile } = parsed.data;

  const context = await getUserContextById(session.uid);
  if (context.actorKind === "student") {
    return apiError(403, "Онбординг недоступен для ученика.");
  }

  if (profile === "parent") {
    await upsertParentProfile(session.uid, context.fullName);
  } else {
    await upsertTeacherProfile(session.uid, context.fullName);
  }

  await ensureUserPreference(session.uid);
  await setLastActiveProfile(session.uid, profile);

  return NextResponse.json({ redirectTo: ROUTES.dashboard });
}
