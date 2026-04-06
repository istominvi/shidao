import { NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/lib/auth";
import { apiError, parseJsonWithSchema } from "@/lib/server/api";
import { readAppSession } from "@/lib/server/app-session";
import {
  getUserContextById,
  setLastActiveProfile,
} from "@/lib/server/supabase-admin";
import { profileSwitchPayloadSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await readAppSession();
  if (!session) return apiError(401, "Не авторизовано.");

  const parsed = await parseJsonWithSchema(
    req,
    profileSwitchPayloadSchema,
    "Некорректный профиль.",
  );
  if (!parsed.ok) return parsed.response;
  const { profile } = parsed.data;

  const context = await getUserContextById(session.uid);
  if (
    context.actorKind !== "adult" ||
    !context.availableAdultProfiles.includes(profile)
  ) {
    return apiError(403, "Профиль недоступен.");
  }

  await setLastActiveProfile(session.uid, profile);
  return NextResponse.json({ redirectTo: ROUTES.dashboard });
}
