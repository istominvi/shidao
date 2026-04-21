import { ROUTES } from "@/lib/auth";
import { isRouteWithin } from "@/lib/routes";
import type { LucideIcon } from "lucide-react";
import { BookOpen, CalendarDays, Users } from "lucide-react";

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

export const PRIMARY_NAV_CONFIG: Record<PrimaryNavConfig["id"], PrimaryNavConfig> = {
  marketing: {
    id: "marketing",
    ariaLabel: "Навигация по лендингу",
    items: [
      { id: "roles", label: "Для кого", href: "#roles", isActive: () => false },
      { id: "why", label: "Почему Shidao", href: "#why", isActive: () => false },
      { id: "method-core", label: "Методика", href: "#method-core", isActive: () => false },
      { id: "workflow", label: "Как работает", href: "#workflow", isActive: () => false },
      { id: "faq", label: "Вопросы", href: "#faq", isActive: () => false },
    ],
  },
  teacher: {
    id: "teacher",
    ariaLabel: "Основная навигация кабинета преподавателя",
    items: [
      {
        id: "lessons",
        label: "Расписание",
        href: ROUTES.lessons,
        icon: CalendarDays,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.lessons),
      },
      {
        id: "groups",
        label: "Группы",
        href: ROUTES.groups,
        icon: Users,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.groups),
      },
      {
        id: "methodologies",
        label: "Методики",
        href: ROUTES.methodologies,
        icon: BookOpen,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.methodologies),
      },
    ],
  },
  parent: {
    id: "parent",
    ariaLabel: "Основная навигация кабинета родителя",
    items: [
      {
        id: "overview",
        label: "Обзор",
        href: ROUTES.dashboard,
        icon: Users,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.dashboard),
      },
    ],
  },
  student: {
    id: "student",
    ariaLabel: "Основная навигация кабинета ученика",
    items: [
      {
        id: "schedule",
        label: "Расписание",
        href: ROUTES.lessons,
        icon: CalendarDays,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.lessons),
      },
    ],
  },
};
