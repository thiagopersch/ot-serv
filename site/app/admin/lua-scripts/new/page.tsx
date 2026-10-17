import type { Metadata } from "next";

import { LuaScriptForm } from "@/components/admin/lua-scripts/lua-script-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Novo script Lua",
};

export default function NewLuaScriptPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/lua-scripts" />
      <div>
        <h1 className="text-2xl font-semibold">Novo script Lua</h1>
        <p className="text-muted-foreground">
          Cadastre um script <code>.lua</code> real para vincular como
          conveniência aos Movements.
        </p>
      </div>
      <LuaScriptForm />
    </div>
  );
}
