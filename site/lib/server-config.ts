import { prisma } from "@/lib/prisma";

/** Chave-valor genérica já usada pelo engine (`server_config`, ex.: `db_version`). O portal
 * reaproveita a mesma tabela para configurações administráveis que não pertencem ao engine
 * (ex.: caps de skill exibidos no perfil público). */
export async function getServerConfig(key: string, fallback: string): Promise<string> {
  const row = await prisma.serverConfig.findUnique({ where: { config: key } });
  return row?.value ?? fallback;
}

export async function setServerConfig(key: string, value: string): Promise<void> {
  await prisma.serverConfig.upsert({
    where: { config: key },
    update: { value },
    create: { config: key, value },
  });
}

export const SKILL_CAP_DODGE_KEY = "skill_cap_dodge";
export const SKILL_CAP_CRITICAL_KEY = "skill_cap_critical";
export const DEFAULT_SKILL_CAP = "1000";

/** HD Mode das sprites no site (xBRZ 2x, ver `lib/sprite-hd.ts`) — ligado por padrão, como o
 * `hdSprites` do cliente. */
export const HD_SPRITES_KEY = "site_hd_sprites";
export const DEFAULT_HD_SPRITES = "1";

export async function getHdSpritesEnabled(): Promise<boolean> {
  return (await getServerConfig(HD_SPRITES_KEY, DEFAULT_HD_SPRITES)) === "1";
}
