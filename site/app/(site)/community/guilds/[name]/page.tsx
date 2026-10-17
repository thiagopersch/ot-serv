"use client";

import { use } from "react";
import Link from "next/link";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type GuildMember = {
  id: number;
  name: string;
  level: number;
  rankName: string;
  online: number;
};

type GuildDetail = {
  id: number;
  name: string;
  motd: string;
  owner: string;
  members: GuildMember[];
};

export default function GuildDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const { data, isLoading } = useSWR<{ guild: GuildDetail }>(
    `/api/public/guilds/${encodeURIComponent(name)}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-12">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 w-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data?.guild) {
    return <p className="mx-auto max-w-4xl px-4 py-12 text-muted-foreground">Guild não encontrada.</p>;
  }

  const { guild } = data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{guild.name}</CardTitle>
          <CardDescription>
            Líder: {guild.owner} · {guild.members.length} membro(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {guild.motd && <p className="text-sm italic text-muted-foreground">&ldquo;{guild.motd}&rdquo;</p>}

          <div className="flex flex-col gap-2">
            {guild.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <Link
                  href={`/community/characters/${encodeURIComponent(member.name)}`}
                  className="hover:underline"
                >
                  {member.name}
                </Link>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{member.rankName}</span>
                  <span>Lv. {member.level}</span>
                  <Badge variant={member.online ? "default" : "secondary"}>
                    {member.online ? "Online" : "Offline"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
