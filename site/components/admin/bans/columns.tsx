"use client";

import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Pencil } from "lucide-react";

import type { Ban } from "@/lib/generated/prisma/client";
import { BAN_TYPES, PLAYER_BAN_PARAMS, uint32ToIp } from "@/lib/validations/admin/ban";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { BanFormDialog } from "@/components/admin/bans/ban-form-dialog";

export function getBanColumns(refresh: () => void, onDelete: (id: number) => void): ColumnDef<Ban>[] {
  return [
    { accessorKey: "id", header: "ID" },
    {
      accessorKey: "type",
      header: "Tipo",
      cell: ({ row }) =>
        BAN_TYPES.find((type) => type.value === row.original.type)?.label ?? row.original.type,
    },
    {
      accessorKey: "value",
      header: "Alvo",
      cell: ({ row }) => (row.original.type === 1 ? uint32ToIp(row.original.value) : row.original.value),
    },
    {
      accessorKey: "param",
      header: "Param",
      cell: ({ row }) => {
        if (row.original.type === 1) return `mask: ${row.original.param}`;
        if (row.original.type === 2) {
          return PLAYER_BAN_PARAMS.find((p) => p.value === row.original.param)?.label ?? row.original.param;
        }
        return row.original.param || "—";
      },
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "default" : "secondary"}>
          {row.original.active ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      accessorKey: "expires",
      header: "Expira em",
      cell: ({ row }) =>
        row.original.expires === 0
          ? "Permanente"
          : dayjs.unix(row.original.expires).format("DD/MM/YYYY HH:mm"),
    },
    {
      accessorKey: "added",
      header: "Criado em",
      cell: ({ row }) => dayjs.unix(row.original.added).format("DD/MM/YYYY HH:mm"),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <BanFormDialog
            ban={row.original}
            onSaved={refresh}
            trigger={
              <DropdownMenuItem>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
            }
          />
          <DeleteRowMenuItem
            title="Remover banimento"
            description="Esta ação não pode ser desfeita."
            confirmLabel="Remover"
            onConfirm={() => onDelete(row.original.id)}
          />
        </RowActionsMenu>
      ),
    },
  ];
}
