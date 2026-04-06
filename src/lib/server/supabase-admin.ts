import {
  normalizeIdentifier,
  toStudentInternalAuthEmail,
  type ProfileKind,
  ROUTES,
} from "@/lib/auth";
import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import { logger } from "@/lib/server/logger";

type Json = Record<string, unknown>;

type SupabaseUser = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string | null } | null;
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

export async function resolvePostLoginRedirect(userId: string) {
  try {
    const [parentRows, teacherRows] = await Promise.all([
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

    return parentRows[0]?.id || teacherRows[0]?.id
      ? ROUTES.dashboard
      : ROUTES.onboarding;
  } catch (error) {
    logger.error(
      "[auth-login] failed to resolve post-login route, fallback to dashboard",
      { userId, error },
    );
    return ROUTES.dashboard;
  }
}

type SessionFallback = {
  email?: string | null;
  fullName?: string | null;
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

  const resolvedFullName =
    authUser?.user_metadata?.full_name ??
    fallback?.fullName ??
    parent?.full_name ??
    teacher?.full_name ??
    formatStudentFullName({
      firstName: student?.first_name,
      lastName: student?.last_name,
      login: student?.login,
    }) ??
    null;
  const resolvedEmail = authUser?.email ?? fallback?.email ?? null;

  logger.info("[user-context] resolved context", {
    userId,
    actorKind: student ? "student" : "adult",
    hasParent: Boolean(parent),
    hasTeacher: Boolean(teacher),
    hasStudent: Boolean(student),
    usedAuthAdmin: Boolean(authUser),
    usedFallbackEmail: !authUser?.email && Boolean(fallback?.email),
    usedFallbackFullName:
      !authUser?.user_metadata?.full_name && Boolean(fallback?.fullName),
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

export async function upsertTeacherProfile(
  userId: string,
  fullName: string | null,
) {
  try {
    return await request<
      Array<{ teacher_id: string; school_id: string; class_id: string }>
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
    const schoolName = `${fullName?.trim() || "Преподаватель"} — школа`;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      try {
        const schoolRows = await request<Array<{ id: string }>>(
          "/rest/v1/school",
          "POST",
          {
            admin: true,
            payload: { name: schoolName, slug },
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

  let classId = "";
  const classRows = await request<Array<{ id: string }>>(
    `/rest/v1/class?select=id&school_id=eq.${schoolId}&order=created_at.asc&limit=1`,
    "GET",
    { admin: true },
  );
  classId = classRows[0]?.id ?? "";

  if (!classId) {
    try {
      const createdClassRows = await request<Array<{ id: string }>>(
        "/rest/v1/class",
        "POST",
        {
          admin: true,
          payload: { school_id: schoolId, name: "Основной класс" },
        },
      );
      classId = createdClassRows[0]?.id ?? "";
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown class insert error";
      if (!isUniqueViolationError(message)) {
        throw error;
      }
      const fallbackClassRows = await request<Array<{ id: string }>>(
        `/rest/v1/class?select=id&school_id=eq.${schoolId}&order=created_at.asc&limit=1`,
        "GET",
        { admin: true },
      );
      classId = fallbackClassRows[0]?.id ?? "";
    }
  }

  if (!classId) {
    throw new Error("Не удалось создать или определить class.id для teacher onboarding.");
  }

  const classTeacherRows = await request<Array<{ id: string }>>(
    `/rest/v1/class_teacher?select=id&class_id=eq.${classId}&teacher_id=eq.${teacherId}&limit=1`,
    "GET",
    { admin: true },
  );
  if (!classTeacherRows[0]?.id) {
    try {
      await request("/rest/v1/class_teacher", "POST", {
        admin: true,
        payload: {
          class_id: classId,
          teacher_id: teacherId,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown class_teacher insert error";
      if (!isUniqueViolationError(message)) {
        throw error;
      }
    }
  }

  return [{ teacher_id: teacherId, school_id: schoolId, class_id: classId }];
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

  const rows = await request<
    Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      login: string;
      class_student: Array<{
        class: {
          id: string;
          name: string;
          school: { id: string; name: string } | null;
        } | null;
      }> | null;
    }>
  >(
    `/rest/v1/student?select=id,first_name,last_name,login,class_student(class:class_id(id,name,school:school_id(id,name)))&parent_id=eq.${parentId}&order=created_at.asc`,
    "GET",
    { admin: true },
  );

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
