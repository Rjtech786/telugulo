import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "telugulo.in — Telugu Tech & AI News";

// Default social-share image for pages without their own featured image.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
          color: "white",
          padding: 90,
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 22,
            background: "rgba(255,255,255,0.18)",
            fontSize: 56,
            fontWeight: 800,
            marginBottom: 36,
          }}
        >
          t
        </div>
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>
          telugulo.in
        </div>
        <div style={{ fontSize: 40, opacity: 0.92, marginTop: 14 }}>
          Telugu Tech &amp; AI News
        </div>
      </div>
    ),
    size,
  );
}
