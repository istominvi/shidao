import type { Metadata } from "next";
import { DemoExperience } from "./demo-experience";
import "./demo-v2.css";

export const metadata: Metadata = {
  title: "Shidao v2 — интерактивная продуктовая модель",
  description:
    "Кликабельный прототип второй версии Shidao: курсы, учебные профили, конструктор уроков, Экран ученика и AI-помощник.",
  openGraph: {
    title: "Shidao v2 — интерактивная продуктовая модель",
    description:
      "Цель → курс → урок → результат. Кликабельное демо новой продуктовой модели Shidao.",
    type: "website",
    locale: "ru_RU",
    images: [
      {
        url: "https://demo.shidao.ru/og-demo-v2.png",
        width: 1734,
        height: 907,
        alt: "Shidao v2 — цель, курс, урок и результат",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shidao v2 — интерактивная продуктовая модель",
    description: "Цель → курс → урок → результат.",
    images: ["https://demo.shidao.ru/og-demo-v2.png"],
  },
};

export default function DemoPage() {
  return <DemoExperience />;
}
