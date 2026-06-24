import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon — "t" mark on the brand blue.
export default function Icon() {
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
          fontSize: 22,
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        t
      </div>
    ),
    size,
  );
}
