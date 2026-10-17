"use client";

import { useState, type ReactNode } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

type RowActionsMenuProps = {
  children: ReactNode;
};

/** Menu "3 pontinhos" para a coluna de ações das tabelas de admin — substitui a fileira de
 * botões individuais por um dropdown, mantendo Editar como primeiro item e Excluir por último. */
export function RowActionsMenu({ children }: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Ações">
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" keepMounted className="w-auto min-w-40 whitespace-nowrap **:data-[slot=dropdown-menu-item]:cursor-pointer">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type DeleteRowMenuItemProps = {
  label?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

/** Item "Excluir" do menu de ações — fundo, ícone e texto vermelhos sempre visíveis (não só no
 * hover), abrindo o `ConfirmDialog` de confirmação já usado no resto do projeto. */
export function DeleteRowMenuItem({
  label = "Excluir",
  title,
  description,
  confirmLabel,
  onConfirm,
}: DeleteRowMenuItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenuItem
        className="bg-destructive/10 text-destructive focus:bg-destructive/20 focus:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4 text-destructive" />
        {label}
      </DropdownMenuItem>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        onConfirm={onConfirm}
      />
    </>
  );
}
