import { FRAME_CSP, FRAME_HTML } from "@/lib/design/motion/runtime";

export const dynamic = "force-static";

// The Motion runtime page: the same for everyone (no data in it), shown in a sandboxed frame on Design Studio. The code it runs arrives by postMessage.
export function GET() {
  return new Response(FRAME_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": FRAME_CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "public, max-age=300",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
