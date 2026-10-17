import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAudit } from "@/lib/api-audit-wrapper";

type Params = { params: Promise<{ id: string }> };

export const GET = withAudit(async function GET(_request: Request, { params }: Params) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const luaScript = await prisma.luaScript.findUnique({
    where: { id: Number(id) },
  });

  if (!luaScript || luaScript.deletedAt) {
    return NextResponse.json(
      { error: "Script não encontrado." },
      { status: 404 },
    );
  }

  return new Response(Buffer.from(luaScript.content, "utf-8"), {
    headers: {
      "Content-Type": "text/x-lua; charset=utf-8",
      "Content-Disposition": `attachment; filename="${luaScript.name}"`,
    },
  });
});
