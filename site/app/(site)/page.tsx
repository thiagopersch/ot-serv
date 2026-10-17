import type { Metadata } from "next";
import Link from "next/link";
import dayjs from "dayjs";

import { prisma } from "@/lib/prisma";
import { publicPlayerVisibilityWhere } from "@/lib/public-player-visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Início",
};

export default async function HomePage() {
  const [topPlayers, onlineCount, recentDeaths, posts] = await Promise.all([
    prisma.player.findMany({
      where: { deleted: 0, ...publicPlayerVisibilityWhere() },
      orderBy: [{ level: "desc" }, { experience: "desc" }],
      take: 5,
      select: { id: true, name: true, level: true, online: true },
    }),
    prisma.player.count({ where: { online: 1, deleted: 0, ...publicPlayerVisibilityWhere() } }),
    prisma.playerDeath.findMany({
      where: { player: publicPlayerVisibilityWhere() },
      orderBy: { date: "desc" },
      take: 5,
      include: { player: { select: { name: true } } },
    }),
    prisma.post.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: { id: true, title: true, slug: true, excerpt: true, publishedAt: true },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16">
      <section className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Bem-vindo ao NDBO</h1>
        <p className="max-w-2xl text-muted-foreground">
          Acompanhe rankings, guilds, eventos e gerencie sua conta no servidor diretamente pelo
          portal.
        </p>
        <div className="flex gap-3">
          <Button nativeButton={false} render={<Link href="/register" />}>
            Criar conta
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/downloads" />}
          >
            Baixar cliente
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ranking</CardTitle>
            <CardDescription>Top 5 jogadores do servidor.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {topPlayers.length === 0 && <p className="text-muted-foreground">Sem jogadores ainda.</p>}
            {topPlayers.map((player, index) => (
              <Link
                key={player.id}
                href={`/community/characters/${encodeURIComponent(player.name)}`}
                className="flex items-center justify-between hover:underline"
              >
                <span>
                  {index + 1}. {player.name}
                </span>
                <span className="text-muted-foreground">Lv. {player.level}</span>
              </Link>
            ))}
            <Link href="/community/ranking" className="mt-2 text-xs text-muted-foreground hover:underline">
              Ver ranking completo →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas mortes</CardTitle>
            <CardDescription>Acompanhe os feitos recentes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {recentDeaths.length === 0 && <p className="text-muted-foreground">Nenhuma morte registrada.</p>}
            {recentDeaths.map((death) => (
              <div key={death.id} className="flex items-center justify-between">
                <span>{death.player.name}</span>
                <span className="text-muted-foreground">Lv. {death.level}</span>
              </div>
            ))}
            <Link href="/community/deaths" className="mt-2 text-xs text-muted-foreground hover:underline">
              Ver todas →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quem está online?</CardTitle>
            <CardDescription>Jogadores conectados agora.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge>{onlineCount}</Badge>
              <span className="text-muted-foreground">jogador(es) online</span>
            </div>
            <Link href="/community/online" className="text-xs text-muted-foreground hover:underline">
              Ver lista completa →
            </Link>
          </CardContent>
        </Card>
      </section>

      {posts.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Últimas notícias</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={`/posts/${post.slug}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg">{post.title}</CardTitle>
                    <CardDescription>
                      {post.publishedAt ? dayjs(post.publishedAt).format("DD/MM/YYYY") : ""}
                    </CardDescription>
                  </CardHeader>
                  {post.excerpt && (
                    <CardContent className="text-sm text-muted-foreground">{post.excerpt}</CardContent>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
