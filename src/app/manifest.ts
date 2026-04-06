import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shidao",
    short_name: "Shidao",
    description:
      "MVP-платформа обучения китайскому для преподавателя, родителя и ученика.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111111",
    lang: "ru",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
