import { NextRequest, NextResponse } from "next/server";
import { ROUTES, type ProfileKind } from "@/lib/auth";
import { readAppSession } from "@/lib/server/app-session";
import {
  ensureUserPreference,
  getUserContextById,
  setLastActiveProfile,
  upsertParentProfile,
  upsertTeacherProfile,
} from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

type Payload = { profile?: ProfileKind };

export async function POST(req: NextRequest) {
  const session = await readAppSession();
  if (!session)
    return NextResponse.json({ error: "Не авторизовано." }, { status: 401 });

  const body = (await req.json()) as Payload;
  if (!body.profile || !["parent", "teacher"].includes(body.profile)) {
    return NextResponse.json(
      { error: "Некорректный профиль." },
      { status: 400 },
    );
  }

  const context = await getUserContextById(session.uid);
  if (context.actorKind === "student") {
    return NextResponse.json(
      { error: "Онбординг недоступен для ученика." },
      { status: 403 },
    );
  }

  if (body.profile === "parent") {
    await upsertParentProfile(session.uid, context.fullName);
  } else {
    await upsertTeacherProfile(session.uid, context.fullName);
  }

  await ensureUserPreference(session.uid);
  await setLastActiveProfile(session.uid, body.profile);

  return NextResponse.json({ redirectTo: ROUTES.dashboard });
}
