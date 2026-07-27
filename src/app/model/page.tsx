import type { Metadata } from "next";
import { ModelPageClient } from "./model-page-client";
import "./model.css";

export const metadata: Metadata = {
  title: "Продуктовая модель — ShiDao",
  description:
    "Как ShiDao превращает AI-объяснение в управляемый образовательный путь: продуктовая модель, сценарии, интерфейсы и стратегия развития.",
  alternates: {
    canonical: "https://model.shidao.ru",
  },
  openGraph: {
    title: "ShiDao — персональная образовательная система",
    description: "Продуктовая модель, сценарии, интерфейсы и стратегия ShiDao.",
    url: "https://model.shidao.ru",
    siteName: "ShiDao Product Model",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: "https://model.shidao.ru/model/shidao-model-hero.png",
        width: 1672,
        height: 941,
        alt: "ShiDao — персональная образовательная система",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ShiDao — персональная образовательная система",
    description:
      "ShiDao — образование будущего, где ИИ — ассистент, аналитик и автор контента",
    images: ["https://model.shidao.ru/model/shidao-model-hero.png"],
  },
};

export default function ModelPage() {
  return <ModelPageClient />;
}
