"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type {
  SystemAssistantActionResult,
  SystemAssistantPageContext,
} from "@/modules/ai/system-assistant-contracts";

export type RegisteredSystemAssistantContext = Pick<
  SystemAssistantPageContext,
  "surface" | "courseId" | "lessonId"
> & {
  view?: SystemAssistantPageContext["view"];
  label: string;
  localDate?: string;
  onActionApplied?: (
    result: SystemAssistantActionResult,
  ) => void | Promise<void>;
};

type Registration = {
  id: symbol;
  pathname: string;
  context: RegisteredSystemAssistantContext;
};

type SystemAssistantContextValue = {
  page: RegisteredSystemAssistantContext;
  register: (
    pathname: string,
    context: RegisteredSystemAssistantContext,
  ) => () => void;
};

const SystemAssistantContext =
  createContext<SystemAssistantContextValue | null>(null);

function fallbackContext(pathname: string): RegisteredSystemAssistantContext {
  if (pathname === "/schedule") {
    return {
      surface: "schedule",
      courseId: null,
      lessonId: null,
      label: "Расписание",
    };
  }
  if (pathname === "/students" || pathname === "/observing") {
    return {
      surface: "students",
      view:
        pathname === "/observing" ? "students_observing" : "students_learners",
      courseId: null,
      lessonId: null,
      label: pathname === "/observing" ? "Наблюдение" : "Ученики",
    };
  }
  if (pathname === "/courses/new") {
    return {
      surface: "course_new",
      courseId: null,
      lessonId: null,
      label: "Создание курса",
    };
  }
  if (pathname === "/courses") {
    return {
      surface: "courses",
      view: "courses_mine",
      courseId: null,
      lessonId: null,
      label: "Курсы · Мои",
    };
  }
  if (pathname === "/profile") {
    return {
      surface: "learning_profile",
      courseId: null,
      lessonId: null,
      label: "Профиль",
    };
  }
  if (pathname === "/settings/profile") {
    return {
      surface: "profile_settings",
      courseId: null,
      lessonId: null,
      label: "Настройки профиля",
    };
  }
  if (pathname === "/settings/security") {
    return {
      surface: "security_settings",
      courseId: null,
      lessonId: null,
      label: "Настройки безопасности",
    };
  }
  if (pathname === "/settings/observers") {
    return {
      surface: "observer_settings",
      courseId: null,
      lessonId: null,
      label: "Настройки наблюдателей",
    };
  }
  if (pathname === "/onboarding") {
    return {
      surface: "onboarding",
      courseId: null,
      lessonId: null,
      label: "Настройка аккаунта",
    };
  }
  return {
    surface: "other",
    courseId: null,
    lessonId: null,
    label: "Рабочее пространство ShiDao",
  };
}

export function SystemAssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const register = useCallback(
    (nextPathname: string, context: RegisteredSystemAssistantContext) => {
      const id = Symbol("system-assistant-page");
      setRegistration({ id, pathname: nextPathname, context });
      return () => {
        setRegistration((current) => (current?.id === id ? null : current));
      };
    },
    [],
  );
  const page =
    registration?.pathname === pathname
      ? registration.context
      : fallbackContext(pathname);
  const value = useMemo(() => ({ page, register }), [page, register]);

  return (
    <SystemAssistantContext.Provider value={value}>
      {children}
    </SystemAssistantContext.Provider>
  );
}

export function useSystemAssistant() {
  const value = useContext(SystemAssistantContext);
  if (!value) {
    throw new Error(
      "useSystemAssistant must be used inside SystemAssistantProvider.",
    );
  }
  return value;
}

export function useSystemAssistantPageContext(
  context: RegisteredSystemAssistantContext | null,
) {
  const pathname = usePathname();
  const { register } = useSystemAssistant();
  const surface = context?.surface;
  const courseId = context?.courseId;
  const lessonId = context?.lessonId;
  const view = context?.view;
  const label = context?.label;
  const localDate = context?.localDate;
  const onActionApplied = context?.onActionApplied;

  useEffect(() => {
    if (!surface || !label) return;
    return register(pathname, {
      surface,
      courseId: courseId ?? null,
      lessonId: lessonId ?? null,
      view: view ?? null,
      label,
      ...(localDate ? { localDate } : {}),
      ...(onActionApplied ? { onActionApplied } : {}),
    });
  }, [
    courseId,
    label,
    lessonId,
    localDate,
    onActionApplied,
    pathname,
    register,
    surface,
    view,
  ]);
}
