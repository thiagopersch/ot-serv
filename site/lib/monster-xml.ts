import {
  ELEMENT_KEYS,
  IMMUNITY_KEYS,
  lootChancePercentToRaw,
  type MonsterFormInput,
  type MonsterLootItemInput,
  type MonsterSpellInput,
} from "@/lib/validations/admin/monster";
import { escapeXml, indent } from "@/lib/xml-utils";

function attrsToTag(tag: string, attrs: string[], selfClose = true): string {
  const open = `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
  return selfClose ? `${open} />` : `${open}>`;
}

function boolAttr(value: boolean): string {
  return value ? "1" : "0";
}

/** Nome efetivo do attack/defense no XML: se houver spell vinculada, usa as `words` dela
 * (é assim que a engine casa o attack com a spell em spells.xml); sem vínculo, usa o
 * campo `name` digitado manualmente. */
function resolveSpellName(spell: MonsterSpellInput, wordsBySpellId: Record<number, string>): string {
  if (spell.spellId != null) {
    return wordsBySpellId[spell.spellId] ?? spell.name;
  }
  return spell.name;
}

function spellAttrs(spell: MonsterSpellInput, wordsBySpellId: Record<number, string>): string[] {
  const attrs: string[] = [];

  if (spell.script) {
    attrs.push(`script="${escapeXml(spell.script)}"`);
  } else {
    attrs.push(`name="${escapeXml(resolveSpellName(spell, wordsBySpellId))}"`);
  }

  attrs.push(`interval="${spell.interval}"`);
  attrs.push(`chance="${spell.chance}"`);
  if (spell.range) attrs.push(`range="${spell.range}"`);
  if (spell.radius) attrs.push(`radius="${spell.radius}"`);
  if (spell.length) attrs.push(`length="${spell.length}"`);
  if (spell.spread) attrs.push(`spread="${spell.spread}"`);
  if (spell.target) attrs.push(`target="1"`);
  if (spell.min !== 0) attrs.push(`min="${spell.min}"`);
  if (spell.max !== 0) attrs.push(`max="${spell.max}"`);
  if (spell.speedchange !== 0) attrs.push(`speedchange="${spell.speedchange}"`);
  if (spell.duration !== 0) attrs.push(`duration="${spell.duration}"`);

  return attrs;
}

function spellTagXml(
  tag: string,
  spell: MonsterSpellInput,
  level: number,
  wordsBySpellId: Record<number, string>
): string[] {
  const attrs = spellAttrs(spell, wordsBySpellId);

  if (spell.attributes.length === 0) {
    return indent([attrsToTag(tag, attrs)], level);
  }

  const lines: string[] = [];
  lines.push(...indent([attrsToTag(tag, attrs, false)], level));
  lines.push(
    ...indent(
      spell.attributes.map(
        (attribute) => `<attribute key="${escapeXml(attribute.key)}" value="${escapeXml(attribute.value)}" />`
      ),
      level + 1
    )
  );
  lines.push(...indent([`</${tag}>`], level));
  return lines;
}

function lootItemXml(item: MonsterLootItemInput, level: number): string[] {
  const attrs = [`id="${item.id}"`];
  if (item.count > 1) attrs.push(`countmax="${item.count}"`);
  attrs.push(`chance="${lootChancePercentToRaw(item.chance)}"`);
  if (item.subtype != null) attrs.push(`subtype="${item.subtype}"`);
  if (item.actionId != null) attrs.push(`actionId="${item.actionId}"`);
  if (item.uniqueId != null) attrs.push(`uniqueId="${item.uniqueId}"`);
  if (item.text) attrs.push(`text="${escapeXml(item.text)}"`);

  const comment = item.comment ? ` <!-- ${item.comment} -->` : "";
  const children = item.children ?? [];

  if (children.length === 0) {
    return indent([`${attrsToTag("item", attrs)}${comment}`], level);
  }

  const lines: string[] = [];
  lines.push(...indent([`${attrsToTag("item", attrs, false)}${comment}`], level));
  for (const child of children) {
    lines.push(...lootItemXml(child, level + 1));
  }
  lines.push(...indent(["</item>"], level));
  return lines;
}

export function monsterToXml(
  monster: MonsterFormInput,
  wordsBySpellId: Record<number, string> = {},
  /** Número da looktype vinculada (`Looktype.looktypeNumber`) — não confundir com
   * `monster.lookTypeId`, que é o id do registro no cadastro de looktypes. */
  looktypeNumber: number | null = null,
  /** Nome do universo vinculado (`Universe.name`) — exportado ao lado de `bestiary`. */
  universeName: string | null = null,
): string {
  const rootAttrs = [
    `name="${escapeXml(monster.name)}"`,
    `bestiary="${escapeXml(monster.bestiary)}"`,
  ];
  if (universeName) rootAttrs.push(`universe="${escapeXml(universeName)}"`);
  rootAttrs.push(
    `nameDescription="${escapeXml(monster.nameDescription || `a ${monster.name.toLowerCase()}`)}"`,
    `race="${escapeXml(monster.race)}"`,
    `experience="${monster.experience}"`,
    `speed="${monster.speed}"`,
  );
  if (monster.manacost) rootAttrs.push(`manacost="${monster.manacost}"`);

  const lines: string[] = [`<?xml version="1.0" encoding="UTF-8"?>`, `<monster ${rootAttrs.join(" ")}>`];

  lines.push(...indent([`<health now="${monster.healthNow}" max="${monster.healthMax}" />`], 1));

  const lookAttrs: string[] = [];
  // `type=` é o número do próprio cadastro da looktype vinculada (não o id do registro).
  if (looktypeNumber != null) lookAttrs.push(`type="${looktypeNumber}"`);
  lookAttrs.push(`head="${monster.lookHead}"`);
  lookAttrs.push(`body="${monster.lookBody}"`);
  lookAttrs.push(`legs="${monster.lookLegs}"`);
  lookAttrs.push(`feet="${monster.lookFeet}"`);
  lookAttrs.push(`addons="${monster.lookAddons}"`);
  if (monster.lookTypeEx != null) lookAttrs.push(`typeex="${monster.lookTypeEx}"`);
  if (monster.corpse) lookAttrs.push(`corpse="${monster.corpse}"`);
  lines.push(...indent([attrsToTag("look", lookAttrs)], 1));

  lines.push(
    ...indent(
      [
        attrsToTag("targetchange", [
          `interval="${monster.targetChangeInterval}"`,
          `chance="${monster.targetChangeChance}"`,
        ]),
      ],
      1
    )
  );

  if (monster.strategyAttack != null || monster.strategyDefense != null) {
    lines.push(
      ...indent(
        [
          attrsToTag("strategy", [
            `attack="${monster.strategyAttack ?? 0}"`,
            `defense="${monster.strategyDefense ?? 0}"`,
          ]),
        ],
        1
      )
    );
  }

  const f = monster.flags;
  lines.push(...indent(["<flags>"], 1));
  lines.push(
    ...indent(
      [
        `<flag summonable="${boolAttr(f.summonable)}" />`,
        `<flag attackable="${boolAttr(f.attackable)}" />`,
        `<flag hostile="${boolAttr(f.hostile)}" />`,
        `<flag illusionable="${boolAttr(f.illusionable)}" />`,
        `<flag convinceable="${boolAttr(f.convinceable)}" />`,
        `<flag pushable="${boolAttr(f.pushable)}" />`,
        `<flag canpushitems="${boolAttr(f.canpushitems)}" />`,
        `<flag canpushcreatures="${boolAttr(f.canpushcreatures)}" />`,
        `<flag hidename="${boolAttr(f.hidename)}" />`,
        `<flag hidehealth="${boolAttr(f.hidehealth)}" />`,
        `<flag lightlevel="${f.lightlevel}" />`,
        `<flag lightcolor="${f.lightcolor}" />`,
        `<flag lootmessage="${f.lootmessage}" />`,
        `<flag targetdistance="${f.targetdistance}" />`,
        `<flag staticattack="${f.staticattack}" />`,
        `<flag runonhealth="${f.runonhealth}" />`,
        `<flag lureable="${boolAttr(f.lureable)}" />`,
        `<flag walkable="${boolAttr(f.walkable)}" />`,
        `<flag skull="${escapeXml(f.skull)}" />`,
        `<flag shield="${escapeXml(f.shield)}" />`,
        `<flag emblem="${escapeXml(f.emblem)}" />`,
        `<flag canwalkonenergy="${boolAttr(f.canwalkonenergy)}" />`,
        `<flag canwalkonfire="${boolAttr(f.canwalkonfire)}" />`,
        `<flag canwalkonpoison="${boolAttr(f.canwalkonpoison)}" />`,
      ],
      2
    )
  );
  lines.push(...indent(["</flags>"], 1));

  if (monster.attacks.length > 0) {
    lines.push(...indent(["<attacks>"], 1));
    for (const attack of monster.attacks) {
      lines.push(...spellTagXml("attack", attack, 2, wordsBySpellId));
    }
    lines.push(...indent(["</attacks>"], 1));
  }

  lines.push(
    ...indent(
      [`<defenses armor="${monster.defenseArmor}" defense="${monster.defenseValue}"${monster.defenses.length ? ">" : " />"}`],
      1
    )
  );
  if (monster.defenses.length > 0) {
    for (const defense of monster.defenses) {
      lines.push(...spellTagXml("defense", defense, 2, wordsBySpellId));
    }
    lines.push(...indent(["</defenses>"], 1));
  }

  lines.push(...indent(["<immunities>"], 1));
  lines.push(
    ...indent(
      IMMUNITY_KEYS.map((key) => `<immunity ${key}="${monster.immunities[key] ?? 0}" />`),
      2
    )
  );
  lines.push(...indent(["</immunities>"], 1));

  lines.push(...indent(["<elements>"], 1));
  lines.push(
    ...indent(
      ELEMENT_KEYS.map((key) => `<element ${key}="${monster.elements[key] ?? 0}" />`),
      2
    )
  );
  lines.push(...indent(["</elements>"], 1));

  if (monster.voices.length > 0) {
    lines.push(
      ...indent(
        [`<voices interval="${monster.voiceInterval}" chance="${monster.voiceChance}">`],
        1
      )
    );
    lines.push(
      ...indent(
        monster.voices.map(
          (voice) =>
            `<voice sentence="${escapeXml(voice.sentence)}"${voice.yell ? ` yell="1"` : ""} />`
        ),
        2
      )
    );
    lines.push(...indent(["</voices>"], 1));
  }

  if (monster.loot.length > 0) {
    lines.push(...indent(["<loot>"], 1));
    for (const item of monster.loot) {
      lines.push(...lootItemXml(item, 2));
    }
    lines.push(...indent(["</loot>"], 1));
  }

  if (monster.summons.length > 0) {
    lines.push(...indent([attrsToTag("summons", [`maxSummons="${monster.maxSummons}"`], false)], 1));
    lines.push(
      ...indent(
        monster.summons.map((summon) =>
          attrsToTag("summon", [
            `name="${escapeXml(summon.name)}"`,
            `interval="${summon.interval}"`,
            `chance="${summon.chance}"`,
            `amount="${summon.amount}"`,
          ])
        ),
        2
      )
    );
    lines.push(...indent(["</summons>"], 1));
  }

  if (monster.script.length > 0) {
    lines.push(...indent(["<script>"], 1));
    lines.push(
      ...indent(
        monster.script.map((event) => `<event name="${escapeXml(event)}" />`),
        2
      )
    );
    lines.push(...indent(["</script>"], 1));
  }

  lines.push("</monster>");

  return lines.join("\n");
}

export function monsterFileName(name: string): string {
  return `${name.trim().toLowerCase()}.xml`;
}

export type MonsterListEntry = { name: string; category: string; subcategory: string };

/** Reconstrói o `file="..."` do `monsters.xml`, ex.: "dragon ball/1-50/android.xml". */
export function monsterFilePath(entry: MonsterListEntry): string {
  const parts = [entry.category, entry.subcategory].filter(Boolean);
  const fileName = monsterFileName(entry.name);
  return parts.length ? `${parts.join("/")}/${fileName}` : fileName;
}

export function monstersToXmlDocument(entries: MonsterListEntry[]): string {
  const lines = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "<monsters>"];
  lines.push(
    ...indent(
      entries
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(
          (entry) =>
            `<monster name="${escapeXml(entry.name)}" file="${escapeXml(monsterFilePath(entry))}" />`
        ),
      1
    )
  );
  lines.push("</monsters>");
  return lines.join("\n") + "\n";
}
