import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { auditContextStorage, type AuditRequestContext } from "@/lib/audit-context";
import { getPageNameForRoute } from "@/lib/audit-route-labels";

type RouteHandler = (request: Request, routeContext: never) => Response | Promise<Response>;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function extractIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

async function readJsonSafely(input: Request | Response): Promise<unknown> {
  try {
    const text = await input.clone().text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function jsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
  return value === null || value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

/**
 * Envolve um handler de rota de API para capturar automaticamente request/response/status/
 * duração/erro de auditoria, sem exigir mudança nas chamadas a `logAudit()` já existentes
 * dentro do handler (elas herdam esse contexto via AsyncLocalStorage). Se o handler não
 * chamar `logAudit()` mas a resposta for de erro (ou lançar exceção), este wrapper cria uma
 * linha de auditoria própria para que a falha não passe em branco.
 */
export function withAudit<H extends RouteHandler>(handler: H): H {
  const wrapped = async (request: Request, routeContext: never) => {
    const startedAt = Date.now();
    const url = new URL(request.url);
    const route = url.pathname;
    const area: "admin" | "public" = route.startsWith("/api/admin") ? "admin" : "public";
    const pageName = getPageNameForRoute(route);
    const ipAddress = extractIp(request);
    const method = request.method;

    let accountId: number | null = null;
    let accountName: string | null = null;
    try {
      const session = await auth();
      if (session?.user?.id) accountId = Number(session.user.id);
      accountName = session?.user?.name ?? null;
    } catch {
      accountId = null;
      accountName = null;
    }

    const requestBody = MUTATING_METHODS.has(method) ? await readJsonSafely(request) : null;

    const context: AuditRequestContext = {
      accountId,
      accountName,
      ipAddress,
      method,
      route,
      pageName,
      area,
      requestBody,
      startedAt,
      createdLogIds: [],
    };

    return auditContextStorage.run(context, async () => {
      let response: Response | null = null;
      let caughtError: unknown = null;

      try {
        response = await handler(request, routeContext);
      } catch (error) {
        caughtError = error;
      }

      const durationMs = Date.now() - startedAt;
      const statusCode = response?.status ?? 500;
      const responseBody = response ? await readJsonSafely(response) : null;

      let errorMessage: string | null = null;
      if (caughtError) {
        errorMessage = caughtError instanceof Error ? caughtError.message : String(caughtError);
      } else if (statusCode >= 400 && responseBody && typeof responseBody === "object") {
        const maybeError = (responseBody as Record<string, unknown>).error;
        if (typeof maybeError === "string") errorMessage = maybeError;
      }

      if (context.createdLogIds.length > 0) {
        await prisma.auditLog.updateMany({
          where: { id: { in: context.createdLogIds } },
          data: {
            statusCode,
            durationMs,
            responseBody: jsonOrUndefined(responseBody),
            errorMessage,
          },
        });
      } else if (method !== "GET" && (statusCode >= 400 || caughtError)) {
        const entity = route.replace(/^\/api\/admin\/?/, "").split("/")[0] || "unknown";
        await prisma.auditLog.create({
          data: {
            accountId,
            accountName,
            action: "error",
            entity,
            requestBody: jsonOrUndefined(requestBody),
            responseBody: jsonOrUndefined(responseBody),
            statusCode,
            errorMessage,
            durationMs,
            method,
            route,
            pageName,
            area,
            ipAddress,
          },
        });
      }

      if (caughtError) throw caughtError;
      return response ?? NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
    });
  };

  return wrapped as H;
}
