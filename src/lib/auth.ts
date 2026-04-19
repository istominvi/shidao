export type ProfileKind = "parent" | "teacher";
export type ActorKind = "adult" | "student";

export const PROFILE_LABELS: Record<ProfileKind, string> = {
  parent: "Кабинет родителя",
  teacher: "Кабинет преподавателя",
};

export const ROUTES = {
  home: "/",
  login: "/login",
  join: "/join",
  joinCheckEmail: "/join/check-email",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  groups: "/groups",
  groupsNew: "/groups/new",
  lessons: "/lessons",
  methodologies: "/methodologies",
  settings: "/settings",
  settingsSecurity: "/settings/security",
  settingsProfile: "/settings/profile",
  settingsTeam: "/settings/team",
} as const;

export const AUTH_MESSAGES = {
  invalidCredentials: "Неверные данные для входа.",
  temporarilyUnavailable: "Вход временно недоступен, попробуйте позже.",
  genericAuthError: "Не удалось выполнить запрос авторизации.",
} as const;

const STUDENT_AUTH_DOMAIN = "students.shidao.internal";

export function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export function isEmail(value: string) {
  return /.+@.+\..+/.test(value);
}

export function toStudentInternalAuthEmail(login: string) {
  return `${normalizeIdentifier(login)}@${STUDENT_AUTH_DOMAIN}`;
}

export function isStudentInternalAuthEmail(email: string | null | undefined) {
  if (!email) return false;
  const [, domain = ""] = normalizeIdentifier(email).split("@");
  return domain === STUDENT_AUTH_DOMAIN;
}

export function toProfileLabel(profile: ProfileKind) {
  return PROFILE_LABELS[profile];
}

export function toInitials(fullName?: string | null, email?: string | null) {
  const source = (fullName ?? "").trim();
  if (source) {
    const parts = source.split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
  }

  const local = (email ?? "").split("@")[0]?.trim();
  if (!local) return "U";
  return local.slice(0, 2).toUpperCase();
}

export function toGroupRoute(groupId: string) {
  return `${ROUTES.groups}/${encodeURIComponent(groupId)}`;
}

export function toScheduledLessonRoute(scheduledLessonId: string) {
  return `${ROUTES.lessons}/${encodeURIComponent(scheduledLessonId)}`;
}

export function toLessonWorkspaceRoute(scheduledLessonId: string) {
  return toScheduledLessonRoute(scheduledLessonId);
}


export function toMethodologyRoute(methodologySlug: string) {
  return `${ROUTES.methodologies}/${encodeURIComponent(methodologySlug)}`;
}

export function toMethodologyLessonRoute(methodologySlug: string, lessonId: string) {
  return `${toMethodologyRoute(methodologySlug)}/lessons/${encodeURIComponent(lessonId)}`;
}
