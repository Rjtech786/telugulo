import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "telugulo.in — Telugu Tech & AI News";

const teluguFont = readFileSync(
  join(process.cwd(), "src/app/_assets/NotoSansTelugu-700.woff"),
);

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
          background: "linear-gradient(135deg, #d11919, #ef3a3a)",
          color: "white",
          padding: 90,
          justifyContent: "center",
          fontFamily: "Noto Telugu, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 110,
            height: 110,
            borderRadius: 26,
            background: "rgba(255,255,255,0.18)",
            fontSize: 64,
            fontWeight: 800,
            marginBottom: 36,
          }}
        >
          తె
        </div>
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>
          telugulo.in
        </div>
        <div style={{ fontSize: 40, opacity: 0.92, marginTop: 14 }}>
          Telugu Tech &amp; AI News
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Noto Telugu", data: teluguFont, weight: 700, style: "normal" },
      ],
    },
  );
}
