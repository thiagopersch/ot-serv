import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { extOutfitFileRefs, readExtOutfitFile } from "@/lib/extoutfit-files-server";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

/** Arquivo do registro conforme o tipo (`?part=image|fragment|vertex|tex1`) — bytes originais,
 * com o nome do cliente (`Akatsuki.png`, `ShaderOutRed.frag`, ...). `?inline=1` sem attachment. */
export const GET = withAudit(async function GET(request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const entry = await prisma.extOutfit.findUnique({ where: { id: Number(id) } });
  if (!entry) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });

  const image = await prisma.entityImage.findUnique({
    where: { entityType_entityId: { entityType: "extoutfit", entityId: entry.id } },
  });
  const url = new URL(request.url);
  const part = url.searchParams.get("part") ?? "image";
  const file = extOutfitFileRefs(entry, image?.extension ?? null).find((ref) => ref.part === part);
  if (!file) return NextResponse.json({ error: "Arquivo não enviado para este registro." }, { status: 404 });

  const content = await readExtOutfitFile(entry, file, image?.extension ?? null);
  if (!content) return NextResponse.json({ error: "Arquivo não encontrado no disco." }, { status: 404 });

  return new Response(Buffer.from(content), {
    headers: {
      "Content-Type": file.contentType === "text/plain" ? "text/plain; charset=utf-8" : file.contentType,
      "Cache-Control": "no-store",
      ...(url.searchParams.get("inline") === "1"
        ? {}
        : { "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"` }),
    },
  });
});
