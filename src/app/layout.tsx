import type { Metadata } from "next";
import { headers } from "next/headers";
import { SessionViewProvider } from "@/components/session-view-provider";
import {
  DEMO_PUBLIC_SURFACE,
  LANDING_ONLY_SURFACE,
  PUBLIC_SURFACE_HEADER,
} from "@/lib/deployment-access";
import { GUEST_SESSION_VIEW } from "@/lib/session-view";
import { readSessionViewServer } from "@/lib/server/session-view";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      "https://shidao.ru",
  ),
  title: {
    default: "Shidao — конструктор курсов и уроков",
    template: "%s | Shidao",
  },
  description:
    "Shidao — рабочее пространство преподавателя для создания курсов, уроков, материалов, Экрана ученика и домашних заданий.",
  openGraph: {
    title: "Shidao — конструктор курсов и уроков",
    description:
      "Курсы, уроки, компоненты, материалы, Экран ученика и домашние задания в одном рабочем пространстве.",
    type: "website",
    locale: "ru_RU",
    siteName: "Shidao",
  },
  twitter: {
    card: "summary",
    title: "Shidao — конструктор курсов и уроков",
    description:
      "Создание курсов, уроков, материалов и Экрана ученика в едином рабочем пространстве.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const publicSurface = requestHeaders.get(PUBLIC_SURFACE_HEADER);
  const mustUseGuestSession =
    publicSurface === "brand" ||
    publicSurface === DEMO_PUBLIC_SURFACE ||
    publicSurface === LANDING_ONLY_SURFACE;
  const initialSessionView = mustUseGuestSession
    ? GUEST_SESSION_VIEW
    : await readSessionViewServer();

  return (
    <html lang="ru">
      <body>
        <SessionViewProvider initialState={initialSessionView}>
          {children}
        </SessionViewProvider>
      </body>
    </html>
  );
}
