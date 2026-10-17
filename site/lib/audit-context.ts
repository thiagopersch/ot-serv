import { AsyncLocalStorage } from "node:async_hooks";

export type AuditRequestContext = {
  accountId: number | null;
  accountName: string | null;
  ipAddress: string | null;
  method: string;
  route: string;
  pageName: string;
  area: "admin" | "public";
  requestBody: unknown;
  startedAt: number;
  createdLogIds: number[];
};

export const auditContextStorage = new AsyncLocalStorage<AuditRequestContext>();

export function getAuditContext(): AuditRequestContext | undefined {
  return auditContextStorage.getStore();
}
