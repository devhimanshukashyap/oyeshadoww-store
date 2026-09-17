import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// A simple generated placeholder icon (brand-accent circle with an initial)
// so the app ships with a working favicon out of the box. Replace this
// with a real logo by adding your own favicon.ico to /public and deleting
// this file — see README.md "Where do I change things?".
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7C5CFF",
          borderRadius: 8,
          color: "white",
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        o
      </div>
    ),
    { ...size }
  );
}
