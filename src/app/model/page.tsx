import type { Metadata } from "next";
import { ModelPageClient } from "./model-page-client";
import "./model.css";

export const metadata: Metadata = {
  title: "Продуктовая модель — Shidao™",
  description:
    "Как Shidao™ превращает AI-объяснение в управляемый образовательный путь: продуктовая модель, сценарии, интерфейсы и стратегия развития.",
  alternates: {
    canonical: "https://model.shidao.ru",
  },
  openGraph: {
    title: "Shidao™ — персональная образовательная система",
    description: "Продуктовая модель, сценарии, интерфейсы и стратегия Shidao™.",
    url: "https://model.shidao.ru",
    siteName: "Shidao™ Product Model",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: "https://model.shidao.ru/model/shidao-model-hero.png",
        width: 1672,
        height: 941,
        alt: "Shidao™ — персональная образовательная система",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shidao™ — персональная образовательная система",
    description:
      "Shidao™ — образование будущего, где ИИ — ассистент, аналитик и автор контента",
    images: ["https://model.shidao.ru/model/shidao-model-hero.png"],
  },
};

export default function ModelPage() {
  return <ModelPageClient />;
}
