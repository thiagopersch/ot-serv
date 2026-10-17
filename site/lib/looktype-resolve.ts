import type { PrismaClient } from "@/lib/generated/prisma/client";

type LooktypeClient = Pick<PrismaClient, "looktype">;

/** Resolve números de looktype (outfit) para registros do cadastro `/admin/looktypes`, criando os
 * que não existirem (category="outfit", sem frames em disco — o admin pode anexar o `.obd`
 * depois). Usado pelos imports de `outfits.xml` e `extoutfits.xml`.
 *
 * Duplicatas legadas de `looktypeNumber` resolvem para o menor id (mesma regra de
 * `findOutfitLooktypeByNumber`). `names` sugere o nome de cada looktype criada; se colidir com o
 * `@@unique([category, name])`, usa `"<nome> (#<número>)"`. */
export async function resolveOrCreateOutfitLooktypes(
  client: LooktypeClient,
  numbers: Map<number, string>,
): Promise<{ idByNumber: Map<number, number>; created: number }> {
  const idByNumber = new Map<number, number>();
  if (numbers.size === 0) return { idByNumber, created: 0 };

  const existing = await client.looktype.findMany({
    where: { category: "outfit", looktypeNumber: { in: [...numbers.keys()] } },
    orderBy: { id: "asc" },
    select: { id: true, looktypeNumber: true },
  });
  for (const row of existing) {
    if (row.looktypeNumber !== null && !idByNumber.has(row.looktypeNumber)) {
      idByNumber.set(row.looktypeNumber, row.id);
    }
  }

  const missing = [...numbers.entries()].filter(([number]) => !idByNumber.has(number));
  if (missing.length === 0) return { idByNumber, created: 0 };

  const takenNames = new Set(
    (
      await client.looktype.findMany({ where: { category: "outfit" }, select: { name: true } })
    ).map((row) => row.name.toLowerCase()),
  );

  for (const [number, suggestedName] of missing) {
    let name = (suggestedName.trim() || `Looktype ${number}`).slice(0, 150);
    if (takenNames.has(name.toLowerCase())) name = `${name} (#${number})`.slice(0, 150);
    if (takenNames.has(name.toLowerCase())) name = `Looktype ${number}`;
    takenNames.add(name.toLowerCase());

    const created = await client.looktype.create({
      data: {
        name,
        category: "outfit",
        looktypeNumber: number,
        frameCount: 1,
        frameDurationsMs: [300],
      },
      select: { id: true },
    });
    idByNumber.set(number, created.id);
  }

  return { idByNumber, created: missing.length };
}
