/** Geração da action Lua que libera uma outfit ao usar um item (mesmo estilo de
 * `server/data/actions/scripts/wing_unlock.lua`). */

export const OUTFIT_UNLOCK_SCRIPT_NAME = "outfit_item_unlock.lua";

export type OutfitUnlockData = {
  id: number;
  name: string;
  storageId: string | null;
  storageValue: string | null;
  unlockItemId: number | null;
};

function luaString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ")}"`;
}

function luaNumberOrNil(value: string | null): string {
  if (!value) return "nil";
  const parsed = Number(value);
  return Number.isInteger(parsed) ? String(parsed) : "nil";
}

/** Só as outfits com item configurado, uma entrada por item (se dois registros usarem o mesmo
 * item, vale o de menor id). */
export function outfitsWithUnlockItem<T extends OutfitUnlockData>(outfits: T[]): T[] {
  const byItem = new Map<number, T>();
  for (const outfit of [...outfits].sort((a, b) => a.id - b.id)) {
    if (!outfit.unlockItemId || outfit.unlockItemId <= 0) continue;
    if (!byItem.has(outfit.unlockItemId)) byItem.set(outfit.unlockItemId, outfit);
  }
  return [...byItem.values()].sort((a, b) => (a.unlockItemId ?? 0) - (b.unlockItemId ?? 0));
}

export function outfitUnlockLua(outfits: OutfitUnlockData[]): string {
  const entries = outfitsWithUnlockItem(outfits).map((outfit) => {
    const fields = [
      `outfitId = ${outfit.id}`,
      `name = ${luaString(outfit.name)}`,
      `storageId = ${luaNumberOrNil(outfit.storageId)}`,
      `storageValue = ${luaNumberOrNil(outfit.storageValue)}`,
    ];
    return `  [${outfit.unlockItemId}] = { ${fields.join(", ")} },`;
  });

  return [
    "-- Gerado pelo portal (/admin/outfits). Item -> outfit do outfits.xml.",
    "local outfitItems = {",
    ...entries,
    "}",
    "",
    "function onUse(cid, item, fromPosition, itemEx, toPosition)",
    "  local config = outfitItems[item.itemid]",
    "  if not config then",
    "    return false",
    "  end",
    "",
    "  if canPlayerWearOutfitId(cid, config.outfitId, 0) then",
    '    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "You already have this outfit.")',
    "    return true",
    "  end",
    "",
    "  doPlayerAddOutfitId(cid, config.outfitId, 0)",
    "  if config.storageId and config.storageValue and getPlayerStorageValue(cid, config.storageId) < config.storageValue then",
    "    setPlayerStorageValue(cid, config.storageId, config.storageValue)",
    "  end",
    "",
    "  doPlayerSave(cid)",
    "  doRemoveItem(item.uid, 1)",
    '  doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, config.name .. " outfit unlocked! Open the outfit window to wear it.")',
    "  doPlayerSendOutfitWindow(cid)",
    "  return true",
    "end",
    "",
  ].join("\n");
}

/** Linhas para registrar o script em `server/data/actions/actions.xml`. */
export function outfitUnlockActionsXml(outfits: OutfitUnlockData[]): string {
  return outfitsWithUnlockItem(outfits)
    .map(
      (outfit) =>
        `\t<action itemid="${outfit.unlockItemId}" event="script" value="${OUTFIT_UNLOCK_SCRIPT_NAME}" /> <!-- ${outfit.name.replace(/--/g, "-")} -->`,
    )
    .join("\n");
}
