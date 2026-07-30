import type { Metadata } from "next";
import { BrandPageClient } from "./brand-page-client";
import "./brand.css";

export const metadata: Metadata = {
  title: "Брендбук — Shidao",
  description:
    "Живой брендбук Shidao: смысл названия, правила написания и единый язык бренда.",
  alternates: {
    canonical: "https://brand.shidao.ru",
  },
  openGraph: {
    title: "Shidao — имя, смысл и единый язык бренда",
    description:
      "Живой брендбук команды Shidao: название, написание и будущая система бренда.",
    url: "https://brand.shidao.ru",
    siteName: "Shidao Brand Book",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: "https://brand.shidao.ru/brand/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Shidao — имя, смысл и единый язык бренда",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shidao — имя, смысл и единый язык бренда",
    description:
      "Живой брендбук команды Shidao: название, написание и будущая система бренда.",
    images: ["https://brand.shidao.ru/brand/opengraph-image"],
  },
};

export default function BrandPage() {
  return <BrandPageClient />;
}
