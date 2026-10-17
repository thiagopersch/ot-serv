"use client";

import Link from "next/link";
import useSWR from "swr";
import { ChevronDown } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import type { QuestEntry, QuestsData, TaskEntry, TasksData } from "../types";

const CATEGORY_LABELS: Record<string, string> = {
  dragonball: "Dragon Ball",
  bleach: "Bleach",
  general: "Geral",
};

function TaskRow({ task }: { task: TaskEntry }) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between text-sm">
        {task.postSlug ? (
          <Link href={`/posts/${task.postSlug}`} className="hover:underline">
            {task.name}
          </Link>
        ) : (
          <span>{task.name}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {task.kills}/{task.killsRequired}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-green-600 transition-all"
          style={{ width: `${task.progressPercent}%` }}
        />
      </div>
    </div>
  );
}

function QuestRow({ quest }: { quest: QuestEntry }) {
  return (
    <div className="flex gap-3 py-2">
      {quest.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem pequena, servida estática de public/storage
        <img
          src={quest.imageUrl}
          alt=""
          className="size-12 shrink-0 rounded-sm border border-border object-cover"
        />
      ) : null}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span>{quest.name}</span>
          <Badge variant={quest.completed ? "default" : "secondary"} className={quest.completed ? "bg-green-600" : ""}>
            {quest.completed ? "Concluída" : "Pendente"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{quest.description}</p>
      </div>
    </div>
  );
}

export function JourneyTab({ name }: { name: string }) {
  const { data } = useSWR<TasksData>(`/api/public/characters/${encodeURIComponent(name)}/tasks`, fetcher);
  const { data: questsData } = useSWR<QuestsData>(
    `/api/public/characters/${encodeURIComponent(name)}/quests`,
    fetcher,
  );

  const questCategories = Object.entries(questsData?.questsByCategory ?? {});
  const totalQuests = questCategories.reduce((sum, [, quests]) => sum + quests.length, 0);

  const categories = Object.entries(data?.tasksByCategory ?? {});
  const totalTasks = categories.reduce((sum, [, tasks]) => sum + tasks.length, 0);
  const completedTasks = categories.reduce(
    (sum, [, tasks]) => sum + tasks.filter((t) => t.completed).length,
    0,
  );
  const overallPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {totalTasks > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progresso geral</span>
                <span>{overallPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-green-600" style={{ width: `${overallPercent}%` }} />
              </div>
            </div>
          )}

          {totalTasks === 0 && <p className="text-sm text-muted-foreground">Nenhuma task iniciada.</p>}

          {categories.map(([category, tasks]) => (
            <Collapsible key={category} defaultOpen={false}>
              <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium">
                {CATEGORY_LABELS[category] ?? category} ({tasks.length})
                <ChevronDown className="size-4 transition-transform group-data-open:rotate-180" />
              </CollapsibleTrigger>
              <CollapsiblePanel>
                <div className="flex flex-col divide-y">
                  {tasks.map((task) => (
                    <TaskRow key={task.taskId} task={task} />
                  ))}
                </div>
              </CollapsiblePanel>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quests</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {totalQuests === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma quest disponível para o level atual.</p>
          )}

          {questCategories.map(([category, quests]) => (
            <Collapsible key={category} defaultOpen={false}>
              <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium">
                {CATEGORY_LABELS[category] ?? category} ({quests.length})
                <ChevronDown className="size-4 transition-transform group-data-open:rotate-180" />
              </CollapsibleTrigger>
              <CollapsiblePanel>
                <div className="flex flex-col divide-y">
                  {quests.map((quest) => (
                    <QuestRow key={quest.id} quest={quest} />
                  ))}
                </div>
              </CollapsiblePanel>
            </Collapsible>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
