import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth, isSiteAdmin } from "@/lib/auth";
import { BackToListButton } from "@/components/shared/back-to-list-button";
import { ServerFileExplorer } from "@/components/admin/lua-scripts/server-file-explorer";

export const metadata: Metadata = {
  title: "Explorador do servidor",
};

/** Só Admin Master (`group_id = 6`) — leitura/escrita crua no disco do servidor é mais
 * sensível que o resto do CRUD (`group_id >= 5`, gate geral em `app/admin/layout.tsx`). */
export default async function LuaScriptsExplorerPage() {
  const session = await auth();
  if (!isSiteAdmin(session?.user?.groupId)) {
    redirect("/admin/lua-scripts");
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/lua-scripts" />
      <div>
        <h1 className="text-2xl font-semibold">Explorador do servidor</h1>
        <p className="text-muted-foreground">
          Navegue e edite os arquivos reais do servidor OTServer no disco. Scripts{" "}
          <code>.lua</code> dentro de uma pasta de categoria reconhecida (ex.{" "}
          <code>data/npc/scripts</code>) também sincronizam com o cadastro de Scripts Lua ao
          salvar.
        </p>
      </div>
      <ServerFileExplorer />
    </div>
  );
}
