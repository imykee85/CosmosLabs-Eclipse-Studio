// Shrinks the source pictures to working size (work/), converting to sRGB. Run once before render.
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path";
const require = createRequire("/home/user/CosmosLabs-Eclipse-Studio/package.json"); const sharp = require("sharp");
const HERE = path.dirname(new URL(import.meta.url).pathname), PUB = path.join(HERE, "../../public");
fs.mkdirSync(path.join(HERE, "work"), { recursive: true });
const big = new Set(["hero-eclipse-seedream", "finale-plate"]);
for (const f of fs.readdirSync(path.join(HERE, "assets")).filter((f) => f.endsWith(".png"))) {
  const n = f.replace(".png", ""), max = big.has(n) ? 2720 : 1600;
  await sharp(path.join(HERE, "assets", f)).resize(max, max, { fit: "inside", withoutEnlargement: true }).toColorspace("srgb").png().toFile(path.join(HERE, "work", f));
}
// Real outputs: pictures already on the Eclipse site.
const outs = ["A:output-hands.jpg", "dashboard/product-1.jpg", "A:output-vitruvian.jpg", "A:output-bird.jpg", "A:output-eye.jpg", "dashboard/interior-2.jpg", "dashboard/portrait-4.jpg", "dashboard/look-illustration-4.jpg"];
let i = 0; for (const o of outs) await sharp(o.startsWith("A:") ? path.join(HERE, "assets", o.slice(2)) : path.join(PUB, o)).resize(1920, 1920, { fit: "inside" }).toColorspace("srgb").jpeg({ quality: 93 }).toFile(path.join(HERE, "work", `out-${i++}.jpg`));
for (const f of fs.readdirSync(path.join(HERE, "captures")).filter((f) => f.endsWith("-desktop.png") && !f.includes("FAILED"))) fs.copyFileSync(path.join(HERE, "captures", f), path.join(HERE, "work", "cap-" + f.replace("-desktop", "")));
console.log("prepared", fs.readdirSync(path.join(HERE, "work")).length, "files");
