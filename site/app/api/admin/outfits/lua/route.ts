import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { outfitUnlockActionsXml, outfitUnlockLua, outfitsWithUnlockItem } from "@/lib/outfit-lua";
import { parseSelectedIds } from "@/lib/outfit-mapper";
import { withAudit } from "@/lib/api-audit-wrapper";

/** Script `outfit_item_unlock.lua` + linhas do `actions.xml` para as outfits com item
 * configurado (`?ids=` restringe aos selecionados). */
export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const ids = parseSelectedIds(new URL(request.url));

  const outfits = await prisma.outfitDefinition.findMany({
    where: { unlockItemId: { not: null }, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: { id: "asc" },
    select: { id: true, name: true, storageId: true, storageValue: true, unlockItemId: true },
  });

  return NextResponse.json({
    count: outfitsWithUnlockItem(outfits).length,
    lua: outfitUnlockLua(outfits),
    actionsXml: outfitUnlockActionsXml(outfits),
  });
});
