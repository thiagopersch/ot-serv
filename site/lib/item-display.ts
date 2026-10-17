import {
  ELEMENT_LABELS,
  SKILL_LABELS,
  SUPPRESS_LABELS,
} from "@/lib/item-field-help";

/** `weight` é guardado em centi-oz (mesmo valor do items.xml, que o servidor divide por 100). */
export function formatOz(centiOz: number): string {
  return `${((centiOz || 0) / 100).toFixed(2)} oz`;
}

/** Só o número em oz com 2 casas (para o campo de digitação). */
export function centiOzToInput(centiOz: number | null | undefined): string {
  return ((centiOz || 0) / 100).toFixed(2);
}

/** Aceita "25,5" ou "25.5" e devolve centi-oz inteiro. */
export function inputToCentiOz(text: string): number {
  const oz = Number(text.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(oz) ? Math.round(oz * 100) : 0;
}

/** +xx / -xx, com % quando o valor é percentual. */
export function formatSigned(value: number, percent = false): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value)}${percent ? "%" : ""}`;
}

export type TooltipEntry = { label: string; value: string };

function entry(label: string, value: number, percent = false): TooltipEntry {
  return { label, value: formatSigned(value, percent) };
}

/** Rótulos "pt (en)" dos escalares de bônus; `percent` marca os que são percentuais. */
export const SCALAR_ATTRIBUTES = {
  speed: { label: "Velocidade (Speed)", percent: false },
  healthGain: { label: "Ganho de vida (Health gain)", percent: false },
  healthTicks: { label: "Intervalo de vida (Health ticks)", percent: false },
  manaGain: { label: "Ganho de mana (Mana gain)", percent: false },
  manaTicks: { label: "Intervalo de mana (Mana ticks)", percent: false },
  soulPoints: { label: "Pontos de alma (Soul points)", percent: false },
  soulPointsPercent: { label: "Pontos de alma % (Soul points %)", percent: true },
  maxHitPoints: { label: "Vida máxima (Max HP)", percent: false },
  maxHitPointsPercent: { label: "Vida máxima % (Max HP %)", percent: true },
  maxManaPoints: { label: "Mana máxima (Max mana)", percent: false },
  maxManaPointsPercent: { label: "Mana máxima % (Max mana %)", percent: true },
  magicLevelPoints: { label: "Nível mágico (Magic level)", percent: false },
  magicLevelPointsPercent: { label: "Nível mágico % (Magic level %)", percent: true },
  increaseMagicValue: { label: "Aumento de dano mágico (Increase magic)", percent: false },
  increaseMagicPercent: { label: "Aumento de dano mágico % (Increase magic %)", percent: true },
  increaseHealingValue: { label: "Aumento de cura (Increase healing)", percent: false },
  increaseHealingPercent: { label: "Aumento de cura % (Increase healing %)", percent: true },
} as const;

export type ScalarAttributeKey = keyof typeof SCALAR_ATTRIBUTES;

const COMBAT_STATS: [string, string][] = [
  ["attack", "Ataque (Attack)"],
  ["extraAttack", "Ataque extra (Extra attack)"],
  ["attackSpeed", "Velocidade de ataque (Attack speed)"],
  ["defense", "Defesa (Defense)"],
  ["extraDefense", "Defesa extra (Extra defense)"],
  ["armor", "Armadura (Armor)"],
  ["range", "Alcance (Range)"],
  ["hitChance", "Chance de acerto % (Hit chance)"],
];

type Numbers = Record<string, number | undefined> | null | undefined;

function fromRecord(
  record: Numbers,
  labels: Record<string, string>,
  percent: boolean,
): TooltipEntry[] {
  return Object.entries(record ?? {})
    .filter(([, value]) => value)
    .map(([key, value]) => entry(labels[key] ?? key, value as number, percent));
}

export type ItemDisplayRow = {
  skills?: Numbers;
  elements?: Numbers;
  absorbPercent?: Numbers;
  reflectPercent?: Numbers;
  reflectChance?: Numbers;
  fieldAbsorbPercent?: Numbers;
  suppress?: Record<string, boolean> | null;
  extraAttributes?: { key: string; value: string }[] | null;
} & Partial<Record<ScalarAttributeKey, number>> &
  Record<string, unknown>;

/** Linhas da coluna "Atributos": stats de Ataque/Defesa, skills concedidas, dano elemental,
 * bônus de atributos e atributos extras livres. */
export function getAttributeEntries(row: ItemDisplayRow): TooltipEntry[] {
  const entries: TooltipEntry[] = [];

  for (const [key, label] of COMBAT_STATS) {
    const value = row[key] as number | undefined;
    if (value) entries.push(entry(label, value, key === "hitChance"));
  }
  entries.push(...fromRecord(row.skills, SKILL_LABELS, false));
  entries.push(
    ...fromRecord(row.elements, ELEMENT_LABELS, false).map((e) => ({
      ...e,
      label: `Dano ${e.label}`,
    })),
  );
  for (const key of Object.keys(SCALAR_ATTRIBUTES) as ScalarAttributeKey[]) {
    const value = row[key];
    if (value) entries.push(entry(SCALAR_ATTRIBUTES[key].label, value, SCALAR_ATTRIBUTES[key].percent));
  }
  for (const attribute of row.extraAttributes ?? []) {
    if (attribute.key) entries.push({ label: attribute.key, value: attribute.value });
  }

  return entries;
}

/** Linhas da coluna "Proteções": absorção, absorção de campos, reflexão, chance e imunidades. */
export function getProtectionEntries(row: ItemDisplayRow): TooltipEntry[] {
  const entries: TooltipEntry[] = [];
  const groups: [Numbers, string][] = [
    [row.absorbPercent, "Absorção"],
    [row.fieldAbsorbPercent, "Absorção de campo"],
    [row.reflectPercent, "Reflexão"],
    [row.reflectChance, "Chance de reflexão"],
  ];
  for (const [record, title] of groups) {
    entries.push(
      ...fromRecord(record, ELEMENT_LABELS, true).map((e) => ({
        ...e,
        label: `${title}: ${e.label}`,
      })),
    );
  }
  for (const [key, enabled] of Object.entries(row.suppress ?? {})) {
    if (enabled) entries.push({ label: `Imune: ${SUPPRESS_LABELS[key] ?? key}`, value: "sim" });
  }
  return entries;
}
