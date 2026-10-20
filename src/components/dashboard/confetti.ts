// A burst of confetti that falls over the whole screen, and a few pops to go with it. Plain canvas and Web Audio, no files, no libraries.
// Browsers keep a page silent until the person has touched it, so when the sound is still blocked the pops play on the first tap or key press.
const COLORS = ["#c00707", "#ff4d4d", "#ffffff", "#ffd166", "#ff8fab", "#f4f1ed"];

export function launchConfetti(durationMs = 4200): () => void {
  if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10000";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return () => {}; }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  const size = () => { w = window.innerWidth; h = window.innerHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size();
  window.addEventListener("resize", size);

  type Piece = { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; c: string; round: boolean; sway: number; phase: number; born: number };
  const pieces: Piece[] = [];
  const total = Math.round(Math.min(260, Math.max(130, w / 5)));
  const start = performance.now();
  // Pieces are released from above the screen over the first 1.1 s, so it rains rather than appears.
  for (let i = 0; i < total; i++) {
    pieces.push({ x: Math.random() * w, y: -20 - Math.random() * h * 0.4, vx: (Math.random() - 0.5) * 2.2, vy: 1.8 + Math.random() * 2.6, r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.25, s: 6 + Math.random() * 7, c: COLORS[Math.floor(Math.random() * COLORS.length)], round: Math.random() < 0.25, sway: 0.6 + Math.random() * 1.4, phase: Math.random() * 6.28, born: Math.random() * 1100 });
  }

  let raf = 0, stopped = false;
  function frame(now: number) {
    if (stopped) return;
    const t = now - start;
    ctx!.clearRect(0, 0, w, h);
    let alive = 0;
    for (const p of pieces) {
      if (t < p.born) { alive++; continue; }
      p.vy = Math.min(p.vy + 0.025, 6.5);
      p.x += p.vx + Math.sin(t / 380 * p.sway + p.phase) * 0.9;
      p.y += p.vy;
      p.r += p.vr;
      if (p.y > h + 24) continue;
      alive++;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.r);
      ctx!.globalAlpha = Math.max(0, Math.min(1, (h + 24 - p.y) / 120 + 0.2));
      ctx!.fillStyle = p.c;
      if (p.round) { ctx!.beginPath(); ctx!.arc(0, 0, p.s / 2.4, 0, Math.PI * 2); ctx!.fill(); }
      else ctx!.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * (0.6 + 0.4 * Math.abs(Math.cos(p.r * 2))));
      ctx!.restore();
    }
    if (alive === 0 || t > durationMs + 3000) return stop();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", size);
    canvas.remove();
  }
  raf = requestAnimationFrame(frame);
  return stop;
}

let audio: AudioContext | null = null;

// Short "pop" sounds: a burst of filtered noise with a quick drop in pitch, a handful of them spread over about two seconds.
function schedulePops(ac: AudioContext) {
  const rate = ac.sampleRate;
  const len = Math.floor(rate * 0.12);
  const noise = ac.createBuffer(1, len, rate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const times = [0, 0.04, 0.22, 0.4, 0.58, 0.85, 1.1, 1.45, 1.9];
  for (const delay of times) {
    const at = ac.currentTime + delay + Math.random() * 0.05;
    const src = ac.createBufferSource();
    src.buffer = noise;
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(1800 + Math.random() * 1800, at);
    band.frequency.exponentialRampToValueAtTime(500, at + 0.1);
    band.Q.value = 0.9;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.5, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    src.connect(band).connect(gain).connect(ac.destination);
    src.start(at);
  }
}

export function playPops(): () => void {
  if (typeof window === "undefined") return () => {};
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return () => {};
  let off = () => {};
  try {
    audio = audio ?? new Ctor();
    const ac = audio;
    const go = () => { off(); schedulePops(ac); };
    if (ac.state === "running") { schedulePops(ac); return () => {}; }
    // Still locked: try to wake it, and if the browser says no, play on the first touch, click or key.
    ac.resume().then(() => { if (ac.state === "running") schedulePops(ac); else arm(); }).catch(arm);
    function arm() {
      const once = () => { ac.resume().then(go).catch(() => {}); };
      for (const ev of ["pointerdown", "keydown"] as const) window.addEventListener(ev, once, { once: true });
      off = () => { for (const ev of ["pointerdown", "keydown"] as const) window.removeEventListener(ev, once); };
    }
  } catch { /* no sound is better than an error */ }
  return () => off();
}
