import {
  isStudentInternalAuthEmail,
  normalizeIdentifier,
  toStudentInternalAuthEmail,
  type ProfileKind,
  ROUTES,
} from "@/lib/auth";
import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import { logger } from "@/lib/server/logger";
import { resolvePostLoginRedirectForContext } from "@/lib/server/post-login-redirect";

type Json = Record<string, unknown>;

type SupabaseUser = {
  id: string;
  email?: string | null;
  user_metadata?:
    | {
        full_name?: string | null;
        role?: string | null;
      }
    | null;
};

type AuthSession = {
  access_token: string;
  refresh_token: string;
  user: SupabaseUser;
};

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Не настроен SUPABASE_SERVICE_ROLE_KEY для серверных admin-запросов.",
    );
  }
  return serviceRoleKey;
}

function isFunctionMissingError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("could not find the function") ||
    (normalized.includes("function") && normalized.includes("does not exist"))
  );
}

function isUniqueViolationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("duplicate key value violates unique constraint") ||
    normalized.includes("23505")
  );
}

function buildTeacherSchoolSlugBase(teacherId: string, fullName: string | null) {
  const seed = `${fullName?.trim() || "teacher"}-${teacherId.slice(0, 8)}`;
  const slug = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `school-${teacherId.slice(0, 8)}`;
}

export type TeacherSchoolChoice = {
  id: string;
  name: string;
  kind: "personal" | "organization";
  role: "owner" | "teacher";
  teacherLimit: number;
  teacherCount: number;
};

export type TeacherSchoolSelection =
  | {
      mode: "personal";
      personalSchoolId: string;
      personalSchoolName: string;
      selectedSchoolId: null;
      selectedSchoolName: null;
    }
  | {
      mode: "organization";
      personalSchoolId: string;
      personalSchoolName: string;
      selectedSchoolId: string;
      selectedSchoolName: string;
    };

function redactPayload(payload: Json | undefined) {
  if (!payload) return payload;
  const clone: Json = { ...payload };
  for (const key of ["password", "p_raw_pin", "secret"]) {
    if (key in clone) clone[key] = "[redacted]";
  }
  return clone;
}

async function request<T>(
  path: string,
  method = "GET",
  options?: {
    payload?: Json;
    accessToken?: string;
    admin?: boolean;
    allowEmpty?: boolean;
    extraHeaders?: Record<string, string>;
  },
) {
  const { url, anonKey } = getSupabasePublicConfig();
  const apiKey = options?.admin ? getServiceRoleKey() : anonKey;
  const bearer = options?.admin ? apiKey : (options?.accessToken ?? anonKey);

  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      ...(method !== "GET" ? { Prefer: "return=representation" } : {}),
      ...(options?.extraHeaders ?? {}),
    },
    body: options?.payload ? JSON.stringify(options.payload) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as {
      message?: string;
      msg?: string;
      code?: string;
    } | null;
    const details =
      payloadError?.message ??
      payloadError?.msg ??
      "Ошибка запроса к Supabase.";
    logger.error("[supabase-admin] request failed", {
      path,
      method,
      status: response.status,
      code: payloadError?.code,
      details,
      payload: redactPayload(options?.payload),
    });
    throw new Error(details);
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (!text) {
    if (options?.allowEmpty) return null as T;
    throw new Error("Пустой ответ Supabase.");
  }

  return JSON.parse(text) as T;
}

function parseAuthAdminUser(payload: unknown): SupabaseUser {
  if (payload && typeof payload === "object") {
    const maybeWrapped = payload as { user?: SupabaseUser };
    if (maybeWrapped.user?.id) return maybeWrapped.user;

    const maybeDirect = payload as SupabaseUser;
    if (maybeDirect.id) return maybeDirect;
  }

  throw new Error("Неожиданная форма ответа /auth/v1/admin/users/{id}.");
}

async function authPasswordSignIn(email: string, password: string) {
  const { url, anonKey } = getSupabasePublicConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as {
      message?: string;
      msg?: string;
      code?: string;
    } | null;
    logger.warn("[auth-login] password grant rejected", {
      status: response.status,
      code: payloadError?.code,
      message:
        payloadError?.message ?? payloadError?.msg ?? "Unknown auth failure",
      email,
    });
    return null;
  }

  return (await response.json()) as AuthSession;
}

export async function trySignInWithPassword(email: string, password: string) {
  return authPasswordSignIn(email, password);
}

export async function findStudentAuthEmail(login: string) {
  const rows = await request<
    Array<{ internal_auth_email: string | null; user_id: string | null }>
  >(
    `/rest/v1/student?select=internal_auth_email,user_id&login=eq.${encodeURIComponent(normalizeIdentifier(login))}`,
    "GET",
    { admin: true },
  );

  if (!rows[0]?.internal_auth_email || !rows[0]?.user_id) {
    return null;
  }

  return { email: rows[0].internal_auth_email, userId: rows[0].user_id };
}

export async function verifyUserPin(userId: string, rawPin: string) {
  const result = await request<boolean>(
    "/rest/v1/rpc/verify_user_pin",
    "POST",
    {
      admin: true,
      payload: {
        p_user_id: userId,
        p_raw_pin: rawPin,
      },
    },
  );

  return Boolean(result);
}

export async function setUserPin(userId: string, rawPin: string) {
  await request("/rest/v1/rpc/set_user_pin", "POST", {
    admin: true,
    payload: {
      p_user_id: userId,
      p_raw_pin: rawPin,
    },
  });
}

export async function hasUserPin(userId: string) {
  const rows = await request<Array<{ pin_hash: string | null }>>(
    `/rest/v1/user_security?select=pin_hash&user_id=eq.${userId}&limit=1`,
    "GET",
    {
      admin: true,
    },
  );
  return Boolean(rows[0]?.pin_hash);
}

export async function ensureUserPreference(userId: string) {
  try {
    await request("/rest/v1/rpc/ensure_user_preference", "POST", {
      admin: true,
      payload: { p_user_id: userId },
    });
    return;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown ensure_user_preference error";
    logger.warn(
      "[auth-login] ensure_user_preference rpc failed, fallback to direct upsert",
      { userId, message },
    );

    if (!isFunctionMissingError(message)) {
      throw error;
    }
  }

  await request("/rest/v1/user_preference", "POST", {
    admin: true,
    payload: { user_id: userId },
    extraHeaders: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
  });
}

export async function setLastActiveProfile(
  userId: string,
  profile: ProfileKind,
) {
  try {
    await request("/rest/v1/rpc/set_last_active_profile", "POST", {
      admin: true,
      payload: { p_user_id: userId, p_profile: profile },
    });
    return;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown set_last_active_profile error";
    if (!isFunctionMissingError(message)) {
      throw error;
    }
    logger.warn(
      "[user-context] set_last_active_profile rpc missing, fallback to patch",
      { userId, profile },
    );
  }

  await ensureUserPreference(userId);
  await request("/rest/v1/user_preference?user_id=eq." + userId, "PATCH", {
    admin: true,
    payload: { last_active_profile: profile },
    allowEmpty: true,
  });
}

export async function setLastSelectedSchool(
  userId: string,
  schoolId: string | null,
) {
  try {
    await request("/rest/v1/rpc/set_last_selected_school", "POST", {
      admin: true,
      payload: { p_user_id: userId, p_school_id: schoolId },
      allowEmpty: true,
    });
    return;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown set_last_selected_school error";
    if (!isFunctionMissingError(message)) {
      throw error;
    }
  }

  await ensureUserPreference(userId);
  await request(`/rest/v1/user_preference?user_id=eq.${userId}`, "PATCH", {
    admin: true,
    payload: { last_selected_school_id: schoolId },
    allowEmpty: true,
  });
}

async function ensureTeacherPersonalSchoolAdmin(input: {
  teacherId: string;
  fullName: string | null;
}): Promise<{ schoolId: string; schoolName: string }> {
  const memberships = await request<
    Array<{
      school_id: string;
      role: "owner" | "teacher";
      school: { id: string; name: string | null; kind: string | null } | null;
    }>
  >(
    `/rest/v1/school_teacher?select=school_id,role,school:school_id(id,name,kind)&teacher_id=eq.${input.teacherId}&order=created_at.asc`,
    "GET",
    { admin: true },
  );

  const personalMembership = memberships.find(
    (membership) => membership.school?.kind === "personal",
  );
  if (personalMembership?.school?.id) {
    return {
      schoolId: personalMembership.school.id,
      schoolName: personalMembership.school.name?.trim() || "Личное пространство",
    };
  }

  const baseSlug = buildTeacherSchoolSlugBase(input.teacherId, input.fullName);
  const schoolName = `${input.fullName?.trim() || "Преподаватель"} — личное`;
  let schoolId = "";
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      const schoolRows = await request<Array<{ id: string }>>("/rest/v1/school", "POST", {
        admin: true,
        payload: {
          name: schoolName,
          slug,
          kind: "personal",
          owner_teacher_id: input.teacherId,
          teacher_limit: 1,
          plan_code: "demo",
          subscription_status: "active",
        },
      });
      schoolId = schoolRows[0]?.id ?? "";
      break;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown school insert error";
      if (!isUniqueViolationError(message)) throw error;
    }
  }

  if (!schoolId) {
    throw new Error("Не удалось создать личное пространство преподавателя.");
  }

  try {
    await request("/rest/v1/school_teacher", "POST", {
      admin: true,
      payload: {
        school_id: schoolId,
        teacher_id: input.teacherId,
        role: "owner",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown school_teacher insert error";
    if (!isUniqueViolationError(message)) throw error;
  }

  return { schoolId, schoolName };
}

export async function listTeacherSchoolChoicesAdmin(input: {
  teacherId: string;
  teacherFullName: string | null;
}) {
  const personal = await ensureTeacherPersonalSchoolAdmin({
    teacherId: input.teacherId,
    fullName: input.teacherFullName,
  });

  const rows = await request<
    Array<{
      school_id: string;
      role: "owner" | "teacher";
      school: {
        id: string;
        name: string | null;
        kind: string | null;
        teacher_limit: number | null;
      } | null;
    }>
  >(
    `/rest/v1/school_teacher?select=school_id,role,school:school_id(id,name,kind,teacher_limit)&teacher_id=eq.${input.teacherId}&order=created_at.asc`,
    "GET",
    { admin: true },
  );

  const counts = await Promise.all(
    rows.map(async (row) => {
      const teacherRows = await request<Array<{ teacher_id: string }>>(
        `/rest/v1/school_teacher?select=teacher_id&school_id=eq.${row.school_id}`,
        "GET",
        { admin: true },
      );
      return [row.school_id, teacherRows.length] as const;
    }),
  );
  const countBySchoolId = Object.fromEntries(counts);

  const items: TeacherSchoolChoice[] = rows
    .map((row) => {
      if (!row.school?.id) return null;
      const kind =
        row.school.kind === "organization" ? "organization" : "personal";
      return {
        id: row.school.id,
        name: row.school.name?.trim() || "Школа",
        kind,
        role: row.role,
        teacherLimit: row.school.teacher_limit ?? (kind === "organization" ? 5 : 1),
        teacherCount: countBySchoolId[row.school_id] ?? 0,
      } as TeacherSchoolChoice;
    })
    .filter((item): item is TeacherSchoolChoice => Boolean(item));

  if (!items.some((item) => item.id === personal.schoolId)) {
    items.unshift({
      id: personal.schoolId,
      name: personal.schoolName,
      kind: "personal",
      role: "owner",
      teacherLimit: 1,
      teacherCount: 1,
    });
  }

  return items;
}

export async function resolveTeacherSchoolSelectionAdmin(input: {
  userId: string;
  teacherId: string;
  teacherFullName: string | null;
  preferredSchoolId: string | null;
}): Promise<TeacherSchoolSelection> {
  const choices = await listTeacherSchoolChoicesAdmin({
    teacherId: input.teacherId,
    teacherFullName: input.teacherFullName,
  });
  const personal = choices.find((item) => item.kind === "personal");
  if (!personal) {
    throw new Error("Личное пространство преподавателя не найдено.");
  }

  const preferred = choices.find(
    (item) => item.id === input.preferredSchoolId && item.kind === "organization",
  );
  if (!preferred) {
    await setLastSelectedSchool(input.userId, null);
    return {
      mode: "personal",
      personalSchoolId: personal.id,
      personalSchoolName: personal.name,
      selectedSchoolId: null,
      selectedSchoolName: null,
    };
  }

  return {
    mode: "organization",
    personalSchoolId: personal.id,
    personalSchoolName: personal.name,
    selectedSchoolId: preferred.id,
    selectedSchoolName: preferred.name,
  };
}

export async function resolvePostLoginRedirect(userId: string) {
  try {
    const [studentRows, parentRows, teacherRows] = await Promise.all([
      request<Array<{ id: string }>>(
        `/rest/v1/student?select=id&user_id=eq.${userId}&limit=1`,
        "GET",
        { admin: true },
      ),
      request<Array<{ id: string }>>(
        `/rest/v1/parent?select=id&user_id=eq.${userId}&limit=1`,
        "GET",
        { admin: true },
      ),
      request<Array<{ id: string }>>(
        `/rest/v1/teacher?select=id&user_id=eq.${userId}&limit=1`,
        "GET",
        { admin: true },
      ),
    ]);

    return resolvePostLoginRedirectForContext({
      actorKind: studentRows[0]?.id ? "student" : "adult",
      hasAnyAdultProfile: Boolean(parentRows[0]?.id || teacherRows[0]?.id),
      activeAdultProfile: teacherRows[0]?.id ? "teacher" : parentRows[0]?.id ? "parent" : null,
    });
  } catch (error) {
    logger.error(
      "[auth-login] failed to resolve post-login route, fallback to lessons",
      { userId, error },
    );
    return ROUTES.lessons;
  }
}

type SessionFallback = {
  email?: string | null;
  fullName?: string | null;
  expectedActorKind?: "adult" | "student";
};

type StudentNameFields = {
  firstName?: string | null;
  lastName?: string | null;
  login?: string | null;
};

type Settled<T> = PromiseSettledResult<T>;

function formatStudentFullName(input: StudentNameFields) {
  const firstName = input.firstName?.trim() ?? "";
  const lastName = input.lastName?.trim() ?? "";
  const login = input.login?.trim() ?? "";
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim();
  return combined || firstName || login || null;
}

function splitStudentFullName(fullName?: string | null) {
  const normalized = fullName?.trim() ?? "";
  if (!normalized) return { firstName: null, lastName: null };

  const [firstName, ...rest] = normalized.split(/\s+/);
  const lastName = rest.join(" ").trim();

  return {
    firstName: firstName || null,
    lastName: lastName || null,
  };
}

function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

function logUserContextPartFailure(
  userId: string,
  query: { part: string; select: string; path: string },
  result: Settled<unknown>,
) {
  if (result.status === "rejected") {
    const errorMessage =
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
    logger.error("[user-context] failed to load part", {
      userId,
      part: query.part,
      select: query.select,
      path: query.path,
      error: errorMessage,
    });
  }
}

export async function getUserContextById(
  userId: string,
  fallback?: SessionFallback,
) {
  const startedAt = Date.now();
  const userContextQueries = {
    parent: {
      part: "parent query",
      select: "id,full_name",
      path: `/rest/v1/parent?select=id,full_name&user_id=eq.${userId}&limit=1`,
    },
    teacher: {
      part: "teacher query",
      select: "id,full_name",
      path: `/rest/v1/teacher?select=id,full_name&user_id=eq.${userId}&limit=1`,
    },
    student: {
      part: "student query",
      select: "id,login,first_name,last_name",
      path: `/rest/v1/student?select=id,login,first_name,last_name&user_id=eq.${userId}&limit=1`,
    },
    preference: {
      part: "user_preference query",
      select: "last_active_profile,last_selected_school_id,theme,settings",
      path: `/rest/v1/user_preference?select=last_active_profile,last_selected_school_id,theme,settings&user_id=eq.${userId}&limit=1`,
    },
    security: {
      part: "user_security query",
      select: "pin_hash",
      path: `/rest/v1/user_security?select=pin_hash&user_id=eq.${userId}&limit=1`,
    },
    authUser: {
      part: "/auth/v1/admin/users/{id}",
      select: "admin auth user payload",
      path: `/auth/v1/admin/users/${userId}`,
    },
  };

  const [
    parentResult,
    teacherResult,
    studentResult,
    prefResult,
    securityResult,
    authAdminUserResult,
  ] = await Promise.allSettled([
    request<Array<{ id: string; full_name: string | null }>>(
      userContextQueries.parent.path,
      "GET",
      { admin: true },
    ),
    request<Array<{ id: string; full_name: string | null }>>(
      userContextQueries.teacher.path,
      "GET",
      { admin: true },
    ),
    request<
      Array<{
        id: string;
        login: string;
        first_name: string | null;
        last_name: string | null;
      }>
    >(userContextQueries.student.path, "GET", {
      admin: true,
    }),
    request<
      Array<{
        last_active_profile: ProfileKind | null;
        last_selected_school_id: string | null;
        theme: string | null;
        settings: Record<string, unknown>;
      }>
    >(userContextQueries.preference.path, "GET", { admin: true }),
    request<Array<{ pin_hash: string | null }>>(
      userContextQueries.security.path,
      "GET",
      { admin: true },
    ),
    request<unknown>(userContextQueries.authUser.path, "GET", { admin: true }),
  ]);

  logUserContextPartFailure(userId, userContextQueries.parent, parentResult);
  logUserContextPartFailure(userId, userContextQueries.teacher, teacherResult);
  logUserContextPartFailure(userId, userContextQueries.student, studentResult);
  logUserContextPartFailure(userId, userContextQueries.preference, prefResult);
  logUserContextPartFailure(
    userId,
    userContextQueries.security,
    securityResult,
  );
  logUserContextPartFailure(
    userId,
    userContextQueries.authUser,
    authAdminUserResult,
  );

  const blockingParts: Array<{ part: string; result: Settled<unknown> }> = [
    { part: "parent query", result: parentResult },
    { part: "teacher query", result: teacherResult },
    { part: "user_preference query", result: prefResult },
    { part: "user_security query", result: securityResult },
  ];

  const blockingFailures = blockingParts
    .filter(({ result }) => result.status === "rejected")
    .map(({ part }) => part);

  if (blockingFailures.length > 0) {
    logger.error("[user-context] blocking failures while resolving context", {
      userId,
      blockingFailures,
    });
    throw new Error(
      `Не удалось загрузить контекст пользователя (${blockingFailures.join(", ")}).`,
    );
  }

  const parentRows =
    parentResult.status === "fulfilled" ? parentResult.value : [];
  const teacherRows =
    teacherResult.status === "fulfilled" ? teacherResult.value : [];
  const studentRows =
    studentResult.status === "fulfilled" ? studentResult.value : [];
  const prefRows = prefResult.status === "fulfilled" ? prefResult.value : [];
  const securityRows =
    securityResult.status === "fulfilled" ? securityResult.value : [];

  let authUser: SupabaseUser | null = null;
  if (authAdminUserResult.status === "fulfilled") {
    try {
      authUser = parseAuthAdminUser(authAdminUserResult.value);
    } catch (error) {
      logger.warn(
        "[user-context] failed to parse auth admin payload; fallback to app-session fields",
        { userId, error },
      );
    }
  } else {
    logger.warn(
      "[user-context] admin user fetch unavailable; fallback to app-session fields",
      { userId },
    );
  }

  const student = studentRows[0] ?? null;
  const teacher = teacherRows[0] ?? null;
  const parent = parentRows[0] ?? null;
  const pref = prefRows[0] ?? null;
  const profileChoices = [
    teacher ? "teacher" : null,
    parent ? "parent" : null,
  ].filter(Boolean) as ProfileKind[];

  let activeProfile: ProfileKind | null = null;
  if (profileChoices.length === 1) {
    activeProfile = profileChoices[0];
  } else if (profileChoices.length === 2) {
    activeProfile =
      pref?.last_active_profile &&
      profileChoices.includes(pref.last_active_profile)
        ? pref.last_active_profile
        : "parent";
  }

  const authFullNameRaw = authUser?.user_metadata?.full_name;
  const authFullName = typeof authFullNameRaw === "string" ? authFullNameRaw : null;
  const fallbackFullName =
    typeof fallback?.fullName === "string" ? fallback.fullName : null;
  const resolvedFullName =
    authFullName ??
    fallbackFullName ??
    parent?.full_name ??
    teacher?.full_name ??
    formatStudentFullName({
      firstName: student?.first_name,
      lastName: student?.last_name,
      login: student?.login,
    }) ??
    null;

  const authEmailRaw = authUser?.email;
  const authEmail = typeof authEmailRaw === "string" ? authEmailRaw : null;
  const fallbackEmail = typeof fallback?.email === "string" ? fallback.email : null;
  const resolvedEmail = authEmail ?? fallbackEmail ?? null;
  const metadataRoleRaw = authUser?.user_metadata?.role;
  const metadataRole =
    typeof metadataRoleRaw === "string"
      ? metadataRoleRaw.trim().toLowerCase()
      : null;
  const metadataSuggestsStudent = metadataRole === "student";
  const emailSuggestsStudent = isStudentInternalAuthEmail(resolvedEmail);
  const fallbackSuggestsStudent = fallback?.expectedActorKind === "student";
  const shouldTreatAsStudent =
    metadataSuggestsStudent || emailSuggestsStudent || fallbackSuggestsStudent;
  const studentPartFailed = studentResult.status === "rejected";

  if (shouldTreatAsStudent && studentPartFailed) {
    throw new Error(
      "Не удалось подтвердить student-контекст пользователя (student query failed).",
    );
  }

  if (shouldTreatAsStudent && !student) {
    throw new Error(
      "Не удалось подтвердить student-контекст пользователя (student row missing).",
    );
  }

  logger.info("[user-context] resolved context", {
    userId,
    actorKind: student ? "student" : "adult",
    hasParent: Boolean(parent),
    hasTeacher: Boolean(teacher),
    hasStudent: Boolean(student),
    shouldTreatAsStudent,
    usedAuthAdmin: Boolean(authUser),
    usedFallbackEmail: !authEmail && Boolean(fallbackEmail),
    usedFallbackFullName: !authFullName && Boolean(fallbackFullName),
    durationMs: Date.now() - startedAt,
  });

  return {
    userId,
    email: resolvedEmail,
    fullName: resolvedFullName,
    actorKind: student ? ("student" as const) : ("adult" as const),
    student,
    teacher,
    parent,
    preferences: pref,
    activeProfile,
    availableAdultProfiles: profileChoices,
    hasAnyAdultProfile: Boolean(parent || teacher),
    hasPin: Boolean(securityRows[0]?.pin_hash),
  };
}

export async function upsertParentProfile(
  userId: string,
  fullName: string | null,
) {
  return request<string>("/rest/v1/rpc/onboard_parent", "POST", {
    admin: true,
    payload: { p_user_id: userId, p_full_name: fullName },
  });
}

export async function findAuthUserByEmailAdmin(email: string): Promise<{
  id: string;
  email: string | null;
  user_metadata?: { full_name?: string | null } | null;
} | null> {
  const normalizedEmail = normalizeEmailAddress(email);
  if (!normalizedEmail) {
    return null;
  }

  const perPage = 100;
  for (let page = 1; page <= 10; page += 1) {
    const payload = await request<{
      users?: SupabaseUser[];
      next_page?: number | null;
    }>(
      `/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      "GET",
      { admin: true },
    );

    const users = Array.isArray(payload?.users) ? payload.users : [];
    const matched = users.find(
      (user) => normalizeEmailAddress(user.email ?? "") === normalizedEmail,
    );
    if (matched) {
      return {
        id: matched.id,
        email: matched.email ?? null,
        user_metadata: matched.user_metadata ?? null,
      };
    }

    if (!payload?.next_page) {
      break;
    }
  }

  return null;
}

export async function getAuthUsersByIdsAdmin(userIds: string[]): Promise<
  Record<
    string,
    { id: string; email: string | null; user_metadata?: { full_name?: string | null } | null }
  >
> {
  const normalizedIds = Array.from(
    new Set(userIds.map((userId) => userId.trim()).filter(Boolean)),
  );

  const result: Record<
    string,
    { id: string; email: string | null; user_metadata?: { full_name?: string | null } | null }
  > = {};

  for (const userId of normalizedIds) {
    try {
      const payload = await request<unknown>(`/auth/v1/admin/users/${userId}`, "GET", {
        admin: true,
      });
      const user = parseAuthAdminUser(payload);
      result[userId] = {
        id: user.id,
        email: user.email ?? null,
        user_metadata: user.user_metadata ?? null,
      };
    } catch {
      // noop for users that cannot be loaded
    }
  }

  return result;
}

export async function ensureParentProfileForUserAdmin(input: {
  userId: string;
  fullName?: string | null;
}): Promise<{ parentId: string }> {
  const userId = input.userId.trim();
  if (!userId) {
    throw new Error("Не удалось привязать родителя.");
  }

  const rows = await request<Array<{ id: string; full_name: string | null }>>(
    `/rest/v1/parent?select=id,full_name&user_id=eq.${userId}&limit=1`,
    "GET",
    { admin: true },
  );
  const existing = rows[0] ?? null;
  const fullName = input.fullName?.trim() || null;

  if (existing?.id) {
    if (fullName && !existing.full_name?.trim()) {
      await request(`/rest/v1/parent?id=eq.${existing.id}`, "PATCH", {
        admin: true,
        payload: { full_name: fullName },
        allowEmpty: true,
      });
    }
    await ensureUserPreference(userId);
    return { parentId: existing.id };
  }

  const inserted = await request<Array<{ id: string }>>("/rest/v1/parent", "POST", {
    admin: true,
    payload: { user_id: userId, full_name: fullName },
  }).catch(async (error) => {
    const message =
      error instanceof Error ? error.message : "Unknown parent insert error";
    if (!isUniqueViolationError(message)) {
      throw error;
    }
    return [] as Array<{ id: string }>;
  });
  let parentId = inserted[0]?.id;
  if (!parentId) {
    const onboardedParentId = await upsertParentProfile(userId, fullName);
    parentId = onboardedParentId?.trim() || "";
  }
  if (!parentId) {
    throw new Error("Не удалось привязать родителя.");
  }

  await ensureUserPreference(userId);
  return { parentId };
}

export async function resolveOptionalParentLinkByEmailAdmin(input: {
  parentEmail?: string | null;
  parentFullName?: string | null;
}): Promise<string | null> {
  const parentEmail = input.parentEmail?.trim() ?? "";
  if (!parentEmail) {
    return null;
  }

  const authUser = await findAuthUserByEmailAdmin(parentEmail);
  if (!authUser?.id) {
    throw new Error(
      "Родитель с таким email ещё не зарегистрирован. Попросите родителя создать аккаунт или оставьте поле пустым.",
    );
  }

  const { parentId } = await ensureParentProfileForUserAdmin({
    userId: authUser.id,
    fullName:
      input.parentFullName?.trim() ||
      authUser.user_metadata?.full_name?.trim() ||
      null,
  });
  return parentId;
}

export async function updateStudentParentLinkAsAdmin(input: {
  classId: string;
  studentId: string;
  parentId: string | null;
}): Promise<void> {
  const membershipRows = await request<Array<{ class_id: string; student_id: string }>>(
    `/rest/v1/class_student?select=class_id,student_id&class_id=eq.${input.classId}&student_id=eq.${input.studentId}&limit=1`,
    "GET",
    { admin: true },
  );

  if (!membershipRows[0]) {
    throw new Error("Ученик не найден в этой группе.");
  }

  await request(`/rest/v1/student?id=eq.${input.studentId}`, "PATCH", {
    admin: true,
    payload: { parent_id: input.parentId },
    allowEmpty: true,
  });
}

export async function upsertTeacherProfile(
  userId: string,
  fullName: string | null,
) {
  try {
    return await request<
      Array<{ teacher_id: string; school_id: string; class_id: string | null }>
    >("/rest/v1/rpc/onboard_teacher", "POST", {
      admin: true,
      payload: { p_user_id: userId, p_full_name: fullName },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown onboard_teacher error";
    logger.warn(
      "[onboarding] onboard_teacher rpc failed, fallback to direct upsert flow",
      { userId, message },
    );
  }

  return upsertTeacherProfileFallback(userId, fullName);
}

export async function ensureTeacherProfileForUserAdmin(input: {
  userId: string;
  fullName?: string | null;
}): Promise<{ teacherId: string }> {
  const userId = input.userId.trim();
  if (!userId) {
    throw new Error("Не удалось определить пользователя преподавателя.");
  }

  const rows = await request<Array<{ id: string; full_name: string | null }>>(
    `/rest/v1/teacher?select=id,full_name&user_id=eq.${userId}&limit=1`,
    "GET",
    { admin: true },
  );
  const existing = rows[0];
  const fullName = input.fullName?.trim() || null;

  if (existing?.id) {
    if (fullName && !existing.full_name?.trim()) {
      await request(`/rest/v1/teacher?id=eq.${existing.id}`, "PATCH", {
        admin: true,
        payload: { full_name: fullName },
        allowEmpty: true,
      });
    }
    return { teacherId: existing.id };
  }

  const inserted = await request<Array<{ id: string }>>("/rest/v1/teacher", "POST", {
    admin: true,
    payload: { user_id: userId, full_name: fullName },
  }).catch(async (error) => {
    const message =
      error instanceof Error ? error.message : "Unknown teacher insert error";
    if (!isUniqueViolationError(message)) throw error;
    return [] as Array<{ id: string }>;
  });
  const teacherId =
    inserted[0]?.id ??
    (
      await request<Array<{ id: string }>>(
        `/rest/v1/teacher?select=id&user_id=eq.${userId}&limit=1`,
        "GET",
        { admin: true },
      )
    )[0]?.id;

  if (!teacherId) {
    throw new Error("Не удалось создать профиль преподавателя.");
  }

  return { teacherId };
}

async function upsertTeacherProfileFallback(
  userId: string,
  fullName: string | null,
) {
  let teacherId = "";
  const teacherLookup = await request<Array<{ id: string }>>(
    `/rest/v1/teacher?select=id&user_id=eq.${userId}&limit=1`,
    "GET",
    { admin: true },
  );

  teacherId = teacherLookup[0]?.id ?? "";

  if (teacherId) {
    if (fullName !== null) {
      await request(`/rest/v1/teacher?user_id=eq.${userId}`, "PATCH", {
        admin: true,
        payload: { full_name: fullName },
        allowEmpty: true,
      });
    }
  } else {
    try {
      const teacherRows = await request<Array<{ id: string }>>(
        "/rest/v1/teacher",
        "POST",
        {
          admin: true,
          payload: { user_id: userId, full_name: fullName },
        },
      );
      teacherId = teacherRows[0]?.id ?? "";
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown teacher insert error";
      if (!isUniqueViolationError(message)) {
        throw error;
      }
      const teacherAfterConflict = await request<Array<{ id: string }>>(
        `/rest/v1/teacher?select=id&user_id=eq.${userId}&limit=1`,
        "GET",
        { admin: true },
      );
      teacherId = teacherAfterConflict[0]?.id ?? "";
    }
  }

  if (!teacherId) {
    throw new Error("Не удалось определить teacher.id после upsert.");
  }

  let schoolId = "";
  const ownerMembership = await request<Array<{ school_id: string }>>(
    `/rest/v1/school_teacher?select=school_id&teacher_id=eq.${teacherId}&role=eq.owner&limit=1`,
    "GET",
    { admin: true },
  );
  schoolId = ownerMembership[0]?.school_id ?? "";

  if (!schoolId) {
    const anyMembership = await request<Array<{ school_id: string }>>(
      `/rest/v1/school_teacher?select=school_id&teacher_id=eq.${teacherId}&order=created_at.asc&limit=1`,
      "GET",
      { admin: true },
    );
    schoolId = anyMembership[0]?.school_id ?? "";
  }

  if (!schoolId) {
    const baseSlug = buildTeacherSchoolSlugBase(teacherId, fullName);
    const schoolName = `${fullName?.trim() || "Преподаватель"} — личное`;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      try {
        const schoolRows = await request<Array<{ id: string }>>(
          "/rest/v1/school",
          "POST",
          {
            admin: true,
            payload: {
              name: schoolName,
              slug,
              kind: "personal",
              owner_teacher_id: teacherId,
              teacher_limit: 1,
              plan_code: "demo",
              subscription_status: "active",
            },
          },
        );
        schoolId = schoolRows[0]?.id ?? "";
        break;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown school insert error";
        if (!isUniqueViolationError(message)) {
          throw error;
        }
      }
    }
  }

  if (!schoolId) {
    throw new Error("Не удалось создать или определить school.id для teacher onboarding.");
  }

  const schoolTeacherRows = await request<Array<{ id: string; role: string }>>(
    `/rest/v1/school_teacher?select=id,role&school_id=eq.${schoolId}&teacher_id=eq.${teacherId}&limit=1`,
    "GET",
    { admin: true },
  );
  const schoolTeacherRow = schoolTeacherRows[0];
  if (schoolTeacherRow) {
    if (schoolTeacherRow.role !== "owner") {
      await request(
        `/rest/v1/school_teacher?id=eq.${schoolTeacherRow.id}`,
        "PATCH",
        {
          admin: true,
          payload: { role: "owner" },
          allowEmpty: true,
        },
      );
    }
  } else {
    try {
      await request("/rest/v1/school_teacher", "POST", {
        admin: true,
        payload: {
          school_id: schoolId,
          teacher_id: teacherId,
          role: "owner",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown school_teacher insert error";
      if (!isUniqueViolationError(message)) {
        throw error;
      }
    }
  }

  return [{ teacher_id: teacherId, school_id: schoolId, class_id: null }];
}

export async function loadParentLearningContextsByUser(userId: string) {
  const parentRows = await request<Array<{ id: string }>>(
    `/rest/v1/parent?select=id&user_id=eq.${userId}&limit=1`,
    "GET",
    {
      admin: true,
    },
  );
  const parentId = parentRows[0]?.id;
  if (!parentId) return [];

  type ParentStudentContextRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    login: string;
    class_student: Array<{
      class: {
        id: string;
        name: string;
        school?: { id: string; name: string } | null;
      } | null;
    }> | null;
  };

  let rows: ParentStudentContextRow[] = [];
  try {
    rows = await request<ParentStudentContextRow[]>(
      `/rest/v1/student?select=id,first_name,last_name,login,class_student(class:class_id(id,name,school:school_id(id,name)))&parent_id=eq.${parentId}&order=created_at.asc`,
      "GET",
      { admin: true },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parent context query error";
    logger.warn("[parent-dashboard] failed to load school relation for parent contexts, fallback to class-only shape", {
      userId,
      parentId,
      message,
    });

    rows = await request<ParentStudentContextRow[]>(
      `/rest/v1/student?select=id,first_name,last_name,login,class_student(class:class_id(id,name))&parent_id=eq.${parentId}&order=created_at.asc`,
      "GET",
      { admin: true },
    );
  }

  return rows.map((student) => ({
    studentId: student.id,
    studentName:
      formatStudentFullName({
        firstName: student.first_name,
        lastName: student.last_name,
        login: student.login,
      }) ?? student.login,
    login: student.login,
    classes: (student.class_student ?? [])
      .map((membership) => membership.class)
      .filter(
        (
          cls,
        ): cls is {
          id: string;
          name: string;
          school: { id: string; name: string } | null;
        } => Boolean(cls),
      )
      .map((cls) => ({
        classId: cls.id,
        className: cls.name,
        schoolId: cls.school?.id ?? "",
        schoolName: cls.school?.name ?? "Школа не указана",
      })),
  }));
}

// Existing teacher admin helpers
export async function getAuthUserFromAccessToken(accessToken: string) {
  return request<SupabaseUser>("/auth/v1/user", "GET", { accessToken });
}

export async function findTeacherByAuthUserId(
  accessToken: string,
  authUserId: string,
) {
  const rows = await request<Array<{ id: string }>>(
    `/rest/v1/teacher?select=id&user_id=eq.${authUserId}`,
    "GET",
    { accessToken },
  );
  return rows[0] ?? null;
}

export async function assertTeacherAssignedToClass(
  accessToken: string,
  teacherId: string,
  classId: string,
) {
  const rows = await request<Array<{ id: string }>>(
    `/rest/v1/class_teacher?select=id&class_id=eq.${classId}&teacher_id=eq.${teacherId}`,
    "GET",
    { accessToken },
  );

  if (!rows[0]?.id) {
    throw new Error(
      "Только преподаватель, назначенный в этот класс, может выполнять действие.",
    );
  }
}

export async function assertTeacherAssignedToClassAdmin(
  teacherId: string,
  classId: string,
) {
  const rows = await request<Array<{ id: string }>>(
    `/rest/v1/class_teacher?select=id&class_id=eq.${classId}&teacher_id=eq.${teacherId}`,
    "GET",
    { admin: true },
  );

  if (!rows[0]?.id) {
    throw new Error(
      "Только преподаватель, назначенный в этот класс, может выполнять действие.",
    );
  }
}


export async function createClassForTeacherAdmin(input: {
  teacherId: string;
  userId: string;
  teacherFullName: string | null;
  name: string;
  methodologyId: string;
}) {
  const contextRows = await request<
    Array<{
      last_selected_school_id: string | null;
    }>
  >(
    `/rest/v1/user_preference?select=last_selected_school_id&user_id=eq.${input.userId}&limit=1`,
    "GET",
    { admin: true },
  );
  const selectedSchool = await resolveTeacherSchoolSelectionAdmin({
    userId: input.userId,
    teacherId: input.teacherId,
    teacherFullName: input.teacherFullName,
    preferredSchoolId: contextRows[0]?.last_selected_school_id ?? null,
  });
  const schoolId =
    selectedSchool.mode === "organization"
      ? selectedSchool.selectedSchoolId
      : selectedSchool.personalSchoolId;

  const name = input.name.trim();
  const methodologyId = input.methodologyId.trim();
  if (!name) {
    throw new Error("Укажите название группы.");
  }
  if (!methodologyId) {
    throw new Error("Выберите методику для группы.");
  }

  const classRows = await request<Array<{ id: string; name: string | null }>>(
    "/rest/v1/class",
    "POST",
    {
      admin: true,
      payload: {
        school_id: schoolId,
        name,
        methodology_id: methodologyId,
      },
    },
  );

  const classId = classRows[0]?.id;
  if (!classId) {
    throw new Error("Не удалось создать группу.");
  }

  try {
    await request("/rest/v1/class_teacher", "POST", {
      admin: true,
      payload: {
        class_id: classId,
        teacher_id: input.teacherId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown class_teacher insert error";
    if (!isUniqueViolationError(message)) {
      throw error;
    }
  }

  return { classId };
}

export async function createOrganizationSchoolAdmin(input: {
  userId: string;
  teacherId: string;
  teacherFullName: string | null;
  schoolName: string;
}) {
  const schoolName = input.schoolName.trim();
  if (!schoolName) {
    throw new Error("Укажите название школы.");
  }

  const baseSlug = buildTeacherSchoolSlugBase(input.teacherId, schoolName);
  let schoolId = "";
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = attempt === 0 ? `${baseSlug}-org` : `${baseSlug}-org-${attempt + 1}`;
    try {
      const rows = await request<Array<{ id: string }>>("/rest/v1/school", "POST", {
        admin: true,
        payload: {
          name: schoolName,
          slug,
          kind: "organization",
          owner_teacher_id: input.teacherId,
          teacher_limit: 5,
          plan_code: "demo",
          subscription_status: "active",
        },
      });
      schoolId = rows[0]?.id ?? "";
      break;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown school insert error";
      if (!isUniqueViolationError(message)) throw error;
    }
  }

  if (!schoolId) {
    throw new Error("Не удалось создать школу.");
  }

  await request("/rest/v1/school_teacher", "POST", {
    admin: true,
    payload: { school_id: schoolId, teacher_id: input.teacherId, role: "owner" },
  });
  await setLastSelectedSchool(input.userId, schoolId);

  return { schoolId, schoolName };
}

export async function listSchoolMembersAdmin(input: {
  schoolId: string;
}): Promise<
  Array<{
    teacherId: string;
    role: "owner" | "teacher";
    fullName: string | null;
    email: string | null;
  }>
> {
  const rows = await request<
    Array<{ teacher_id: string; role: "owner" | "teacher"; teacher: { user_id: string | null; full_name: string | null } | null }>
  >(
    `/rest/v1/school_teacher?select=teacher_id,role,teacher:teacher_id(user_id,full_name)&school_id=eq.${input.schoolId}&order=created_at.asc`,
    "GET",
    { admin: true },
  );
  const authByUser = await getAuthUsersByIdsAdmin(
    rows
      .map((row) => row.teacher?.user_id ?? "")
      .filter(Boolean),
  );
  return rows.map((row) => ({
    teacherId: row.teacher_id,
    role: row.role,
    fullName: row.teacher?.full_name?.trim() || null,
    email: row.teacher?.user_id ? authByUser[row.teacher.user_id]?.email ?? null : null,
  }));
}

export async function addTeacherToSchoolByEmailAdmin(input: {
  schoolId: string;
  ownerTeacherId: string;
  email: string;
}) {
  const schoolRows = await request<
    Array<{ id: string; kind: string | null; teacher_limit: number | null }>
  >(`/rest/v1/school?select=id,kind,teacher_limit&id=eq.${input.schoolId}&limit=1`, "GET", {
    admin: true,
  });
  const school = schoolRows[0];
  if (!school?.id || school.kind !== "organization") {
    throw new Error("Управление преподавателями доступно только для школы.");
  }

  const ownerRows = await request<Array<{ id: string }>>(
    `/rest/v1/school_teacher?select=id&school_id=eq.${input.schoolId}&teacher_id=eq.${input.ownerTeacherId}&role=eq.owner&limit=1`,
    "GET",
    { admin: true },
  );
  if (!ownerRows[0]?.id) {
    throw new Error("Только владелец школы может управлять преподавателями.");
  }

  const foundAuthUser = await findAuthUserByEmailAdmin(input.email);
  if (!foundAuthUser?.id) {
    throw new Error(
      "Преподаватель с таким email пока не зарегистрирован. Попросите его создать аккаунт, затем добавьте снова.",
    );
  }

  const ensuredTeacher = await ensureTeacherProfileForUserAdmin({
    userId: foundAuthUser.id,
    fullName: foundAuthUser.user_metadata?.full_name ?? null,
  });

  const existing = await request<Array<{ id: string }>>(
    `/rest/v1/school_teacher?select=id&school_id=eq.${input.schoolId}&teacher_id=eq.${ensuredTeacher.teacherId}&limit=1`,
    "GET",
    { admin: true },
  );
  if (existing[0]?.id) {
    return { message: "Преподаватель уже добавлен в школу." };
  }

  const memberships = await request<Array<{ teacher_id: string }>>(
    `/rest/v1/school_teacher?select=teacher_id&school_id=eq.${input.schoolId}`,
    "GET",
    { admin: true },
  );
  const limit = school.teacher_limit ?? 5;
  if (memberships.length + 1 > limit) {
    throw new Error("Лимит преподавателей в школе исчерпан.");
  }

  await request("/rest/v1/school_teacher", "POST", {
    admin: true,
    payload: {
      school_id: input.schoolId,
      teacher_id: ensuredTeacher.teacherId,
      role: "teacher",
    },
  });

  return {
    message:
      "Преподаватель добавлен в школу. Теперь школа появится у него в меню профиля.",
  };
}

export async function removeTeacherFromSchoolAdmin(input: {
  schoolId: string;
  ownerTeacherId: string;
  teacherId: string;
}) {
  const ownerRows = await request<Array<{ id: string }>>(
    `/rest/v1/school_teacher?select=id&school_id=eq.${input.schoolId}&teacher_id=eq.${input.ownerTeacherId}&role=eq.owner&limit=1`,
    "GET",
    { admin: true },
  );
  if (!ownerRows[0]?.id) {
    throw new Error("Только владелец школы может управлять преподавателями.");
  }

  if (input.ownerTeacherId === input.teacherId) {
    const ownerCount = await request<Array<{ teacher_id: string }>>(
      `/rest/v1/school_teacher?select=teacher_id&school_id=eq.${input.schoolId}&role=eq.owner`,
      "GET",
      { admin: true },
    );
    if (ownerCount.length <= 1) {
      throw new Error("Нельзя удалить последнего владельца школы.");
    }
  }

  await request(
    `/rest/v1/school_teacher?school_id=eq.${input.schoolId}&teacher_id=eq.${input.teacherId}`,
    "DELETE",
    { admin: true, allowEmpty: true },
  );
}

export async function createStudentAuthUser(input: {
  login: string;
  password: string;
  fullName?: string | null;
}) {
  const email = toStudentInternalAuthEmail(input.login);
  const payload = {
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: "student",
      login: normalizeIdentifier(input.login),
      full_name: input.fullName ?? null,
    },
  };

  const result = await request<{ id: string; email: string }>(
    "/auth/v1/admin/users",
    "POST",
    {
      payload,
      admin: true,
    },
  );

  return { userId: result.id, email: result.email };
}

export async function insertStudentRow(input: {
  userId: string;
  login: string;
  internalAuthEmail: string;
  fullName?: string | null;
  parentId?: string | null;
}) {
  const studentName = splitStudentFullName(input.fullName);
  const rows = await request<Array<{ id: string }>>(
    "/rest/v1/student",
    "POST",
    {
      admin: true,
      payload: {
        user_id: input.userId,
        login: normalizeIdentifier(input.login),
        internal_auth_email: input.internalAuthEmail,
        first_name: studentName.firstName,
        last_name: studentName.lastName,
        parent_id: input.parentId ?? null,
      },
    },
  );

  return rows[0]?.id;
}

export async function attachStudentToClassAsAdmin(input: {
  classId: string;
  studentId: string;
}) {
  const rows = await request<Array<{ class_id: string; student_id: string }>>(
    "/rest/v1/class_student",
    "POST",
    {
      admin: true,
      payload: {
        class_id: input.classId,
        student_id: input.studentId,
      },
    },
  );

  return rows[0] ?? null;
}

export async function detachStudentFromClassAsAdmin(input: {
  classId: string;
  studentId: string;
}) {
  await request(
    `/rest/v1/class_student?class_id=eq.${input.classId}&student_id=eq.${input.studentId}`,
    "DELETE",
    {
      admin: true,
      allowEmpty: true,
    },
  );
}

export async function updateStudentProfileAsAdmin(input: {
  classId: string;
  studentId: string;
  login: string;
  fullName?: string | null;
  password?: string | null;
}) {
  const membershipRows = await request<Array<{ class_id: string; student_id: string }>>(
    `/rest/v1/class_student?select=class_id,student_id&class_id=eq.${input.classId}&student_id=eq.${input.studentId}&limit=1`,
    "GET",
    { admin: true },
  );
  if (!membershipRows[0]) {
    throw new Error("Ученик не найден в этой группе.");
  }

  const studentRows = await request<
    Array<{ id: string; user_id: string | null }>
  >(
    `/rest/v1/student?select=id,user_id&id=eq.${input.studentId}&limit=1`,
    "GET",
    { admin: true },
  );

  const student = studentRows[0];
  if (!student?.id || !student.user_id) {
    throw new Error("Ученик не найден.");
  }

  const normalizedLogin = normalizeIdentifier(input.login);
  const studentName = splitStudentFullName(input.fullName ?? null);
  const nextEmail = toStudentInternalAuthEmail(normalizedLogin);

  await request(`/rest/v1/student?id=eq.${student.id}`, "PATCH", {
    admin: true,
    payload: {
      login: normalizedLogin,
      internal_auth_email: nextEmail,
      first_name: studentName.firstName,
      last_name: studentName.lastName,
    },
    allowEmpty: true,
  });

  await request(`/auth/v1/admin/users/${student.user_id}`, "PUT", {
    admin: true,
    payload: {
      email: nextEmail,
      user_metadata: {
        role: "student",
        login: normalizedLogin,
        full_name: input.fullName?.trim() || null,
      },
      ...(input.password && input.password.length >= 8
        ? { password: input.password }
        : {}),
    },
    allowEmpty: true,
  });
}

export async function updateAuthUserPasswordById(
  userId: string,
  password: string,
) {
  await request(`/auth/v1/admin/users/${userId}`, "PUT", {
    admin: true,
    payload: { password },
    allowEmpty: true,
  });
}

export async function inviteUserByEmail(input: {
  email: string;
  redirectTo: string;
}) {
  const result = await request<{ id: string; email: string }>(
    "/auth/v1/invite",
    "POST",
    {
      admin: true,
      payload: {
        email: input.email,
        data: { invited_by: "shidao-admin" },
        redirect_to: input.redirectTo,
      },
    },
  );

  return result;
}

export async function requestEmailChangeForUser(input: {
  currentEmail: string;
  currentPassword: string;
  newEmail: string;
  redirectTo: string;
}) {
  const session = await authPasswordSignIn(
    input.currentEmail,
    input.currentPassword,
  );
  if (!session?.access_token) {
    throw new Error("Не удалось подтвердить текущий пароль.");
  }

  await request("/auth/v1/user", "PUT", {
    accessToken: session.access_token,
    payload: {
      email: input.newEmail,
      email_redirect_to: input.redirectTo,
    },
    allowEmpty: true,
  });
}
