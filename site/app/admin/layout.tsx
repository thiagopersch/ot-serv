import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { auth, isAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user || !isAdmin(session.user.groupId)) {
    redirect("/login?callbackUrl=/admin");
  }

  return <AdminShell>{children}</AdminShell>;
}
