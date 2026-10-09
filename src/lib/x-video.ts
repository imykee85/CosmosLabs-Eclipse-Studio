// Finds the playable video of a public post on X from the same public data X's own embed uses (the syndication endpoint).
// It is undocumented and can change or block us at any time, so every caller must cope with `null`. The video files stay on
// X's servers and are played from there; we store nothing. Only the post id is sent; ids must be digits.
export type XVideo = { poster?: string; preview?: string; video?: string; ratio?: "16 / 9" | "9 / 16" | "1 / 1" | "4 / 5" };

// The endpoint wants a token derived from the id (the same formula X's embed script uses).
export const syndicationToken = (id: string) => ((Number(id) / 1e15) * Math.PI).toString(6 ** 2).replace(/(0+|\.)/g, "");

type Variant = { content_type?: string; bitrate?: number; url?: string };
type Syndication = {
  video?: { poster?: string; variants?: Variant[] };
  mediaDetails?: { type?: string; media_url_https?: string; video_info?: { aspect_ratio?: number[]; variants?: Variant[] } }[];
};

const snapRatio = (w: number, h: number): XVideo["ratio"] => {
  const r = w / h;
  return r > 1.3 ? "16 / 9" : r < 0.6 ? "9 / 16" : r < 0.9 ? "4 / 5" : "1 / 1";
};

// Picks a light mp4 for the feed (about 800 kbps or less, else the smallest) and the best one for the detail page.
export function pickVideo(data: Syndication): XVideo | null {
  const media = data.mediaDetails?.find((m) => m.video_info?.variants?.length) ?? null;
  const variants = (media?.video_info?.variants ?? data.video?.variants ?? []).filter((v) => v.content_type === "video/mp4" && v.url?.startsWith("https://"));
  if (variants.length === 0) return null;
  const sorted = [...variants].sort((a, b) => (a.bitrate ?? 0) - (b.bitrate ?? 0));
  const light = sorted.filter((v) => (v.bitrate ?? 0) <= 900_000).pop() ?? sorted[0];
  const best = sorted[sorted.length - 1];
  const ar = media?.video_info?.aspect_ratio;
  return {
    poster: media?.media_url_https ?? data.video?.poster,
    preview: light.url,
    video: best.url,
    ratio: ar && ar.length >= 2 ? snapRatio(ar[0], ar[1]) : undefined,
  };
}

const cache = new Map<string, { at: number; value: XVideo | null }>();
const TTL = 60 * 60 * 1000;

export async function fetchXVideo(id: string): Promise<XVideo | null> {
  if (!/^\d{5,25}$/.test(id)) return null;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  let value: XVideo | null = null;
  try {
    const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${syndicationToken(id)}`, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; EclipseStudio/1.0)", accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) value = pickVideo((await res.json()) as Syndication);
  } catch { value = null; }
  if (cache.size > 800) cache.clear();
  cache.set(id, { at: Date.now(), value });
  return value;
}
