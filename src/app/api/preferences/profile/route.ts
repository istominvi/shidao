import { NextRequest, NextResponse } from "next/server";
import { ROUTES, type ProfileKind } from "@/lib/auth";
import { readAppSession } from "@/lib/server/app-session";
import {
  getUserContextById,
  setLastActiveProfile,
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
  if (
    context.actorKind !== "adult" ||
    !context.availableAdultProfiles.includes(body.profile)
  ) {
    return NextResponse.json({ error: "Профиль недоступен." }, { status: 403 });
  }

  await setLastActiveProfile(session.uid, body.profile);
  return NextResponse.json({ redirectTo: ROUTES.dashboard });
}
