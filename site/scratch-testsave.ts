import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { vocationInputToPrismaData, vocationToInput } from "@/lib/vocation-mapper";

async function main() {
  const before = await prisma.vocation.findFirst({ where: { lookTypeId: null } });
  if (!before) {
    console.log("no vocation with null lookTypeId found");
    return;
  }
  console.log("testing on vocation", before.id, before.name, "currently lookTypeId=", before.lookTypeId);

  const input = { ...vocationToInput(before), lookTypeId: 4 };
  const data = vocationInputToPrismaData(input);
  const { id, ...updateData } = data;
  void id;
  const updated = await prisma.vocation.update({ where: { id: before.id }, data: updateData });
  console.log("after update, lookTypeId=", updated.lookTypeId);

  // revert
  await prisma.vocation.update({ where: { id: before.id }, data: { lookTypeId: null } });
  console.log("reverted");
  await prisma.$disconnect();
}

main();
