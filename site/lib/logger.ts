import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

type LogLevel = "info" | "warn" | "error";

async function log(level: LogLevel, message: string, context?: Prisma.InputJsonValue) {
  const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  method(`[${level}] ${message}`, context ?? "");

  try {
    await prisma.appLog.create({ data: { level, message, context } });
  } catch {
    // Nunca deixar a falha de logging derrubar a requisição.
  }
}

export const logger = {
  info: (message: string, context?: Prisma.InputJsonValue) => log("info", message, context),
  warn: (message: string, context?: Prisma.InputJsonValue) => log("warn", message, context),
  error: (message: string, context?: Prisma.InputJsonValue) => log("error", message, context),
};
