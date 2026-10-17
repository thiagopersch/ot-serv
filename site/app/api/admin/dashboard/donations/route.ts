import { NextResponse } from "next/server";
import dayjs from "dayjs";

import { requireAdminSession } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { withAudit } from "@/lib/api-audit-wrapper";

const PERIODS = ["current_month", "last_month", "last_3_months", "last_6_months", "year", "last_year"] as const;
type Period = (typeof PERIODS)[number];

function rangeFor(period: Period) {
  const now = dayjs();
  switch (period) {
    case "last_month":
      return { start: now.subtract(1, "month").startOf("month"), end: now.subtract(1, "month").endOf("month") };
    case "last_3_months":
      return { start: now.subtract(2, "month").startOf("month"), end: now.endOf("month") };
    case "last_6_months":
      return { start: now.subtract(5, "month").startOf("month"), end: now.endOf("month") };
    case "year":
      return { start: now.startOf("year"), end: now.endOf("year") };
    case "last_year":
      return { start: now.subtract(1, "year").startOf("year"), end: now.subtract(1, "year").endOf("year") };
    case "current_month":
    default:
      return { start: now.startOf("month"), end: now.endOf("month") };
  }
}

/** Soma `amount` por dia-do-mês (1-31) — permite comparar meses/períodos de tamanhos
 * diferentes lado a lado no mesmo eixo X. */
async function sumByDayOfMonth(start: Date, end: Date) {
  const donations = await prisma.donation.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { amount: true, createdAt: true },
  });

  const totals = new Map<number, number>();
  for (const donation of donations) {
    const day = dayjs(donation.createdAt).date();
    totals.set(day, (totals.get(day) ?? 0) + Number(donation.amount));
  }
  return Array.from({ length: 31 }, (_, index) => ({ day: index + 1, total: totals.get(index + 1) ?? 0 }));
}

export const GET = withAudit(async function GET(request: Request) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period");
  const period: Period = (PERIODS as readonly string[]).includes(periodParam ?? "")
    ? (periodParam as Period)
    : "current_month";

  const currentMonthRange = rangeFor("current_month");
  const comparedRange = rangeFor(period);

  const [currentMonth, compared] = await Promise.all([
    sumByDayOfMonth(currentMonthRange.start.toDate(), currentMonthRange.end.toDate()),
    sumByDayOfMonth(comparedRange.start.toDate(), comparedRange.end.toDate()),
  ]);

  return NextResponse.json({ currentMonth, compared, period });
});
