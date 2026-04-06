import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://shidao.ru";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/settings", "/onboarding", "/api/"],
    },
    sitemap: `${base.replace(/\/+$/, "")}/sitemap.xml`,
  };
}
