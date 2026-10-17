"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Donut,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Table as TableIcon,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const GRID_STROKE = "var(--border)";
const AXIS_STROKE = "var(--muted-foreground)";
const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  fontSize: 12,
};

/** Ordem fixa — mesma paleta (`--chart-1..5`) usada nos gráficos de barra do
 * dashboard, aqui aplicada por fatia num pie/donut (identidade por categoria, sempre
 * na mesma ordem, nunca escolhida "à mão" por gráfico). */
const CATEGORICAL_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type TrendPoint = { label: string; contas: number; players: number };
type CategoryPoint = { label: string; total: number };
type Visualization = "bar" | "line" | "pie" | "donut" | "table";

const VISUALIZATIONS: { value: Visualization; label: string; icon: LucideIcon }[] = [
  { value: "bar", label: "Gráfico de barras", icon: BarChart3 },
  { value: "line", label: "Gráfico de linhas", icon: LineChartIcon },
  { value: "pie", label: "Gráfico de pizza", icon: PieChartIcon },
  { value: "donut", label: "Gráfico de rosca", icon: Donut },
  { value: "table", label: "Tabela", icon: TableIcon },
];

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

/** Botões de alternância bar/pie/donut/table — presentes em toda box de gráfico do
 * dashboard, cada box guarda sua própria visualização escolhida. */
function VisualizationSwitcher({ value, onChange }: { value: Visualization; onChange: (v: Visualization) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5">
      {VISUALIZATIONS.map((viz) => {
        const Icon = viz.icon;
        return (
          <Button
            key={viz.value}
            type="button"
            variant={value === viz.value ? "secondary" : "ghost"}
            size="icon-xs"
            title={viz.label}
            onClick={() => onChange(viz.value)}
          >
            <Icon className="size-3.5" />
          </Button>
        );
      })}
    </div>
  );
}

function EmptyChartState({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
      Sem dados para exibir.
    </div>
  );
}

function CategoryBarChart({
  data,
  color,
  height = 240,
  layout = "horizontal",
}: {
  data: CategoryPoint[];
  color: string;
  height?: number;
  /** "vertical" = barras deitadas (categorias no eixo Y) — melhor pra muitas
   * categorias com rótulo longo (ex.: os 18 tipos de item). */
  layout?: "horizontal" | "vertical";
}) {
  if (data.length === 0) return <EmptyChartState height={height} />;

  if (layout === "vertical") {
    // Altura acompanha a quantidade de categorias — com muitas (ex.: 18 tipos de
    // item) uma altura fixa deixa pouco espaço por barra e o Recharts passa a pular
    // rótulos pra evitar sobreposição; `interval={0}` força mostrar todos mesmo assim.
    const rowHeight = 28;
    const resolvedHeight = Math.max(height, data.length * rowHeight);

    return (
      <ResponsiveContainer width="100%" height={resolvedHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" stroke={AXIS_STROKE} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            stroke={AXIS_STROKE}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={110}
            interval={0}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="total" name="Total" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS_STROKE} fontSize={12} tickLine={false} axisLine={false} interval={0} />
        <YAxis stroke={AXIS_STROKE} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="total" name="Total" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CategoryLineChart({ data, color, height = 240 }: { data: CategoryPoint[]; color: string; height?: number }) {
  if (data.length === 0) return <EmptyChartState height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS_STROKE} fontSize={12} tickLine={false} axisLine={false} interval={0} />
        <YAxis stroke={AXIS_STROKE} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "var(--muted)" }} />
        <Line type="monotone" dataKey="total" name="Total" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Pie/donut — mesmo componente, `donut` só muda o raio interno. Identidade das
 * fatias nunca depende só da cor: legenda sempre presente + tooltip com o rótulo. */
function CategoryPieOrDonut({ data, donut }: { data: CategoryPoint[]; donut: boolean }) {
  if (data.length === 0) return <EmptyChartState height={280} />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Pie
          data={data}
          dataKey="total"
          nameKey="label"
          innerRadius={donut ? "55%" : 0}
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={2}
          stroke="var(--card)"
        >
          {data.map((entry, index) => (
            <Cell key={entry.label} fill={CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function CategoryTable({ data }: { data: CategoryPoint[] }) {
  if (data.length === 0) return <EmptyChartState height={120} />;
  const total = data.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="max-h-[320px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1.5 font-medium">Categoria</th>
            <th className="py-1.5 text-right font-medium">Total</th>
            <th className="py-1.5 text-right font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <td className="py-1.5">{row.label}</td>
              <td className="py-1.5 text-right tabular-nums">{formatNumber(row.total)}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                {total > 0 ? `${((row.total / total) * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Box de gráfico "por categoria" (1 métrica, N categorias) com os 4 botões de
 * visualização — usada pelos 5 gráficos de distribuição do dashboard. */
function CategoryChartBox({
  title,
  data,
  color,
  barLayout = "horizontal",
  barHeight = 240,
  className,
}: {
  title: string;
  data: CategoryPoint[];
  color: string;
  barLayout?: "horizontal" | "vertical";
  barHeight?: number;
  className?: string;
}) {
  const [viz, setViz] = useState<Visualization>("bar");

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <VisualizationSwitcher value={viz} onChange={setViz} />
      </CardHeader>
      <CardContent>
        {viz === "bar" && <CategoryBarChart data={data} color={color} layout={barLayout} height={barHeight} />}
        {viz === "line" && <CategoryLineChart data={data} color={color} height={barHeight} />}
        {viz === "pie" && <CategoryPieOrDonut data={data} donut={false} />}
        {viz === "donut" && <CategoryPieOrDonut data={data} donut />}
        {viz === "table" && <CategoryTable data={data} />}
      </CardContent>
    </Card>
  );
}

function TrendBarChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChartState height={280} />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS_STROKE} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS_STROKE} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="contas" name="Contas criadas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="players" name="Players criados" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TrendLineChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChartState height={280} />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS_STROKE} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS_STROKE} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "var(--muted)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="contas" name="Contas criadas" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="players" name="Players criados" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function trendTotals(data: TrendPoint[]): CategoryPoint[] {
  return [
    { label: "Contas criadas", total: data.reduce((sum, row) => sum + row.contas, 0) },
    { label: "Players criados", total: data.reduce((sum, row) => sum + row.players, 0) },
  ];
}

function TrendTable({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChartState height={120} />;

  return (
    <div className="max-h-[320px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1.5 font-medium">Dia</th>
            <th className="py-1.5 text-right font-medium">Contas criadas</th>
            <th className="py-1.5 text-right font-medium">Players criados</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <td className="py-1.5">{row.label}</td>
              <td className="py-1.5 text-right tabular-nums">{formatNumber(row.contas)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatNumber(row.players)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Box do gráfico de tendência (2 séries ao longo do tempo) — "barras" mostra barras
 * agrupadas por dia (não a área contínua, que não é uma das 4 opções pedidas); pizza
 * e rosca mostram a comparação do total acumulado de cada série no período. */
function TrendChartBox({ data }: { data: TrendPoint[] }) {
  const [viz, setViz] = useState<Visualization>("bar");

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Contas e players criados (últimos 30 dias)</CardTitle>
        <VisualizationSwitcher value={viz} onChange={setViz} />
      </CardHeader>
      <CardContent>
        {viz === "bar" && <TrendBarChart data={data} />}
        {viz === "line" && <TrendLineChart data={data} />}
        {viz === "pie" && <CategoryPieOrDonut data={trendTotals(data)} donut={false} />}
        {viz === "donut" && <CategoryPieOrDonut data={trendTotals(data)} donut />}
        {viz === "table" && <TrendTable data={data} />}
      </CardContent>
    </Card>
  );
}

export function DashboardCharts({
  createdTrend,
  accountsByGroup,
  bansByType,
  monstersByCategory,
  ticketsByStatus,
  itemsByType,
  vocationsByArchetype,
  vocationsByTypeUniverse,
  vocationsByPremium,
  vocationsByRank,
  spellsByVocation,
  npcsByType,
  tasksByCategory,
  tasksByDifficulty,
  questsByCategory,
  battlePassMissionsByType,
}: {
  createdTrend: TrendPoint[];
  accountsByGroup: CategoryPoint[];
  bansByType: CategoryPoint[];
  monstersByCategory: CategoryPoint[];
  ticketsByStatus: CategoryPoint[];
  itemsByType: CategoryPoint[];
  vocationsByArchetype: CategoryPoint[];
  vocationsByTypeUniverse: CategoryPoint[];
  vocationsByPremium: CategoryPoint[];
  vocationsByRank: CategoryPoint[];
  spellsByVocation: CategoryPoint[];
  npcsByType: CategoryPoint[];
  tasksByCategory: CategoryPoint[];
  tasksByDifficulty: CategoryPoint[];
  questsByCategory: CategoryPoint[];
  battlePassMissionsByType: CategoryPoint[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TrendChartBox data={createdTrend} />

      <CategoryChartBox title="Contas por nível de acesso" data={accountsByGroup} color="var(--chart-1)" />

      <CategoryChartBox title="Banimentos por tipo" data={bansByType} color="var(--chart-4)" />

      <CategoryChartBox title="Monstros por universo" data={monstersByCategory} color="var(--chart-2)" />

      <CategoryChartBox title="Tickets por status" data={ticketsByStatus} color="var(--chart-5)" />

      <CategoryChartBox title="Vocações por arquétipo" data={vocationsByArchetype} color="var(--chart-1)" />

      <CategoryChartBox title="Vocações por universo" data={vocationsByTypeUniverse} color="var(--chart-2)" />

      <CategoryChartBox title="Vocações por premium" data={vocationsByPremium} color="var(--chart-4)" />

      <CategoryChartBox title="Vocações por rank" data={vocationsByRank} color="var(--chart-5)" />

      <CategoryChartBox
        title="Items por tipo (slot & weapon)"
        data={itemsByType}
        color="var(--chart-3)"
        barLayout="vertical"
        barHeight={420}
        className="lg:col-span-2"
      />

      <CategoryChartBox
        title="Spells por vocação"
        data={spellsByVocation}
        color="var(--chart-1)"
        barLayout="vertical"
        barHeight={320}
        className="lg:col-span-2"
      />

      <CategoryChartBox title="NPCs por tipo" data={npcsByType} color="var(--chart-2)" />

      <CategoryChartBox title="Tasks por categoria" data={tasksByCategory} color="var(--chart-3)" />

      <CategoryChartBox title="Tasks por dificuldade" data={tasksByDifficulty} color="var(--chart-4)" />

      <CategoryChartBox title="Quests por categoria" data={questsByCategory} color="var(--chart-5)" />

      <CategoryChartBox
        title="Missões do Battle Pass vigente por tipo"
        data={battlePassMissionsByType}
        color="var(--chart-1)"
      />
    </div>
  );
}
