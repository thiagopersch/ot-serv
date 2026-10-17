import { prisma } from "@/lib/prisma";

/** Marca como ativa (vigente pros jogadores) apenas a temporada cujo mês/ano bate com a data
 * atual — as demais (histórico ou futuras, cadastradas com antecedência) ficam inativas. Chamado
 * após qualquer criação/edição/exclusão de temporada pelo admin. */
export async function syncActiveSeason() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  await prisma.$transaction([
    prisma.battlePassSeason.updateMany({
      where: { NOT: { month, year } },
      data: { isActive: false },
    }),
    prisma.battlePassSeason.updateMany({
      where: { month, year },
      data: { isActive: true },
    }),
  ]);
}
