// Shrinks the source glTF models in /tmp/m (or the folder given) into public/shot-models: textures resized, mannequin textures dropped (the guide tints it one colour).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { textureCompress, prune, dedup, quantize } from "@gltf-transform/functions";
import sharp from "sharp";
const src = process.argv[2] || "/tmp/m", io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const [name, keepTextures] of [["Xbot", false], ["SheenChair", true], ["GlamVelvetSofa", true]]) {
  const doc = await io.read(`${src}/${name}.glb`);
  if (!keepTextures) for (const t of doc.getRoot().listTextures()) t.dispose();
  else await doc.transform(textureCompress({ encoder: sharp, targetFormat: "jpeg", resize: [512, 512], quality: 70 }));
  await doc.transform(dedup(), prune()); if (keepTextures) await doc.transform(quantize()); // quantizing breaks skinned meshes, so the mannequin is left alone
  await io.write(`public/shot-models/${name}.glb`, doc);
  console.log(name, "ok");
}
