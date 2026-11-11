# Eclipse launch film: the soundtrack, made from scratch (no samples). A 120 BPM techy instrumental in A minor (pad, bass, arp, kick, hats)
# with sound effects placed on the film's own frames (typing, clicks, swooshes on every cut, pops when cards land, the generation shimmer,
# the relight sweep, a riser into the logo and a final hit). Reads timeline.json; writes out/score.wav and out/bed-full.m4a.
# Run: python3 score.py   (numpy only)
import json, os, subprocess, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, "timeline.json")))
SR, FPS = 44100, TL["fps"]
DUR = TL["frames"] / FPS + 0.3
N = int(DUR * SR)
S = {s["id"]: s for s in TL["scenes"]}
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)

def sec(frame): return frame / FPS
def put(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i + len(sig) <= 0: return
    a, b = max(0, i), min(N, i + len(sig)); s = sig[a - i:b - i] * gain
    L[a:b] += s * np.sqrt(0.5 * (1 - pan)); R[a:b] += s * np.sqrt(0.5 * (1 + pan))
def env(n, att=0.005, dec=0.2):
    t = np.arange(n) / SR; return np.minimum(1, t / max(att, 1e-4)) * np.exp(-t / dec)
def lowpass(x, cut):  # one pole, cut may be an array (moving filter)
    cut = np.broadcast_to(np.asarray(cut, float), x.shape); a = 1 - np.exp(-2 * np.pi * cut / SR); y = np.empty_like(x); z = 0.0
    for i in range(len(x)): z += a[i] * (x[i] - z); y[i] = z
    return y
def fft_lowpass(x, cut, slope=2.0):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (f / cut) ** (2 * slope)); return np.fft.irfft(X, len(x))
def fft_highpass(x, cut):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 - 1 / (1 + (f / cut) ** 4); return np.fft.irfft(X, len(x))
def saw(freq, n, phase=0.0):
    t = np.arange(n) / SR; return 2 * ((t * freq + phase) % 1) - 1
def midi(m): return 440 * 2 ** ((m - 69) / 12)

# ---------------- music ----------------
BPM = 120; BEAT = 60 / BPM; BAR = BEAT * 4
T0 = sec(S["images"]["start"])  # the groove drops when the first pictures land
CHORDS = [[57, 60, 64], [53, 57, 60], [52, 55, 60], [55, 59, 62]]  # Am, F, C/E, G
ROOTS = [33, 29, 36, 31]
def bar_at(t): return int(np.floor((t - T0) / BAR)) % 4
quiet = [(sec(S["one"]["start"]), sec(S["one"]["end"]))]  # breakdown under "One studio."
end_t = sec(S["end"]["start"])
def groove_on(t): return T0 <= t < end_t and not any(a <= t < b for a, b in quiet)

# pad: detuned saws, one chord per bar, from the first frame to the end; low-passed; pumped by the kick
pad = np.zeros(N); padR = np.zeros(N)
t_bar = T0 - BAR * np.ceil(T0 / BAR)
while t_bar < DUR:
    i0 = max(0, int(t_bar * SR)); i1 = min(N, int((t_bar + BAR) * SR)); n = i1 - i0
    if n > 0:
        ch = CHORDS[bar_at(t_bar + 0.01)]
        for m in ch:
            for d, side in ((-0.09, 0), (0.0, 1), (0.08, 1), (0.11, 0)):
                w = saw(midi(m) * 2 ** (d / 12), n, rng.random()) * 0.05
                (pad if side == 0 else padR)[i0:i1] += w
        fade = np.ones(n); k = min(n, int(0.02 * SR)); fade[:k] = np.linspace(0, 1, k); fade[-k:] = np.linspace(1, 0, k)
        pad[i0:i1] *= fade; padR[i0:i1] *= fade
    t_bar += BAR
pad = fft_lowpass(pad, 1400); padR = fft_lowpass(padR, 1400)

# kick, hats, bass, arp on the grid
kick_times = []
t = T0
while t < end_t:
    if groove_on(t): kick_times.append(t)
    t += BEAT
def kick():
    n = int(0.32 * SR); tt = np.arange(n) / SR; f = 45 + 95 * np.exp(-tt / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR; return np.sin(ph) * np.exp(-tt / 0.16) * 0.9 + np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt / 0.004) * 0.15
K = kick()
for t in kick_times: put(K, t, 0.9)
# sidechain pump on the pad
pump = np.ones(N)
for t in kick_times:
    i = int(t * SR); n = min(N - i, int(0.4 * SR))
    if n > 0: pump[i:i + n] = np.minimum(pump[i:i + n], 1 - 0.55 * np.exp(-np.arange(n) / SR / 0.11))
padGain = np.where(np.arange(N) / SR < T0, 0.8, 1.0)
L += pad * pump * padGain; R += padR * pump * padGain

def hat(open_=False):
    n = int((0.09 if open_ else 0.03) * SR); return fft_highpass(rng.standard_normal(n), 7000) * env(n, 0.001, 0.03 if open_ else 0.01)
t = T0
k = 0
while t < end_t:
    if groove_on(t): put(hat(k % 2 == 1), t, 0.13 if k % 2 else 0.07, pan=0.25 if k % 4 == 1 else -0.2)
    t += BEAT / 2; k += 1
# bass: 8ths on the root, first note of each beat longer
t = T0; k = 0
while t < end_t:
    if groove_on(t):
        n = int(BEAT / 2 * SR * 0.9); f = midi(ROOTS[bar_at(t + 0.01)])
        b = (saw(f, n) * 0.6 + np.sin(2 * np.pi * f * np.arange(n) / SR)) * env(n, 0.004, 0.18)
        put(lowpass(b, 600 + 900 * np.exp(-np.arange(n) / SR / 0.05)), t, 0.32)
    t += BEAT / 2; k += 1
# arp: 16ths over the chord, an octave up, ping-pong
PAT = [0, 1, 2, 1, 2, 0, 1, 2]
t = T0; k = 0
while t < end_t:
    if groove_on(t) and t >= T0 + BAR:  # the arp joins a bar after the drop
        ch = CHORDS[bar_at(t + 0.01)]; m = ch[PAT[k % 8]] + 12 + (12 if k % 16 >= 12 else 0)
        n = int(0.22 * SR); sq = np.sign(np.sin(2 * np.pi * midi(m) * np.arange(n) / SR))
        put(lowpass(sq * env(n, 0.002, 0.07), 900 + 3500 * np.exp(-np.arange(n) / SR / 0.04)), t, 0.07, pan=0.45 if k % 2 else -0.45)
    t += BEAT / 4; k += 1

# ---------------- sound effects ----------------
def click(bright=1.0):
    n = int(0.03 * SR); x = rng.standard_normal(n) * env(n, 0.0005, 0.004) * 0.6 + np.sin(2 * np.pi * 3200 * bright * np.arange(n) / SR) * env(n, 0.0005, 0.006) * 0.4
    return fft_highpass(x, 1500)
def keytap():
    n = int(0.05 * SR); x = rng.standard_normal(n) * env(n, 0.0005, 0.008)
    return fft_lowpass(fft_highpass(x, 900 + 900 * rng.random()), 6000) * 0.9 + np.sin(2 * np.pi * (180 + 60 * rng.random()) * np.arange(n) / SR) * env(n, 0.001, 0.012) * 0.25
def swoosh(length=0.45, up=True):
    n = int(length * SR); tt = np.linspace(0, 1, n); x = rng.standard_normal(n)
    cut = 300 + 6000 * (tt ** 1.5 if up else (1 - tt) ** 1.5); e = np.sin(np.pi * tt) ** 1.5
    return lowpass(x, cut) * e
def pop(f=900):
    n = int(0.12 * SR); tt = np.arange(n) / SR; ff = f * (1 + 0.6 * np.exp(-tt / 0.01))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * env(n, 0.001, 0.035)
def thump():
    n = int(0.35 * SR); tt = np.arange(n) / SR; ff = 60 + 160 * np.exp(-tt / 0.02)
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-tt / 0.12) + lowpass(rng.standard_normal(n), 2500) * env(n, 0.001, 0.03) * 0.5
def shimmer(length):
    n = int(length * SR); tt = np.linspace(0, 1, n); x = np.zeros(n)
    for m in (81, 84, 88, 93, 96): x += np.sin(2 * np.pi * midi(m) * np.arange(n) / SR + rng.random() * 6) * (0.5 + 0.5 * np.sin(2 * np.pi * (6 + rng.random() * 4) * tt * length))
    return x * np.sin(np.pi * tt) ** 2 * 0.25 + fft_highpass(rng.standard_normal(n), 6000) * tt ** 2 * np.exp(-((tt - 0.85) / 0.2) ** 2) * 0.2
def riser(length):
    n = int(length * SR); tt = np.linspace(0, 1, n); x = lowpass(rng.standard_normal(n), 200 + 9000 * tt ** 2) * tt ** 2.5
    return x + np.sin(2 * np.pi * np.cumsum(110 * 2 ** (tt * 2)) / SR) * tt ** 2 * 0.25
def boom():
    n = int(2.6 * SR); tt = np.arange(n) / SR; ff = 38 + 80 * np.exp(-tt / 0.06)
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-tt / 0.9) * 1.1 + lowpass(rng.standard_normal(n), 1800) * np.exp(-tt / 0.25) * 0.35

# typing the prompt: one tap per letter, as the film types it
P = TL["prompt"]; a0 = S["prompt"]["start"] + 12; a1 = TL["typed"]
for j in range(len(P)):
    if P[j] == " ": continue
    put(keytap(), sec(a0 + (a1 - a0) * (j + 1) / len(P)) + rng.normal(0, 0.006), 0.42, pan=rng.uniform(-0.15, 0.15))
put(click(), sec(TL["click"]), 0.9); put(pop(520), sec(TL["click"]) + 0.02, 0.35)
put(click(), sec(S["studio"]["start"] + 82), 0.9); put(pop(520), sec(S["studio"]["start"] + 82) + 0.02, 0.35)
# a swoosh on every cut (the zoom-through), not into the scenes that continue the one before
JOIN = {"images", "end"}
for s in TL["scenes"][1:]:
    if s["id"] in JOIN: continue
    put(swoosh(0.42), sec(s["start"]) - 0.3, 0.32, pan=rng.uniform(-0.3, 0.3))
# cards landing
im = S["images"]["start"]
for f in (im + 8, im + 29, im + 38): put(pop(760), sec(f + 4), 0.3)
for i in range(5): put(pop(700 + 70 * i), sec(S["shop"]["start"] + i * 3 + 4), 0.25, pan=-0.4 + 0.2 * i)
for f in range(S["hits"]["start"], S["hits"]["end"], 12): put(thump(), sec(f), 0.55)
for f in (30, 62, 92, 122): put(pop(640), sec(S["canvas"]["start"] + f + 6), 0.25)
put(pop(380), sec(S["atlas"]["start"] + 10), 0.5)  # Atlas drops in
for i in range(8): put(click(1.2), sec(S["directors"]["start"] + i * 5), 0.35, pan=rng.uniform(-0.3, 0.3))
put(shimmer(1.1), sec(S["studio"]["start"] + 94), 0.6)  # the picture being made
put(shimmer(0.9), sec(S["relight"]["start"] + 17), 0.5)  # the light sweep
put(riser(1.6), sec(S["prompt"]["end"]) - 1.6, 0.25)  # into the drop
put(riser(1.2), sec(S["canvas"]["start"]) - 1.2, 0.2)
put(riser(1.4), sec(S["end"]["start"]) - 1.4, 0.35)  # into the logo
put(boom(), sec(S["end"]["start"]), 0.9); put(K, sec(S["end"]["start"]), 1.0)

# ---------------- master ----------------
fade_t = sec(TL["frames"]) - 1.4; tt = np.arange(N) / SR; fade = np.clip((sec(TL["frames"]) - tt) / 1.4, 0, 1)
L *= fade; R *= fade
mix = np.stack([L, R], 1); ref = np.percentile(np.abs(mix), 99.7) + 1e-9  # level set by the music, the final boom is soft-clipped
mix = np.tanh(mix / ref * 0.85) * 0.92
pcm = (mix * 32767).astype(np.int16)
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
wav = os.path.join(HERE, "out", "score.wav")
with wave.open(wav, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", "256k", os.path.join(HERE, "out", "bed-full.m4a")], check=True)
print("score", round(DUR, 2), "s,", len(kick_times), "kicks")
