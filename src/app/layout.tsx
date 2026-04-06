import type { Metadata } from "next";
import { SessionViewProvider } from "@/components/session-view-provider";
import { readSessionViewServer } from "@/lib/server/session-view";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://shidao.ru",
  ),
  title: {
    default: "Shidao — платформа обучения китайскому",
    template: "%s | Shidao",
  },
  description:
    "MVP-платформа Shidao: единый контур авторизации, роли взрослого и ученика, базовая учебная инфраструктура.",
  openGraph: {
    title: "Shidao — платформа обучения китайскому",
    description:
      "Единый доступ для преподавателя, родителя и ученика с прозрачной ролевой моделью.",
    type: "website",
    locale: "ru_RU",
    siteName: "Shidao",
  },
  twitter: {
    card: "summary",
    title: "Shidao",
    description: "Платформа обучения китайскому для преподавателя, родителя и ученика.",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
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
