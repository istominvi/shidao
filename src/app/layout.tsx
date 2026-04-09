import type { Metadata } from "next";
import { SessionViewProvider } from "@/components/session-view-provider";
import { readSessionViewServer } from "@/lib/server/session-view";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://shidao.ru",
  ),
  title: {
    default: "Shidao — платформа обучения китайскому по готовым методикам",
    template: "%s | Shidao",
  },
  description:
    "Shidao — методико-ориентированная платформа преподавания китайского языка. Группы, уроки, домашние задания и коммуникация по занятию — в единой среде для преподавателя, родителя и ученика.",
  openGraph: {
    title: "Shidao — обучение китайскому по готовым методикам",
    description:
      "Методика, группы, уроки, задания и учебная коммуникация в одной платформе.",
    type: "website",
    locale: "ru_RU",
    siteName: "Shidao",
  },
  twitter: {
    card: "summary",
    title: "Shidao — обучение китайскому по готовым методикам",
    description: "Платформа преподавания китайского языка, где методика становится основой рабочего процесса.",
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
  const initialSessionView = await readSessionViewServer();

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
