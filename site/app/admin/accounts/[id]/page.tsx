import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { AccountForm } from "@/components/admin/accounts/account-form";
import { BackToListButton } from "@/components/shared/back-to-list-button";

export const metadata: Metadata = {
  title: "Editar conta",
};

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      name: true,
      email: true,
      groupId: true,
      blocked: true,
      premdays: true,
      warnings: true,
    },
  });

  if (!account) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToListButton href="/admin/accounts" />
      <div>
        <h1 className="text-2xl font-semibold">Editar conta: {account.name}</h1>
        <p className="text-muted-foreground">Altere os dados da conta.</p>
      </div>
      <AccountForm accountId={account.id} initialValues={{ ...account, password: "" }} />
    </div>
  );
}
