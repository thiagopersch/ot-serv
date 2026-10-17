"use client";

import type { ReactNode } from "react";
import dayjs from "dayjs";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JsonCodeViewer } from "@/components/shared/json-code-viewer";

export type AuditLogDetailsRow = {
  id: number;
  accountId: number | null;
  accountName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  requestBody: unknown;
  responseBody: unknown;
  statusCode: number | null;
  errorMessage: string | null;
  durationMs: number | null;
  method: string | null;
  route: string | null;
  pageName: string | null;
  area: string | null;
  ipAddress: string | null;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (isRecord(value)) return Object.keys(value).length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function statusVariant(status: number | null): "secondary" | "default" | "destructive" {
  if (status === null) return "secondary";
  if (status >= 500) return "destructive";
  if (status >= 400) return "destructive";
  return "default";
}

function areaLabel(area: string | null): string {
  if (area === "public") return "Área pública";
  if (area === "admin") return "Área administrativa";
  return "—";
}

/**
 * Se o log representa uma falha — erro explícito (`errorMessage`), status HTTP >= 400, ou uma
 * ação de import que não deu certo (`import_skip`/`import_error`). Usado tanto na coluna
 * "Resultado" da listagem quanto no badge do diálogo de detalhes.
 */
export function isAuditLogError(row: Pick<AuditLogDetailsRow, "action" | "statusCode" | "errorMessage">): boolean {
  if (row.errorMessage) return true;
  if (row.statusCode != null && row.statusCode >= 400) return true;
  return (
    row.action === "import_skip" ||
    row.action === "import_error" ||
    row.action === "import_summary" ||
    row.action === "error"
  );
}

/**
 * Import de looktype ignorada (nome/número duplicado, action "import_skip") ou que falhou na
 * validação/parse (action "import_error") — `POST /api/admin/looktypes`, ver
 * `LooktypeCreateDialog`. Os campos são fixos nos dois casos, então mostramos um layout
 * dedicado em vez do JSON cru.
 */
function ImportSkipDetails({ metadata }: { metadata: Record<string, unknown> }) {
  const rows: [string, unknown][] = [
    ["Arquivo", metadata.fileName],
    ["Nome", metadata.name],
    ["Número", metadata.looktypeNumber],
    ["Categoria", metadata.category],
    ["Sessão de import", metadata.batchId],
  ].filter((row): row is [string, unknown] => row[1] !== undefined);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
        {formatValue(metadata.reason)}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-all">{formatValue(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function formatNameList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "—";
  return value.join(", ");
}

/**
 * Resumo de um lote de import de looktypes (action "import_summary", ver
 * `POST /api/admin/looktypes/import-summary` e `LooktypeCreateDialog`) — mesma contagem e listas
 * de arquivo mostradas no toast ao final do import, só que persistidas em auditoria.
 */
function ImportSummaryDetails({ metadata }: { metadata: Record<string, unknown> }) {
  const rows: [string, unknown][] = [
    ["Categoria", metadata.category],
    ["Criados", metadata.createdCount],
    ["Ignorados (nome/número duplicado)", metadata.duplicateCount],
    ["Falharam", metadata.errorCount],
    ["Sessão de import", metadata.batchId],
  ];

  return (
    <div className="flex flex-col gap-3 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-all">{formatValue(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider">
          Arquivos ignorados (duplicados)
        </p>
        <p className="break-words">{formatNameList(metadata.duplicateFileNames)}</p>
      </div>
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider">Arquivos com falha</p>
        <p className="break-words">{formatNameList(metadata.errorFileNames)}</p>
      </div>
    </div>
  );
}

function ScalarField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all">{children}</dd>
    </div>
  );
}

export function AuditLogDetailsDialog(row: AuditLogDetailsRow) {
  const {
    id,
    accountId,
    accountName,
    action,
    entity,
    entityId,
    metadata,
    requestBody,
    responseBody,
    statusCode,
    errorMessage,
    durationMs,
    method,
    route,
    pageName,
    area,
    ipAddress,
    createdAt,
  } = row;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            Detalhes
          </Button>
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>
              {action} · {entity}
            </span>
            <Badge variant={isAuditLogError(row) ? "destructive" : "default"}>
              {isAuditLogError(row) ? "Erro" : "Sucesso"}
            </Badge>
            {statusCode !== null && <Badge variant={statusVariant(statusCode)}>{statusCode}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <ScalarField label="Data/Hora">
              {dayjs(createdAt).format("DD/MM/YYYY HH:mm:ss")}
            </ScalarField>
            <ScalarField label="Conta">
              {formatValue(accountName ?? (accountId != null ? `#${accountId}` : null))}
            </ScalarField>
            <ScalarField label="Registro">{formatValue(entityId)}</ScalarField>
            <ScalarField label="Página">{formatValue(pageName)}</ScalarField>
            <ScalarField label="Rota">{formatValue(route)}</ScalarField>
            <ScalarField label="Método">{formatValue(method)}</ScalarField>
            <ScalarField label="Localização">{areaLabel(area)}</ScalarField>
            <ScalarField label="Duração">
              {durationMs != null ? `${durationMs} ms` : "—"}
            </ScalarField>
            <ScalarField label="IP">{formatValue(ipAddress)}</ScalarField>
            <ScalarField label="ID do log">{id}</ScalarField>
          </dl>

          {errorMessage && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider">Motivo do erro</p>
              <p className="break-words">{errorMessage}</p>
            </div>
          )}

          {(action === "import_skip" || action === "import_error") && isRecord(metadata) ? (
            <ImportSkipDetails metadata={metadata} />
          ) : action === "import_summary" && isRecord(metadata) ? (
            <ImportSummaryDetails metadata={metadata} />
          ) : (
            hasContent(metadata) && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Metadata
                </p>
                <JsonCodeViewer value={metadata} maxHeight="30vh" />
              </div>
            )
          )}

          {hasContent(requestBody) && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Request
              </p>
              <JsonCodeViewer value={requestBody} maxHeight="30vh" />
            </div>
          )}

          {hasContent(responseBody) && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Response
              </p>
              <JsonCodeViewer value={responseBody} maxHeight="30vh" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
