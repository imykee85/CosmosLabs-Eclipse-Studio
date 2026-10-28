"use client";

// Plays a silent, looping MP4 by decoding it ourselves (WebCodecs) and painting each frame on a canvas. The normal <video> is
// refused by iPhone Low Power Mode, but the decoder is a different part of the browser, so this can run when the video cannot.
// Only ClipCard calls it, and only after the browser has refused to autoplay the video. Returns a stop function, or null when
// this browser cannot decode the clip (then the poster and play button stay).

type Chunk = { data: Uint8Array; key: boolean; ts: number; dur: number };

// `MP4Box` is the mp4box library, loaded only when a clip needs it.
export function decodeLoop(MP4Box: any, url: string, canvas: HTMLCanvasElement, onFail: () => void): (() => void) | null {
  if (typeof VideoDecoder === "undefined" || typeof EncodedVideoChunk === "undefined") return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let stopped = false;
  let decoder: VideoDecoder | null = null;
  let config: VideoDecoderConfig | null = null;
  let duration = 0; // seconds, one pass through the clip
  const chunks: Chunk[] = [];
  const frames: VideoFrame[] = [];
  let idx = 0;
  let clockStart = 0;
  let raf = 0;
  let shown: VideoFrame | null = null;

  const fail = () => { if (!stopped) { stop(); onFail(); } };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    frames.splice(0).forEach((f) => f.close());
    shown?.close();
    try { decoder?.close(); } catch { /* already closed */ }
  };

  const file = MP4Box.createFile();
  file.onError = fail;
  file.onReady = (info: any) => {
    const track = info.videoTracks[0];
    if (!track) return fail();
    const entry: any = file.getTrackById(track.id).mdia.minf.stbl.stsd.entries[0];
    const box = entry.avcC ?? entry.hvcC ?? entry.vpcC ?? entry.av1C;
    let description: Uint8Array | undefined;
    if (box) {
      const s = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
      box.write(s);
      description = new Uint8Array(s.buffer, 8); // skip the box header
    }
    config = { codec: track.codec, codedWidth: track.video.width, codedHeight: track.video.height, description };
    duration = track.duration / track.timescale;
    canvas.width = track.video.width;
    canvas.height = track.video.height;
    file.setExtractionOptions(track.id, null, { nbSamples: Infinity });
    file.start();
  };
  file.onSamples = (_id: number, _user: unknown, samples: any[]) => {
    for (const s of samples) chunks.push({ data: new Uint8Array(s.data), key: !!s.is_sync, ts: s.cts / s.timescale, dur: s.duration / s.timescale });
  };

  fetch(url)
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
    .then((buf) => {
      if (stopped) return;
      const ab: any = buf;
      ab.fileStart = 0;
      file.appendBuffer(ab);
      file.flush();
      if (!config || !chunks.length || !duration) return fail();
      return VideoDecoder.isConfigSupported(config).then((res) => {
        if (stopped) return;
        if (!res.supported) return fail();
        decoder = new VideoDecoder({
          output: (f) => { if (stopped) f.close(); else frames.push(f); },
          error: fail,
        });
        decoder.configure(config!);
        clockStart = performance.now();
        feed();
        raf = requestAnimationFrame(tick);
      });
    })
    .catch(fail);

  function feed() {
    if (!decoder || stopped) return;
    while (idx < chunks.length && decoder.decodeQueueSize < 6) {
      const c = chunks[idx++];
      decoder.decode(new EncodedVideoChunk({ type: c.key ? "key" : "delta", timestamp: Math.round(c.ts * 1e6), duration: Math.round(c.dur * 1e6), data: c.data }));
    }
  }

  // Starts the clip again from the top once it has played through and every chunk is in the decoder.
  function restart() {
    if (!decoder) return;
    idx = 0;
    frames.splice(0).forEach((f) => f.close());
    clockStart = performance.now();
    decoder.flush().then(() => feed()).catch(fail);
  }

  function tick() {
    if (stopped) return;
    const now = performance.now();
    if (idx >= chunks.length && now - clockStart >= duration * 1000) restart();
    feed();
    const t = ((now - clockStart) / 1000) % duration;
    // Keep the newest frame that is due; older ones are no longer needed.
    while (frames.length > 1 && frames[1].timestamp <= t * 1e6) frames.shift()!.close();
    if (frames.length && frames[0].timestamp <= t * 1e6) {
      ctx!.drawImage(frames[0], 0, 0, canvas.width, canvas.height);
      shown?.close();
      shown = frames.shift()!;
    }
    raf = requestAnimationFrame(tick);
  }

  return stop;
}
