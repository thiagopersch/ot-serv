/**
 * Constantes/helpers de nível de acesso sem nenhum efeito colateral (sem NextAuth,
 * sem Prisma) — seguro para importar tanto em componentes de servidor quanto em
 * componentes "use client" (ex.: Navbar). `lib/auth.ts` reexporta isso para quem
 * já importava de lá.
 */
export const ADMIN_MIN_GROUP_ID = 5;
export const SITE_ADMIN_GROUP_ID = 6;

export function isAdmin(groupId: number | undefined | null) {
  return typeof groupId === "number" && groupId >= ADMIN_MIN_GROUP_ID;
}

export function isSiteAdmin(groupId: number | undefined | null) {
  return groupId === SITE_ADMIN_GROUP_ID;
}
