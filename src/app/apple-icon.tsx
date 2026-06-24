import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
          background: "#1d4ed8",
          color: "white",
          fontSize: 110,
          fontWeight: 700,
          borderRadius: 36,
        }}
      >
        t
      </div>
    ),
    size,
  );
}
