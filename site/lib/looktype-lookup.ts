import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Localiza, dentro de uma lista de looktypes já carregada, a primeira cujo nome contenha o
 * `clientId` como número "inteiro" (não como substring de outro número) — convenção observada
 * no cadastro de looktypes de item: `item_1949` para o item de client id 1949. Os limites
 * `(?<![0-9])`/`(?![0-9])` evitam que `1949` combine com `19490` ou `219491`.
 */
export function matchLooktypeByClientId<T extends { name: string }>(
  looktypes: T[],
  clientId: number
): T | null {
  const pattern = new RegExp(`(?<![0-9])${clientId}(?![0-9])`);
  return looktypes.find((looktype) => pattern.test(looktype.name)) ?? null;
}

/**
 * Busca no cadastro (`/admin/looktypes`, category="item") a looktype cujo nome referencia o
 * `clientId` informado. Não lança erro "de sincronismo" quando nada é encontrado — retorna
 * `null` normalmente, deixando a decisão de pedir o preenchimento manual para quem chama.
 * Erros inesperados (ex.: banco indisponível) são responsabilidade do chamador tratar/logar.
 */
export async function findItemLooktypeByClientId(
  prismaClient: PrismaClient,
  clientId: number
): Promise<{ id: number; name: string } | null> {
  const looktypes = await prismaClient.looktype.findMany({
    where: { category: "item" },
    select: { id: true, name: true },
  });

  return matchLooktypeByClientId(looktypes, clientId);
}

/**
 * Busca no cadastro (`/admin/looktypes`, category="outfit") a looktype cujo `looktypeNumber`
 * (número real da sprite no cliente OTServer) seja igual ao `type="xx"` do `<look>` do XML de
 * monstro importado. Usa `orderBy id asc` para resolver de forma determinística as duplicatas
 * legadas de `looktypeNumber` dentro de "outfit" (ver schema `Looktype`). Não lança erro quando
 * nada é encontrado — retorna `null`, e o import apenas não vincula (preservando o vínculo
 * existente em updates).
 */
export async function findOutfitLooktypeByNumber(
  prismaClient: PrismaClient,
  lookTypeNumber: number
): Promise<{ id: number; looktypeNumber: number | null } | null> {
  return prismaClient.looktype.findFirst({
    where: { category: "outfit", looktypeNumber: lookTypeNumber },
    orderBy: { id: "asc" },
    select: { id: true, looktypeNumber: true },
  });
}
