import { ROUTES } from "@/lib/auth";
import { isRouteWithin } from "@/lib/routes";
import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, CalendarDays, Eye, Library, Users } from "lucide-react";

export type PrimaryNavItem = {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  isActive: (pathname: string | null) => boolean;
};

export type PrimaryNavConfig = {
  id: "marketing" | "account";
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
  account: {
    id: "account",
    ariaLabel: "Основная навигация аккаунта",
    items: [
      {
        id: "courses",
        label: "Курсы",
        href: ROUTES.courses,
        icon: Library,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.courses),
      },
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
        id: "learning-profile",
        label: "Мой учебный профиль",
        href: ROUTES.learningProfile,
        icon: BookOpenCheck,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.learningProfile),
      },
      {
        id: "observing",
        label: "Наблюдение",
        href: ROUTES.observing,
        icon: Eye,
        isActive: (pathname) => isRouteWithin(pathname, ROUTES.observing),
      },
    ],
  },
};
