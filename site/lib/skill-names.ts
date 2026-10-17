/** `skill_t` clássico do OTServer (mesma ordem de `SKILL_IDS` em app/api/public/ranking/route.ts). */
export const SKILL_IDS: Record<string, number> = {
  fist: 0,
  club: 1,
  sword: 2,
  axe: 3,
  distance: 4,
  shielding: 5,
  fishing: 6,
};

export type SkillDisplay = {
  key: string;
  labelPt: string;
  labelEn: string;
};

/** Rótulo em PT exibido no perfil e o nome em inglês mostrado no tooltip (nome oficial da
 * skill no engine/cliente Tibia). */
export const SKILL_DISPLAYS: SkillDisplay[] = [
  { key: "attackspeed", labelPt: "Velocidade de ataque", labelEn: "Attack Speed" },
  { key: "club", labelPt: "Clava", labelEn: "Club Fighting" },
  { key: "sword", labelPt: "Espada", labelEn: "Sword Fighting" },
  { key: "axe", labelPt: "Machado", labelEn: "Axe Fighting" },
  { key: "distance", labelPt: "Distância", labelEn: "Distance Fighting" },
  { key: "shielding", labelPt: "Escudo", labelEn: "Shielding" },
  { key: "fishing", labelPt: "Pesca", labelEn: "Fishing" },
  { key: "magic", labelPt: "Magia", labelEn: "Magic Level" },
  { key: "dodge", labelPt: "Dodge", labelEn: "Dodge" },
  { key: "critical", labelPt: "Critical", labelEn: "Critical Hit Chance" },
];
