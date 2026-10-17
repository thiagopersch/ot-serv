import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getAuditContext } from "@/lib/audit-context";

type LogAuditParams = {
  accountId?: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

export async function logAudit({
  accountId,
  action,
  entity,
  entityId = null,
  metadata,
  ipAddress,
}: LogAuditParams) {
  const context = getAuditContext();

  const log = await prisma.auditLog.create({
    data: {
      accountId: accountId ?? context?.accountId ?? null,
      accountName: context?.accountName ?? null,
      action,
      entity,
      entityId: entityId != null ? String(entityId) : null,
      metadata,
      ipAddress: ipAddress ?? context?.ipAddress ?? null,
      method: context?.method ?? null,
      route: context?.route ?? null,
      pageName: context?.pageName ?? null,
      area: context?.area ?? null,
      requestBody: (context?.requestBody as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });

  context?.createdLogIds.push(log.id);
}
