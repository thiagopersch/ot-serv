import { XMLParser } from "fast-xml-parser";

import { asArray, str, type XmlNode } from "@/lib/xml-parse-utils";
import {
  NPC_DEFAULT_MESSAGE_KEYS,
  type NpcDefaultMessagesInput,
  type NpcInput,
  type NpcShopItemInput,
  type NpcShopDirection,
} from "@/lib/validations/admin/npc";

/** 1 crystal coin = 10000 gold coin — mesma conversão usada em `lib/npc-xml.ts`/`buildNpcXml`. */
const GOLD_PER_CRYSTAL = 10000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ["parameter"].includes(name),
});

function a(node: XmlNode | undefined, key: string): unknown {
  return node?.[`@_${key}`];
}

function findParam(parameters: XmlNode[], key: string): string | null {
  const found = parameters.find((parameter) => a(parameter, "key") === key);
  return found ? str(a(found, "value")) : null;
}

/** Formato salvo por `buildNpcXml`: `"Nome,itemId,goldPrice;\n   Nome2,itemId2,goldPrice2"`. */
function parseShopList(value: string, direction: NpcShopDirection): NpcShopItemInput[] {
  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, itemId, goldPrice] = entry.split(",").map((part) => part.trim());
      return {
        direction,
        itemId: itemId ? Number(itemId) : null,
        name: name ?? "",
        valueCrystal: goldPrice ? Number(goldPrice) / GOLD_PER_CRYSTAL : 0,
      };
    })
    .filter((item) => item.itemId != null);
}

export type ParseNpcXmlResult = { npc: NpcInput | null; error: string | null };

/**
 * Faz o parse de um XML `<npc>` isolado (formato `data/npc/*.xml`, um único `<npc>` por
 * arquivo). `lookTypeId` (vínculo com o cadastro de looktypes) e `town`/posição não existem
 * no XML em si — o admin vincula a sprite e ajusta a posição manualmente após importar,
 * mesmo padrão usado no import de monstros (`lib/monster-xml-parser.ts`).
 */
export function parseNpcXml(xml: string): ParseNpcXmlResult {
  let parsed: XmlNode;

  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch (error) {
    return { npc: null, error: `XML inválido: ${error instanceof Error ? error.message : String(error)}` };
  }

  const raw = parsed.npc as XmlNode | undefined;
  if (!raw) {
    return { npc: null, error: "Nenhum elemento <npc> encontrado no arquivo." };
  }

  const name = str(a(raw, "name"));
  if (!name) {
    return { npc: null, error: "<npc> sem atributo name." };
  }

  const lookNode = raw.look as XmlNode | undefined;
  const lookInt = (key: string, fallback: number): number => {
    const value = Number(str(a(lookNode, key)));
    return Number.isFinite(value) ? value : fallback;
  };

  const walkintervalValue = Number(str(a(raw, "walkinterval")));
  const walkinterval = Number.isFinite(walkintervalValue) ? walkintervalValue : 2000;

  const parametersNode = raw.parameters as XmlNode | undefined;
  const parameters = asArray(parametersNode?.parameter);
  const isShop = findParam(parameters, "module_shop") === "1";
  const buyable = findParam(parameters, "shop_buyable");
  const sellable = findParam(parameters, "shop_sellable");

  const shopItems: NpcShopItemInput[] = [
    ...(buyable ? parseShopList(buyable, "buy") : []),
    ...(sellable ? parseShopList(sellable, "sell") : []),
  ];

  const defaultMessages: NpcDefaultMessagesInput = {};
  for (const entry of NPC_DEFAULT_MESSAGE_KEYS) {
    const value = findParam(parameters, entry.key);
    if (value) defaultMessages[entry.key] = value;
  }

  const npc: NpcInput = {
    name,
    lookTypeId: 0,
    type: isShop ? "shop" : "misc",
    town: "",
    posX: 0,
    posY: 0,
    posZ: 7,
    direction: 2,
    walkinterval,
    lookHead: lookInt("head", 0),
    lookBody: lookInt("body", 0),
    lookLegs: lookInt("legs", 0),
    lookFeet: lookInt("feet", 0),
    lookAddons: lookInt("addons", 3),
    shopItems,
    scriptId: null,
    categoryId: null,
    customMessages: [],
    defaultMessages,
    published: true,
  };

  return { npc, error: null };
}
