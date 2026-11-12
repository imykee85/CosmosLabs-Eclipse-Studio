// Batch 2 of launch-film changes: new frame sequences and pictures. Run once: node prep2.mjs
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
const require = createRequire("/home/user/CosmosLabs-Eclipse-Studio/package.json"); const sharp = require("sharp");
const HERE = path.dirname(new URL(import.meta.url).pathname), U = "/root/.claude/uploads/dacc90a0-a2c0-534b-9746-6892646ab098", PUB = "/home/user/CosmosLabs-Eclipse-Studio/public", SEQ = path.join(HERE, "work/seq");
const ff = (...a) => execFileSync("ffmpeg", ["-v", "error", "-y", ...a], { stdio: "inherit" });
const clear = (name) => fs.readdirSync(SEQ).filter((f) => f.startsWith(name + "-")).forEach((f) => fs.unlinkSync(path.join(SEQ, f)));
// pictures (converted with their own colour profile to sRGB)
const lb = ["e39c397f-image.jpg", "994757c9-image.jpg", "65827f76-image.jpg", "bda0de94-image.png"], cp = ["32b9a316-image.jpg", "a2994bf1-image.jpg", "7f30f9aa-image.jpg"];
for (const [i, f] of lb.entries()) await sharp(path.join(U, f)).resize(1100, 1500, { fit: "inside" }).toColorspace("srgb").jpeg({ quality: 93 }).toFile(path.join(HERE, "work", `lb-${i}.jpg`));
for (const [i, f] of cp.entries()) await sharp(path.join(U, f)).resize(1100, 1500, { fit: "inside" }).toColorspace("srgb").jpeg({ quality: 93 }).toFile(path.join(HERE, "work", `cp-${i}.jpg`));
// the horse: the woman walking beside the white horse (homepage campaign clip), the walk before and after the hedge passes, 3 s at natural speed
clear("camp");
ff("-i", path.join(PUB, "landing/results-campaign.mp4"), "-filter_complex", "[0:v]trim=6.85:8.55,setpts=PTS-STARTPTS,fps=30[a];[0:v]trim=9.35:10.77,setpts=PTS-STARTPTS,fps=30[b];[a][b]xfade=transition=fade:duration=0.12:offset=1.58,scale=720:1280", "-frames:v", "90", "-q:v", "2", path.join(SEQ, "camp-%03d.jpg"));
// the man in the red chair (new clip): first 3 s
clear("film");
ff("-ss", "0.3", "-t", "3", "-i", path.join(U, "20f2cda2-video-output-2771C1D5-738F-413D-BE5E-7AAAA2C1B403-2.mov"), "-vf", "fps=30,scale=720:1280:flags=lanczos", "-frames:v", "90", "-q:v", "2", path.join(SEQ, "film-%03d.jpg"));
// three clips for the filmmakers scene
const fm = ["e2d1fdba-video-output-40F19688-614A-4823-8227-7F9EF8927233-1.mov", "94e09e43-video-output-40F19688-614A-4823-8227-7F9EF8927233-1.mov", "21e35736-video-output-40F19688-614A-4823-8227-7F9EF8927233-1.mov"];
for (const [i, f] of fm.entries()) { clear(`fm${i + 1}`); ff("-i", path.join(U, f), "-vf", "fps=30,scale=1100:-2:flags=lanczos", "-q:v", "2", path.join(SEQ, `fm${i + 1}-%03d.jpg`)); }
// director background: new clip, no tint, stretched very slightly to the scene's 72 frames
clear("dir");
ff("-i", path.join(U, "2a26f388-1080.mov"), "-vf", "setpts=PTS*1.08,fps=30,scale=1600:-2:flags=lanczos", "-frames:v", "72", "-q:v", "2", path.join(SEQ, "dir-%03d.jpg"));
const count = (n) => fs.readdirSync(SEQ).filter((f) => f.startsWith(n + "-")).length;
console.log(Object.fromEntries(["camp", "film", "fm1", "fm2", "fm3", "dir"].map((n) => [n, count(n)])));
