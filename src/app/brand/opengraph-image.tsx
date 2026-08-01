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
        background: "#faf4ea",
        color: "#302c36",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          backgroundImage:
            "linear-gradient(rgba(126,96,157,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(126,96,157,.055) 1px, transparent 1px)",
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
          border: "1px solid rgba(173,130,237,.42)",
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
          border: "1px solid rgba(216,239,88,.72)",
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
          background: "#ff816b",
          boxShadow: "0 0 0 12px rgba(255,129,107,.12)",
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
              color: "#7d5bc2",
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
              color: "#8a7e80",
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
            color: "#81777a",
            fontSize: 15,
          }}
        >
          <span
            style={{
              display: "flex",
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#d8ef58",
              boxShadow: "0 0 0 7px rgba(216,239,88,.18)",
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
