import { ImageResponse } from "next/og";

export const alt = "Shidao — имя, смысл и единый язык бренда";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#091326",
        color: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -180,
          right: -90,
          display: "flex",
          width: 600,
          height: 600,
          border: "1px solid rgba(201,255,79,.32)",
          borderRadius: "50%",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -70,
          right: 20,
          display: "flex",
          width: 380,
          height: 380,
          border: "1px solid rgba(201,180,255,.36)",
          borderRadius: "50%",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 98,
          right: 187,
          display: "flex",
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "#c9ff4f",
          boxShadow: "0 0 0 12px rgba(201,255,79,.10)",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          padding: "64px 72px 60px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          <span>Shidao</span>
          <span
            style={{
              color: "#c9ff4f",
              fontSize: 14,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Живой брендбук
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              color: "rgba(255,255,255,.46)",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Имя · смысл · единый язык
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: 900,
              marginTop: 22,
              fontSize: 70,
              fontWeight: 600,
              letterSpacing: "-0.055em",
              lineHeight: 0.96,
            }}
          >
            Shidao — имя, смысл и единый язык нашего продукта.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: "rgba(255,255,255,.5)",
            fontSize: 15,
          }}
        >
          <span
            style={{
              display: "flex",
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#c9ff4f",
            }}
          />
          Версия 1.0 · 28 июля 2026
        </div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
