import Landing from "@/components/landing/Landing";

// The phone browser's top bar takes the colour of the top of the hero picture (measured: about #3f1615 under the dark wash), so the page and the bar read as one (user 2026-10-14).
export const viewport = { themeColor: "#3f1615" };

export default function Page() {
  return <Landing />;
}
