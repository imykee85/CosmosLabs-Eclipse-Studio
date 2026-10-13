import { ImageResponse } from "next/og";

// The picture shown when the site is shared (link previews): black, the red accent, the name. Drawn here so there is no file to keep in step.
export const runtime = "edge";
export const alt = "Eclipse Studio: your AI creative suite";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 90px", background: "#000", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: "#c00707" }} />
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1, color: "#d4d4d4" }}>Cosmos Labs AI</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 108, fontWeight: 700, letterSpacing: -4 }}>Eclipse Studio</div>
        <div style={{ marginTop: 16, fontSize: 44, color: "#a3a3a3" }}>Your AI creative suite</div>
      </div>
    ),
    size,
  );
}
