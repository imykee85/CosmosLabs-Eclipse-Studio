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
// v2: result cards (the site's own pictures and the owner's campaign pictures)
const cards = ["A:canvas/final.png", "A:canvas/fullbody.jpg", "landing/results-suit.jpg", "landing/results-fashion.jpg", "landing/results-jackets.jpg", "landing/results-earring.jpg", "landing/results-bags.jpg", "landing/results-orb.jpg", "landing/results-flowers.jpg", "landing/results-product.jpg", "landing/results-interior-design.jpg", "landing/results-entertainment.jpg", "landing/lookbook-1.jpg", "landing/lookbook-2.jpg", "dashboard/portrait-1.jpg", "dashboard/portrait-2.jpg", "dashboard/portrait-3.jpg", "dashboard/product-1.jpg", "dashboard/product-3.jpg", "dashboard/product-4.jpg", "landing/product-card-2.jpg", "dashboard/interior-2.jpg", "A:output-eye.jpg", "A:output-bird.jpg", "A:output-hands.jpg", "A:output-vitruvian.jpg", "A:hero-eclipse-seedream.png", "A:desert-astronaut-b.png"];
let c = 0; for (const o of cards) await sharp(o.startsWith("A:") ? path.join(HERE, "assets", o.slice(2)) : path.join(PUB, o)).resize(1100, 1100, { fit: "inside" }).toColorspace("srgb").jpeg({ quality: 92 }).toFile(path.join(HERE, "work", `card-${c++}.jpg`));
for (const f of ["character.jpg", "product-1.png", "product-2.jpg", "product-3.png", "product-4.jpg"]) await sharp(path.join(HERE, "assets/canvas", f)).resize(700, 700, { fit: "inside" }).jpeg({ quality: 92 }).toFile(path.join(HERE, "work", "cv-" + f.replace(/\.\w+$/, ".jpg")));
for (const n of ["hands", "vitruvian", "eye", "bird"]) await sharp(path.join(HERE, "assets", `output-${n}.jpg`)).resize(1920, 1920, { fit: "inside" }).toColorspace("srgb").jpeg({ quality: 93 }).toFile(path.join(HERE, "work", `hit-${n}.jpg`));
for (const [i, f] of ["productshot-1", "productshot-2", "productshot-3", "productshot-4", "beauty-2", "beauty-3", "beauty-4"].entries()) await sharp(path.join(PUB, "dashboard", f + ".jpg")).resize(900, 900, { fit: "inside" }).toColorspace("srgb").jpeg({ quality: 92 }).toFile(path.join(HERE, "work", `shop-${i}.jpg`)), fs.copyFileSync(path.join(HERE, "work", `shop-${i}.jpg`), path.join(HERE, "work", `card-${28 + i}.jpg`));
console.log("prepared", fs.readdirSync(path.join(HERE, "work")).length, "files");
