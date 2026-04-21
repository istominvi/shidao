import { NextRequest, NextResponse } from "next/server";
import { apiError, parseJsonWithSchema } from "@/lib/server/api";
import { readAppSession } from "@/lib/server/app-session";
import { getUserContextById, listTeacherSchoolChoicesAdmin, resolveTeacherSchoolSelectionAdmin, setLastSelectedSchool } from "@/lib/server/supabase-admin";
import { schoolSwitchPayloadSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await readAppSession();
  if (!session) return apiError(401, "Не авторизовано.");

  const parsed = await parseJsonWithSchema(
    req,
    schoolSwitchPayloadSchema,
    "Некорректный выбор школы.",
  );
  if (!parsed.ok) return parsed.response;

  const context = await getUserContextById(session.uid);
  if (context.actorKind !== "adult" || !context.teacher?.id) {
    return apiError(403, "Только преподаватель может переключать школу.");
  }

  const choices = await listTeacherSchoolChoicesAdmin({
    teacherId: context.teacher.id,
    teacherFullName: context.teacher.full_name ?? null,
  });

  let preferredSchoolId: string | null = null;
  if ("mode" in parsed.data && parsed.data.mode === "personal") {
    await setLastSelectedSchool(session.uid, null);
  } else if ("schoolId" in parsed.data) {
    const schoolId = parsed.data.schoolId;
    const target = choices.find(
      (item) => item.id === schoolId && item.kind === "organization",
    );
    if (!target) {
      return apiError(403, "Школа недоступна для выбора.");
    }
    await setLastSelectedSchool(session.uid, target.id);
    preferredSchoolId = target.id;
  } else {
    return apiError(400, "Некорректный выбор школы.");
  }

  const selected = await resolveTeacherSchoolSelectionAdmin({
    userId: session.uid,
    teacherId: context.teacher.id,
    teacherFullName: context.teacher.full_name ?? null,
    preferredSchoolId,
  });

  return NextResponse.json({
    mode: selected.mode,
    schoolId: selected.mode === "organization" ? selected.selectedSchoolId : null,
    schoolName: selected.mode === "organization" ? selected.selectedSchoolName : null,
  });
}
