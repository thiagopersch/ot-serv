import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { MAX_SHADER_BYTES, parseShaderFileName } from "@/lib/extoutfit-shader-storage";
import { withAudit } from "@/lib/api-audit-wrapper";

/** Upload em lote dos arquivos de shader do cliente (`cliente/data/shaders`). Cada arquivo é
 * casado pelo nome com o `shadername` de um registro kind=shaders (ver `parseShaderFileName`).
 * Com `createMissing=true`, shaders sem registro ganham um (próximo id livre, nome = shadername). */
export const POST = withAudit(async function POST(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const formData = await request.formData();
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);
  const createMissing = formData.get("createMissing") === "true";

  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
  }

  const ignored: string[] = [];
  const tooLarge: string[] = [];
  const byShader = new Map<string, { shaderName: string; fragment?: { text: string; file: string }; vertex?: { text: string } }>();

  for (const file of files) {
    const parsed = parseShaderFileName(file.name);
    if (!parsed) {
      ignored.push(file.name);
      continue;
    }
    if (file.size > MAX_SHADER_BYTES) {
      tooLarge.push(file.name);
      continue;
    }
    const key = parsed.shaderName.toLowerCase();
    const entry = byShader.get(key) ?? { shaderName: parsed.shaderName };
    const text = await file.text();
    if (parsed.part === "vertex") entry.vertex = { text };
    else entry.fragment = { text, file: file.name.replace(/^.*[\\/]/, "") };
    byShader.set(key, entry);
  }

  const shaders = await prisma.extOutfit.findMany({
    where: { kind: "shaders" },
    select: { id: true, xmlId: true, shaderName: true },
  });
  const recordsByName = new Map<string, number[]>();
  for (const shader of shaders) {
    const key = (shader.shaderName ?? "").toLowerCase();
    recordsByName.set(key, [...(recordsByName.get(key) ?? []), shader.id]);
  }
  let nextXmlId = Math.max(0, ...shaders.map((shader) => shader.xmlId)) + 1;

  const matched: string[] = [];
  const created: string[] = [];
  const unmatched: string[] = [];

  for (const [key, entry] of byShader) {
    const data = {
      ...(entry.fragment ? { shaderSource: entry.fragment.text, shaderFileName: entry.fragment.file } : {}),
      ...(entry.vertex ? { shaderVertexSource: entry.vertex.text } : {}),
    };

    const ids = recordsByName.get(key);
    if (ids?.length) {
      await prisma.extOutfit.updateMany({ where: { id: { in: ids } }, data });
      matched.push(entry.shaderName);
    } else if (createMissing && entry.fragment) {
      await prisma.extOutfit.create({
        data: { kind: "shaders", xmlId: nextXmlId++, name: entry.shaderName, shaderName: entry.shaderName, ...data },
      });
      created.push(entry.shaderName);
    } else {
      unmatched.push(entry.shaderName);
    }
  }

  await logAudit({
    accountId: Number(session.user.id),
    action: "import",
    entity: "extoutfit_shader",
    metadata: { matched: matched.length, created: created.length, unmatched, ignored, tooLarge },
  });

  return NextResponse.json({ matched, created, unmatched, ignored, tooLarge });
});
