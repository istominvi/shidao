import { ROUTES } from "@/lib/auth";
import { isRouteWithin } from "@/lib/routes";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Library, Users } from "lucide-react";

export type PrimaryNavItem = {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  isActive: (pathname: string | null) => boolean;
};

export type PrimaryNavConfig = {
  id: "marketing" | "teacher" | "parent" | "student";
  ariaLabel: string;
  items: PrimaryNavItem[];
};

export const PRIMARY_NAV_CONFIG: Record<
  PrimaryNavConfig["id"],
  PrimaryNavConfig
> = {
  marketing: {
    id: "marketing",
    ariaLabel: "Навигация по лендингу",
    items: [
      { id: "course", label: "Курс", href: "#course", isActive: () => false },
      { id: "lesson", label: "Урок", href: "#lesson", isActive: () => false },
      { id: "roles", label: "Роли", href: "#roles", isActive: () => false },
      {
        id: "workflow",
        label: "Как работает",
        href: "#workflow",
        isActive: () => false,
      },
      { id: "faq", label: "Вопросы", href: "#faq", isActive: () => false },
    ],
  },
  teacher: {
    id: "teacher",
    ariaLabel: "Основная навигация кабинета преподавателя",
    items: [
      {
        id: "schedule",
        label: "Расписание",
        href: ROUTES.schedule,
        icon: CalendarDays,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.schedule),
      },
      {
        id: "students",
        label: "Ученики",
        href: ROUTES.students,
        icon: Users,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.students),
      },
      {
        id: "courses",
        label: "Курсы",
        href: ROUTES.courses,
        icon: Library,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.courses),
      },
    ],
  },
  parent: {
    id: "parent",
    ariaLabel: "Основная навигация кабинета родителя",
    items: [
      {
        id: "courses",
        label: "Курсы",
        href: ROUTES.courses,
        icon: Library,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.courses),
      },
    ],
  },
  student: {
    id: "student",
    ariaLabel: "Основная навигация кабинета ученика",
    items: [
      {
        id: "courses",
        label: "Курсы",
        href: ROUTES.courses,
        icon: Library,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.courses),
      },
    ],
  },
};
