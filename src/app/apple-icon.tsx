import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const teluguFont = readFileSync(
  join(process.cwd(), "src/app/_assets/NotoSansTelugu-700.woff"),
);

// Apple touch icon — తె mark on the brand red, matching the site logo.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#d11919",
          color: "white",
          fontFamily: "Noto Telugu",
          fontSize: 96,
          fontWeight: 700,
          borderRadius: 40,
        }}
      >
        తె
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
