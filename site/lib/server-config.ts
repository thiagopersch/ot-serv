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
