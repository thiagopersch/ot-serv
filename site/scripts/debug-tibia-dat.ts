/**
 * Script standalone (não faz parte do bundle da app) para validar `parseDat`/`TibiaSprReader`
 * contra um cliente Tibia 8.60 real ANTES de plugar no job de import (ver plano da feature).
 *
 * Uso: npx tsx scripts/debug-tibia-dat.ts [caminhoPastaCliente]
 * Padrão: ../cliente/data/things/860 (relativo a este arquivo).
 */
import fs from "node:fs";
import path from "node:path";

import { parseDat } from "../lib/tibia-client/dat-parser";
import { TibiaSprReader } from "../lib/tibia-client/spr-parser";
import { toObdThingData } from "../lib/tibia-client/dat-to-obd-adapter";
import { parseOtfi, DEFAULT_TIBIA_CLIENT_FORMAT } from "../lib/tibia-client/otfi-parser";
import { renderLooktypeFrames } from "../lib/obd/obd-render";

const clientDir = process.argv[2] ?? path.join(__dirname, "..", "..", "cliente", "data", "things", "860");
const datPath = path.join(clientDir, "Tibia.dat");
const sprPath = path.join(clientDir, "Tibia.spr");
const otfiPath = path.join(clientDir, "Tibia.otfi");
const outDir = path.join(__dirname, "..", "..", "tmp-debug-tibia-dat");

function main() {
  const format = fs.existsSync(otfiPath)
    ? parseOtfi(fs.readFileSync(otfiPath, "utf-8"))
    : DEFAULT_TIBIA_CLIENT_FORMAT;
  console.log("Formato detectado via .otfi (ou padrão 8.6 puro se ausente):", format);

  console.log("Lendo", datPath, "e", sprPath);
  const datBuffer = fs.readFileSync(datPath);
  const sprBuffer = fs.readFileSync(sprPath);

  console.time("parseDat");
  const dat = parseDat(datBuffer, format);
  console.timeEnd("parseDat");

  console.time("TibiaSprReader.open");
  const spr = TibiaSprReader.open(sprBuffer, format);
  console.timeEnd("TibiaSprReader.open");

  console.log({
    datSignature: dat.signature.toString(16),
    sprSignature: spr.signature.toString(16),
    signaturesMatch: dat.signature === spr.signature,
    spriteCount: spr.spriteCount,
    items: dat.items.length,
    outfits: dat.outfits.length,
    effects: dat.effects.length,
    missiles: dat.missiles.length,
    warnings: dat.warnings,
  });

  const item100 = dat.items.find((t) => t.id === 100);
  console.log(
    "item #100 groundSpeed:",
    item100?.groundSpeed,
    item100?.groundSpeed !== undefined && item100.groundSpeed >= 100 && item100.groundSpeed <= 150
      ? "(plausível)"
      : "(REVISAR TABELA DE OPCODES — fora do range 100-150 esperado para um ground tile)"
  );

  fs.mkdirSync(outDir, { recursive: true });

  function renderSample(label: string, thing: (typeof dat.items)[number] | undefined) {
    if (!thing) {
      console.log(`SKIP ${label}: thing não encontrado`);
      return;
    }
    try {
      const frames = renderLooktypeFrames(toObdThingData(thing, spr));
      const filePath = path.join(outDir, `${label}.png`);
      fs.writeFileSync(filePath, frames[0].png);
      console.log(
        `OK ${label}: id=${thing.id} category=${thing.category} ${thing.width}x${thing.height} layers=${thing.layers} frames=${thing.frames} patternX/Y/Z=${thing.patternX}/${thing.patternY}/${thing.patternZ} -> ${frames.length} frame(s) renderizado(s), amostra em ${filePath}`
      );
    } catch (error) {
      console.error(`ERRO ao renderizar ${label} (id=${thing.id}):`, error);
    }
  }

  renderSample("item-sample", dat.items.find((t) => t.width > 1 || t.height > 1) ?? dat.items[0]);
  renderSample("outfit-sample", dat.outfits[0]);
  renderSample("effect-sample", dat.effects.find((t) => t.frames > 1) ?? dat.effects[0]);
  renderSample("missile-sample", dat.missiles[0]);

  console.log("\nPNGs de amostra escritos em", outDir, "— confira visualmente antes de prosseguir.");
}

main();
