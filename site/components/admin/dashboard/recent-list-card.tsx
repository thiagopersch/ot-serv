import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type RecentListItem = {
  key: string | number;
  primary: ReactNode;
  secondary?: ReactNode;
  meta?: ReactNode;
};

export function RecentListCard({
  title,
  items,
  emptyLabel = "Nenhum registro encontrado.",
}: {
  title: string;
  items: RecentListItem[];
  emptyLabel?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{item.primary}</span>
                  {item.secondary && (
                    <span className="truncate text-xs text-muted-foreground">{item.secondary}</span>
                  )}
                </div>
                {item.meta && <span className="shrink-0 text-xs text-muted-foreground">{item.meta}</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
