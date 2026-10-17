"use client";

import { useState } from "react";
import useSWR from "swr";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

import { fetcher } from "@/lib/fetcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PERIOD_OPTIONS = [
  { value: "current_month", label: "Mês atual" },
  { value: "last_month", label: "Mês passado" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "year", label: "Ano todo" },
  { value: "last_year", label: "Ano passado" },
] as const;

type DonationsResponse = {
  currentMonth: { day: number; total: number }[];
  compared: { day: number; total: number }[];
  period: string;
};

const GRID_STROKE = "var(--border)";
const AXIS_STROKE = "var(--muted-foreground)";
const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  fontSize: 12,
};

/** Doações recebidas — total do mês atual (padrão) comparado com o período escolhido no
 * filtro, alinhados por dia-do-mês (1-31) num gráfico de linha só. */
export function DonationsChartCard() {
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["value"]>("current_month");

  const { data } = useSWR<DonationsResponse>(`/api/admin/dashboard/donations?period=${period}`, fetcher);

  const currentMonthTotal = data?.currentMonth.reduce((sum, row) => sum + row.total, 0) ?? 0;
  const comparedTotal = data?.compared.reduce((sum, row) => sum + row.total, 0) ?? 0;

  const chartData = Array.from({ length: 31 }, (_, index) => ({
    day: index + 1,
    "Mês atual": data?.currentMonth[index]?.total ?? 0,
    Comparado: data?.compared[index]?.total ?? 0,
  }));

  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "";

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Doações recebidas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Mês atual: R$ {currentMonthTotal.toFixed(2)} · {periodLabel}: R$ {comparedTotal.toFixed(2)}
          </p>
        </div>
        <Select value={period} onValueChange={(value) => setPeriod(value as typeof period)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="day" stroke={AXIS_STROKE} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={AXIS_STROKE} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "var(--muted)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Mês atual" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Comparado" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
