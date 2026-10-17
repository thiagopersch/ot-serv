import { asArray, bool, createXmlParser, num, str, type XmlNode } from "@/lib/xml-parse-utils";
import {
  MOVEMENT_EVENT_TYPES,
  defaultMovementValues,
  movementSchema,
  type MovementInput,
} from "@/lib/validations/admin/movement";

const parser = createXmlParser(["movevent", "vocation"]);

/** Expande a forma `"100;200"` (listas paralelas `;`-separadas, mesmo formato do `items.xml`)
 * em pares `[from, to]`. */
function parseIdRangePairs(fromRaw: string, toRaw: string): Array<{ from: number; to: number }> {
  const fromParts = fromRaw.split(";").map((part) => Number(part.trim()));
  const toParts = toRaw.split(";").map((part) => Number(part.trim()));
  const pairs: Array<{ from: number; to: number }> = [];

  for (let i = 0; i < Math.max(fromParts.length, toParts.length); i++) {
    const from = fromParts[i] ?? fromParts[0];
    const to = toParts[i] ?? toParts[0];
    if (Number.isFinite(from) && Number.isFinite(to)) pairs.push({ from, to });
  }

  return pairs;
}

function parseMoveEvent(raw: XmlNode, index: number): { movement: MovementInput | null; error: string | null } {
  const eventTypeRaw = str(raw.type);
  const eventType = MOVEMENT_EVENT_TYPES.find((value) => value.toLowerCase() === eventTypeRaw.toLowerCase());
  if (!eventType) {
    return { movement: null, error: `<movevent> #${index + 1}: type="${eventTypeRaw}" desconhecido.` };
  }

  const itemIdRaw = raw.itemid != null ? str(raw.itemid) : null;
  const fromIdRaw = raw.fromid != null ? str(raw.fromid) : null;
  const toIdRaw = raw.toid != null ? str(raw.toid) : null;
  const uniqueIdRaw = raw.uniqueid;
  const actionIdRaw = raw.actionid;

  const candidate: MovementInput = {
    ...defaultMovementValues,
    eventType,
    tileItem: bool(raw.tileitem) || str(raw.tileitem) === "1",

    selectorType: "ITEM_ID",
    itemId: null,
    itemIdRangeEnd: null,
    ranges: [],
    uniqueId: null,
    actionId: null,

    slot: str(raw.slot),
    level: num(raw.lvl ?? raw.level),
    magicLevel: num(raw.maglv ?? raw.maglevel),
    premium: bool(raw.prem ?? raw.premium) || str(raw.prem ?? raw.premium) === "1",

    actionKind: str(raw.event).toLowerCase() === "function" ? "FUNCTION" : "SCRIPT",
    actionValue: str(raw.value),

    vocations: asArray(raw.vocation).map((vocation) => ({ vocationId: num(vocation.id) })),
  };

  if (itemIdRaw != null) {
    candidate.selectorType = "ITEM_ID";
    if (itemIdRaw.includes("-")) {
      const [from, to] = itemIdRaw.split("-").map((part) => Number(part.trim()));
      candidate.itemId = Number.isFinite(from) ? from : null;
      candidate.itemIdRangeEnd = Number.isFinite(to) ? to : null;
    } else {
      candidate.itemId = num(itemIdRaw);
    }
  } else if (fromIdRaw != null && toIdRaw != null) {
    candidate.selectorType = "ITEM_RANGE";
    candidate.ranges = parseIdRangePairs(fromIdRaw, toIdRaw);
  } else if (uniqueIdRaw != null) {
    candidate.selectorType = "UNIQUE_ID";
    candidate.uniqueId = num(uniqueIdRaw);
  } else if (actionIdRaw != null) {
    candidate.selectorType = "ACTION_ID";
    candidate.actionId = num(actionIdRaw);
  } else {
    return { movement: null, error: `<movevent> #${index + 1}: nenhum seletor de item encontrado.` };
  }

  const result = movementSchema.safeParse(candidate);
  if (!result.success) {
    return { movement: null, error: `<movevent> #${index + 1}: ${result.error.issues[0]?.message ?? "dados inválidos"}.` };
  }

  return { movement: result.data, error: null };
}

export type ParseMovementsXmlResult = {
  movements: MovementInput[];
  errors: string[];
};

export function parseMovementsXml(xml: string): ParseMovementsXmlResult {
  let parsed: XmlNode;

  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch (error) {
    return { movements: [], errors: [`XML inválido: ${error instanceof Error ? error.message : String(error)}`] };
  }

  const rawMoveEvents = asArray((parsed.movements as XmlNode | undefined)?.movevent);

  if (rawMoveEvents.length === 0) {
    return { movements: [], errors: ["Nenhum <movevent> encontrado dentro de <movements>."] };
  }

  const movements: MovementInput[] = [];
  const errors: string[] = [];

  rawMoveEvents.forEach((raw, index) => {
    const { movement, error } = parseMoveEvent(raw, index);
    if (movement) movements.push(movement);
    if (error) errors.push(error);
  });

  return { movements, errors };
}
