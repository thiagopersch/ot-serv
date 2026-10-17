import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: ReactNode;
  description?: string;
  trend?: { delta: number; percent: number };
};

export function StatCard({ title, value, description, trend }: StatCardProps) {
  const isPositive = trend != null && trend.delta >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold">{value}</span>
          {trend && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              )}
            >
              {isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {isPositive ? "+" : ""}
              {trend.delta} ({isPositive ? "+" : ""}
              {trend.percent.toFixed(1)}%)
            </span>
          )}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardContent>
    </Card>
  );
}
