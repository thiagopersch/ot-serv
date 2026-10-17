import type { MovementInput } from "@/lib/validations/admin/movement";
import { escapeXml, indent } from "@/lib/xml-utils";

export function movementToXml(movement: MovementInput): string {
  const attrs = [`type="${escapeXml(movement.eventType)}"`];

  if (movement.selectorType === "ITEM_ID" && movement.itemId != null) {
    const value =
      movement.itemIdRangeEnd != null && movement.itemIdRangeEnd !== movement.itemId
        ? `${movement.itemId}-${movement.itemIdRangeEnd}`
        : `${movement.itemId}`;
    attrs.push(`itemid="${value}"`);
  } else if (movement.selectorType === "ITEM_RANGE" && movement.ranges.length > 0) {
    attrs.push(`fromid="${movement.ranges.map((r) => r.from).join(";")}"`);
    attrs.push(`toid="${movement.ranges.map((r) => r.to).join(";")}"`);
  } else if (movement.selectorType === "UNIQUE_ID" && movement.uniqueId != null) {
    attrs.push(`uniqueid="${movement.uniqueId}"`);
  } else if (movement.selectorType === "ACTION_ID" && movement.actionId != null) {
    attrs.push(`actionid="${movement.actionId}"`);
  }

  if (movement.tileItem) attrs.push(`tileitem="1"`);
  if (movement.slot) attrs.push(`slot="${escapeXml(movement.slot)}"`);
  if (movement.level) attrs.push(`lvl="${movement.level}"`);
  if (movement.magicLevel) attrs.push(`maglv="${movement.magicLevel}"`);
  if (movement.premium) attrs.push(`prem="1"`);

  attrs.push(`event="${movement.actionKind === "SCRIPT" ? "script" : "function"}"`);
  attrs.push(`value="${escapeXml(movement.actionValue)}"`);

  if (movement.vocations.length === 0) {
    return `<movevent ${attrs.join(" ")} />`;
  }

  const lines = [
    `<movevent ${attrs.join(" ")}>`,
    ...indent(
      movement.vocations.map((vocation) => `<vocation id="${vocation.vocationId}" />`),
      1
    ),
    `</movevent>`,
  ];
  return lines.join("\n");
}

export function movementsToXmlDocument(movements: MovementInput[]): string {
  const lines = [`<?xml version="1.0" encoding="UTF-8"?>`, `<movements>`];
  for (const movement of movements) {
    lines.push(...indent(movementToXml(movement).split("\n"), 1));
  }
  lines.push(`</movements>`);
  return lines.join("\n") + "\n";
}
