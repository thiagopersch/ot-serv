"use client";

import { useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import dayjs from "dayjs";
import { signOut } from "next-auth/react";
import { AlertTriangle, Crown, Pencil, Plus, ShieldCheck, Sparkles, Sword, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { fetcher, FetchError } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

type AccountSummary = {
  account: { name: string; premdays: number; isVip: boolean; blocked: boolean };
  characters: {
    id: number;
    name: string;
    level: number;
    vocationName: string;
    worldId: number;
    online: number;
  }[];
  reports: { id: number; report: string; timestamp: number }[];
  openTicketsCount: number;
};

export function AccountDashboard() {
  const { data, error, isLoading, mutate } = useSWR<AccountSummary>(
    "/api/account/summary",
    fetcher,
  );

  useEffect(() => {
    if (error instanceof FetchError && error.status === 401) {
      signOut({ callbackUrl: "/login" });
    }
  }, [error]);

  async function handleDeleteCharacter(id: number) {
    const response = await fetch(`/api/account/characters/${id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Não foi possível excluir o personagem.");
      return;
    }

    toast.success("Personagem excluído.");
    mutate();
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-8 w-64" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Minha conta</h1>
        <p className="text-muted-foreground">Bem-vindo, {data.account.name}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Minhas Denúncias</CardTitle>
        </CardHeader>
        <CardContent>
          {data.reports.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
              <AlertTriangle className="size-10" />
              <p>Você ainda não fez nenhuma denúncia.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.reports.map((report) => (
                <li key={report.id} className="rounded-md border bg-muted/20 p-3 text-sm">
                  <p className="mb-1 text-xs text-muted-foreground">
                    {dayjs.unix(report.timestamp).format("DD/MM/YYYY HH:mm")}
                  </p>
                  <p className="whitespace-pre-wrap">{report.report}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suporte</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium">Meus Tickets</p>
            <p className="text-sm text-muted-foreground">
              {data.openTicketsCount > 0
                ? `Você tem ${data.openTicketsCount} ticket(s) em aberto.`
                : "Precisa de ajuda? Abra um ticket para a nossa equipe."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-chart-2 text-primary-foreground hover:bg-chart-2/90"
              nativeButton={false}
              render={<Link href="/support/new" />}
            >
              Abrir Ticket
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/support/tickets" />}>
              Ver Tickets
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status da Conta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full",
                  data.account.isVip
                    ? "bg-amber-500/15 text-amber-500"
                    : "bg-destructive/15 text-destructive"
                )}
              >
                <Crown className="size-5" />
              </span>
              <div>
                <p className="font-medium">{data.account.isVip ? "Conta VIP" : "Conta Gratuita"}</p>
                <p className="text-sm text-muted-foreground">
                  {data.account.isVip
                    ? `${data.account.premdays} dia(s) de VIP restante(s).`
                    : "Seu tempo VIP expirou."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button nativeButton={false} render={<Link href="/account" />}>
                Gerenciar Conta
              </Button>
              <Button nativeButton={false} render={<Link href="/shop/donate" />}>
                Comprar Tempo VIP
              </Button>
              <Button nativeButton={false} render={<Link href="/shop/donate" />}>
                Comprar Rubini Coins
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-3 text-sm">
              <Sparkles className="size-4 shrink-0 text-amber-500" />
              Bônus de experiência
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-3 text-sm">
              <Sword className="size-4 shrink-0 text-sky-500" />
              Armas de treino exclusivas
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-3 text-sm">
              <ShieldCheck className="size-4 shrink-0 text-emerald-500" />
              Bênçãos gratuitas
            </div>
          </div>

          <Link href="/shop/donate" className="text-sm text-primary hover:underline">
            Ver todos os benefícios
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meus Personagens</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.characters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você ainda não tem nenhum personagem.</p>
          ) : (
            data.characters.map((character) => (
              <div
                key={character.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/community/characters/${encodeURIComponent(character.name)}`}
                    className={cn(
                      "truncate font-medium hover:underline",
                      character.online === 1 ? "text-green-500" : "text-red-500",
                    )}
                  >
                    {character.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {character.vocationName} · Level {character.level} · NDBO
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={<Link href={`/account/characters/${character.id}/edit`} />}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm">
                        <Trash2 className="size-4" />
                      </Button>
                    }
                    title="Excluir personagem"
                    description={`Tem certeza que deseja excluir "${character.name}"? Esta ação não pode ser desfeita.`}
                    confirmLabel="Excluir"
                    onConfirm={() => handleDeleteCharacter(character.id)}
                  />
                </div>
              </div>
            ))
          )}

          <div className="flex justify-end">
            <Button nativeButton={false} render={<Link href="/account/characters/new" />}>
              <Plus className="size-4" />
              Criar Personagem
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
