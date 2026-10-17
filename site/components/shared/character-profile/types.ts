import type { Equipment } from "@/components/shared/tibia-equipment-panel";

export type EntityImageRef = { extension: string; updatedAt: string } | null;

export type OtherCharacter = {
  id: number;
  name: string;
  level: number;
  resets: number;
  online: number;
  vocation: number;
  vocationName: string;
  vocationImage: EntityImageRef;
};

export type CharacterDetail = {
  id: number;
  name: string;
  level: number;
  vocation: number;
  vocationName: string;
  vocationImage: EntityImageRef;
  experience: string;
  sex: number;
  online: number;
  lastlogin: number;
  lastlogout: number;
  resets: number;
  balance: number;
  balanceCrystalCoins: number;
  cap: number;
  soul: number;
  health: number;
  healthmax: number;
  mana: number;
  manamax: number;
  townName: string;
  age: number;
  createdAt: string;
  rankPositionLevel: number;
  rankPositionResets: number;
  donationCount: number;
  donateTier: { key: string; name: string; bonusPct: number };
  infiniteBless: boolean;
  resetAverage: number | null;
  accountGroupId: number;
  guild: { id: number; name: string; rank: string } | null;
  equipment: Equipment;
  otherCharacters: OtherCharacter[];
};

export type SkillsData = {
  skills: Record<string, number>;
  magic: number;
  attackSpeed: number;
  dodge: number;
  critical: number;
  dodgeCap: number;
  criticalCap: number;
};

export type FragEntry = {
  date: number;
  victimName: string;
  victimSex: number;
  victimLevel: number;
  victimResets: number;
  unjustified: boolean;
};

export type CombatData = {
  fragCounts: { last7: number; last15: number; last30: number };
  totalKills: number;
  totalDeaths: number;
  justifiedFrags: FragEntry[];
  unjustifiedFrags: FragEntry[];
};

export type TaskEntry = {
  taskId: string;
  name: string;
  category: string;
  difficulty: string;
  kills: number;
  killsRequired: number;
  completed: boolean;
  rewarded: boolean;
  progressPercent: number;
  postSlug: string | null;
};

export type TasksData = {
  points: number;
  totalCompleted: number;
  tasksByCategory: Record<string, TaskEntry[]>;
};

export type QuestEntry = {
  id: number;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  completed: boolean;
  rewarded: boolean;
};

export type QuestsData = {
  questsByCategory: Record<string, QuestEntry[]>;
};
