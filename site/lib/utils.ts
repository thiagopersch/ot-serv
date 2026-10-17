import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formata um inteiro (número ou string, para suportar valores acima de
 * Number.MAX_SAFE_INTEGER vindos de BigInt) com ponto separando milhares,
 * ex.: "1909177492" -> "1.909.177.492". */
export function formatThousands(value: number | string): string {
  const negative = typeof value === "string" ? value.trim().startsWith("-") : value < 0;
  const digits = value.toString().replace("-", "");
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return negative ? `-${formatted}` : formatted;
}
