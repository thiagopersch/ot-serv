import { NextResponse } from "next/server";

import { auth, isAdmin, isSiteAdmin } from "@/lib/auth";

export async function requireSession() {
  const session = await auth();

  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: "Autenticação necessária." }, { status: 401 }),
    } as const;
  }

  return { session, response: null } as const;
}

export async function requireAdminSession() {
  const session = await auth();

  if (!session?.user || !isAdmin(session.user.groupId)) {
    return {
      session: null,
      response: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }),
    } as const;
  }

  return { session, response: null } as const;
}

/** Mais restrito que `requireAdminSession` — só Admin Master (`group_id = 6`). Usado em rotas
 * de maior risco, como o Explorador de arquivos do servidor (leitura/escrita crua no disco do
 * host, fora do banco). */
export async function requireSiteAdminSession() {
  const session = await auth();

  if (!session?.user || !isSiteAdmin(session.user.groupId)) {
    return {
      session: null,
      response: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }),
    } as const;
  }

  return { session, response: null } as const;
}
