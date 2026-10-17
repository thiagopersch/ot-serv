import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import type { LuaScriptInput } from "@/lib/validations/admin/lua-script";
import { LuaScriptForm } from "@/components/admin/lua-scripts/lua-script-form";
import { DuplicateButton } from "@/components/shared/duplicate-button";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar script Lua",
};

export default async function EditLuaScriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const luaScript = await prisma.luaScript.findUnique({
    where: { id: Number(id) },
  });

  if (!luaScript || luaScript.deletedAt) {
    notFound();
  }

  const initialValues: LuaScriptInput = {
    name: luaScript.name,
    category: luaScript.category as LuaScriptInput["category"],
    content: luaScript.content,
  };

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/lua-scripts" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Editar script: {luaScript.name}
          </h1>
          <p className="text-muted-foreground">
            Cadastre um script <code>.lua</code> real para vincular como
            conveniência aos Movements.
          </p>
        </div>
        <DuplicateButton
          endpoint={`/api/admin/lua-scripts/${luaScript.id}/duplicate`}
          editPathBase="/admin/lua-scripts"
          variant="header"
        />
      </div>
      <LuaScriptForm luaScriptId={luaScript.id} initialValues={initialValues} />
    </div>
  );
}
