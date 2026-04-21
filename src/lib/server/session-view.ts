import { toInitials } from "@/lib/auth";
import { GUEST_SESSION_VIEW, type SessionView } from "@/lib/session-view";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  listTeacherSchoolChoicesAdmin,
  resolveTeacherSchoolSelectionAdmin,
} from "@/lib/server/supabase-admin";

export async function readSessionViewServer(): Promise<SessionView> {
  const resolution = await resolveAccessPolicy();

  switch (resolution.status) {
    case "guest":
      return GUEST_SESSION_VIEW;
    case "degraded":
      return {
        kind: "degraded",
        authenticated: true,
        reason: "context_unavailable",
      };
    case "student": {
      const ctx = resolution.context;
      return {
        kind: "student",
        authenticated: true,
        hasPin: ctx.hasPin,
        userId: ctx.userId,
        fullName: ctx.fullName,
        email: ctx.email,
        initials: toInitials(ctx.fullName, ctx.email),
      };
    }
    case "adult-with-profile":
    case "adult-without-profile": {
      const ctx = resolution.context;
      const teacherId = ctx.teacher?.id ?? null;
      let schoolOptions: Awaited<
        ReturnType<typeof listTeacherSchoolChoicesAdmin>
      > = [];
      let selectedSchool: Awaited<
        ReturnType<typeof resolveTeacherSchoolSelectionAdmin>
      > | null = null;
      if (teacherId && ctx.actorKind === "adult") {
        try {
          schoolOptions = await listTeacherSchoolChoicesAdmin({
            teacherId,
            teacherFullName: ctx.teacher?.full_name ?? null,
          });
          selectedSchool = await resolveTeacherSchoolSelectionAdmin({
            userId: ctx.userId,
            teacherId,
            teacherFullName: ctx.teacher?.full_name ?? null,
            preferredSchoolId: ctx.preferences?.last_selected_school_id ?? null,
          });
        } catch {
          schoolOptions = [];
          selectedSchool = null;
        }
      }
      return {
        kind: "adult",
        authenticated: true,
        hasPin: ctx.hasPin,
        userId: ctx.userId,
        fullName: ctx.fullName,
        email: ctx.email,
        initials: toInitials(ctx.fullName, ctx.email),
        availableProfiles: ctx.availableAdultProfiles,
        activeProfile: ctx.activeProfile,
        schoolOptions: schoolOptions.map((option) => ({
          id: option.id,
          label: option.kind === "personal" ? "Лично" : option.name,
          kind: option.kind,
          role: option.role,
        })),
        selectedSchool: selectedSchool
          ? {
              mode: selectedSchool.mode,
              schoolId:
                selectedSchool.mode === "organization"
                  ? selectedSchool.selectedSchoolId
                  : null,
              schoolName:
                selectedSchool.mode === "organization"
                  ? selectedSchool.selectedSchoolName
                  : null,
            }
          : undefined,
      };
    }
    default: {
      const _never: never = resolution;
      return _never;
    }
  }
}
