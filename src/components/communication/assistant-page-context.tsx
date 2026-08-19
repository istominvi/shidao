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

export type RegisteredAssistantPageContext = Pick<
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
  context: RegisteredAssistantPageContext;
};

type AssistantPageContextValue = {
  page: RegisteredAssistantPageContext;
  register: (
    pathname: string,
    context: RegisteredAssistantPageContext,
  ) => () => void;
};

const AssistantPageContext = createContext<AssistantPageContextValue | null>(
  null,
);

function defaultAssistantPageContext(
  pathname: string,
): RegisteredAssistantPageContext {
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

export function AssistantPageContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const register = useCallback(
    (nextPathname: string, context: RegisteredAssistantPageContext) => {
      const id = Symbol("assistant-page-context");
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
      : defaultAssistantPageContext(pathname);
  const value = useMemo(() => ({ page, register }), [page, register]);

  return (
    <AssistantPageContext.Provider value={value}>
      {children}
    </AssistantPageContext.Provider>
  );
}

function useAssistantPageContextValue() {
  const value = useContext(AssistantPageContext);
  if (!value) {
    throw new Error(
      "Assistant page context must be used inside AssistantPageContextProvider.",
    );
  }
  return value;
}

export function useAssistantPageContext() {
  return useAssistantPageContextValue().page;
}

export function useRegisterAssistantPageContext(
  context: RegisteredAssistantPageContext | null,
) {
  const pathname = usePathname();
  const { register } = useAssistantPageContextValue();
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
