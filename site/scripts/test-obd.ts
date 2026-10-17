import fs from "node:fs";
import { parseObd } from "../lib/obd/obd-parser";
import { renderLooktypeFrames } from "../lib/obd/obd-render";

const files = [
  "C:/Users/thiag/Projetos/Utils/sprites/item_1004_860v2-v2.obd",
  "C:/Users/thiag/Projetos/Utils/sprites/2-outfits/0-geral/0323_kratos_2135_860v2-v2.obd",
  "C:/Users/thiag/Projetos/Utils/sprites/bars-with-animation_51574_860v2-v2.obd",
  "C:/Users/thiag/Projetos/Utils/sprites/platinum coin_3035_860v2-v2.obd",
  "C:/Users/thiag/Projetos/Utils/sprites/crystal coin_3043_860v2-v2.obd",
  "C:/Users/thiag/Projetos/Utils/sprites/gold coin_3031_860v2-v2.obd",
];

async function main() {
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.log("SKIP (not found)", file);
      continue;
    }
    const buf = fs.readFileSync(file);
    const thing = await parseObd(buf);
    const rendered = renderLooktypeFrames(thing);
    console.log(
      "OK",
      file,
      thing.category,
      `frames=${thing.frames} patternX=${thing.patternX} patternY=${thing.patternY} patternZ=${thing.patternZ}`,
      "->",
      rendered.length,
      "rendered frame(s)",
      "durations=",
      rendered.map((f) => f.durationMs).join(","),
    );
  }
}
main();
