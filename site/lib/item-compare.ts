import {
  ITEM_ABSORB_KEYS,
  ITEM_ELEMENT_KEYS,
  ITEM_FIELD_ABSORB_KEYS,
  ITEM_SKILL_KEYS,
  ITEM_SUPPRESS_KEYS,
  defaultItemField,
  defaultItemFlags,
  type ItemInput,
} from "@/lib/validations/admin/item";
import {
  ELEMENT_LABELS,
  FLAG_LABELS,
  ITEM_FIELD_LABELS,
  SKILL_LABELS,
  SUPPRESS_LABELS,
} from "@/lib/item-field-help";
import { formatOz } from "@/lib/item-display";

/** Comparação de configuração entre um item já cadastrado e um item sendo criado com o mesmo id
 * — usada pela API (pular ids idênticos na criação single/range) e pelo dialog de conflito
 * (destacar as colunas divergentes). Isomórfico: sem Prisma, roda no server e no client. */

/** Espelha o round-trip do banco (`itemFormToRow` → `itemRowToFormInput`), que perde dados em
 * alguns campos — sem isso, um item recém-lido do banco nunca bateria com o mesmo payload do form
 * (ex.: `field` desabilitado vira `JsonNull` e volta como `defaultItemField`). */
export function normalizeItemForCompare(input: ItemInput): ItemInput {
  return {
    ...input,
    flags: { ...defaultItemFlags, ...input.flags },
    field: input.field?.enabled ? input.field : defaultItemField,
    extraAttributes: input.extraAttributes ?? [],
  };
}

/** `JSON.stringify` com chaves ordenadas recursivamente — o MySQL reordena as chaves das colunas
 * JSON (`flags`, `skills`...), então a ordem original não é confiável pra comparar. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function isSameItemConfig(a: ItemInput, b: ItemInput): boolean {
  return stableStringify(normalizeItemForCompare(a)) === stableStringify(normalizeItemForCompare(b));
}

export type ItemCompareColumn = { path: string; label: string; group: string };

function topLevel(group: string, keys: (keyof ItemInput | `field.${string}`)[]): ItemCompareColumn[] {
  return keys.map((key) => ({ path: key, label: ITEM_FIELD_LABELS[key] ?? key, group }));
}

function nested(
  group: string,
  prefix: keyof ItemInput,
  keys: readonly string[],
  labels: Record<string, string>,
): ItemCompareColumn[] {
  return keys.map((key) => ({ path: `${prefix}.${key}`, label: labels[key] ?? key, group }));
}

/** Todas as colunas da tabela de comparação, na ordem de exibição: identificação primeiro (id,
 * client id, nome, sprite), depois o resto na ordem das abas do formulário. Grupos aninhados
 * (flags, skills, elementos...) viram uma coluna por chave; `lookTypeId` é renderizado como a
 * sprite pelo dialog. */
export const ITEM_COMPARE_COLUMNS: ItemCompareColumn[] = [
  ...topLevel("Identificação", [
    "id",
    "clientId",
    "name",
    "lookTypeId",
    "article",
    "plural",
    "editorSuffix",
    "description",
    "published",
  ]),
  ...topLevel("Tipo", [
    "type",
    "weaponType",
    "slotType",
    "ammoType",
    "ammoAction",
    "shootType",
    "effect",
    "corpseType",
    "fluidSource",
  ]),
  ...topLevel("Peso e valor", ["weight", "worth"]),
  ...topLevel("Combate", [
    "attack",
    "extraAttack",
    "attackSpeed",
    "defense",
    "extraDefense",
    "armor",
    "range",
    "hitChance",
    "maxHitChance",
    "breakChance",
  ]),
  ...topLevel("Runa", ["runeSpellName"]),
  ...topLevel("Duração e transformação", [
    "decayTo",
    "duration",
    "stopDuration",
    "showDuration",
    "transformTo",
    "transformEquipTo",
    "transformDeEquipTo",
    "rotateTo",
    "maleTransformTo",
    "femaleTransformTo",
    "floorChange",
  ]),
  ...topLevel("Cargas", ["charges", "showCharges", "showAttributes"]),
  ...topLevel("Container e texto", [
    "containerSize",
    "readable",
    "writeable",
    "maxTextLen",
    "writeOnceItemId",
  ]),
  ...topLevel("Luz", ["lightLevel", "lightColor"]),
  ...topLevel("Regeneração e bônus", [
    "speed",
    "healthGain",
    "healthTicks",
    "manaGain",
    "manaTicks",
    "manaShield",
    "maxHitPoints",
    "maxHitPointsPercent",
    "maxManaPoints",
    "maxManaPointsPercent",
    "magicLevelPoints",
    "magicLevelPointsPercent",
    "soulPoints",
    "soulPointsPercent",
    "increaseMagicValue",
    "increaseMagicPercent",
    "increaseHealingValue",
    "increaseHealingPercent",
  ]),
  ...nested("Comportamento", "flags", Object.keys(defaultItemFlags), FLAG_LABELS),
  ...nested("Skills", "skills", ITEM_SKILL_KEYS, SKILL_LABELS),
  ...nested("Dano elemental", "elements", ITEM_ELEMENT_KEYS, ELEMENT_LABELS),
  ...nested("Absorção %", "absorbPercent", ITEM_ABSORB_KEYS, ELEMENT_LABELS),
  ...nested("Absorção de campo %", "fieldAbsorbPercent", ITEM_FIELD_ABSORB_KEYS, ELEMENT_LABELS),
  ...nested("Reflexão %", "reflectPercent", ITEM_ABSORB_KEYS, ELEMENT_LABELS),
  ...nested("Chance de reflexão %", "reflectChance", ITEM_ABSORB_KEYS, ELEMENT_LABELS),
  ...nested("Supressão de condições", "suppress", ITEM_SUPPRESS_KEYS, SUPPRESS_LABELS),
  ...topLevel("Campo (field)", [
    "field.enabled",
    "field.value",
    "field.ticks",
    "field.count",
    "field.start",
    "field.damages",
  ]),
  ...topLevel("Atributos extras", ["extraAttributes"]),
];

export function getValueAtPath(item: ItemInput, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined,
      item,
    );
}

/** Paths (de `ITEM_COMPARE_COLUMNS`) cujo valor difere entre as duas versões normalizadas. */
export function getItemDiffPaths(existing: ItemInput, incoming: ItemInput): Set<string> {
  const a = normalizeItemForCompare(existing);
  const b = normalizeItemForCompare(incoming);
  return new Set(
    ITEM_COMPARE_COLUMNS.filter(
      ({ path }) => stableStringify(getValueAtPath(a, path)) !== stableStringify(getValueAtPath(b, path)),
    ).map(({ path }) => path),
  );
}

export function formatCompareValue(path: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (path === "weight" && typeof value === "number") return formatOz(value);
  if (path === "field.damages" && Array.isArray(value)) {
    return value.length
      ? value
          .map((entry: { start: number | null; damage: number }) =>
            entry.start == null ? `${entry.damage}` : `${entry.start}→${entry.damage}`,
          )
          .join(", ")
      : "—";
  }
  if (path === "extraAttributes" && Array.isArray(value)) {
    return value.length
      ? value.map((entry: { key: string; value: string }) => `${entry.key}=${entry.value}`).join("; ")
      : "—";
  }
  return String(value);
}
