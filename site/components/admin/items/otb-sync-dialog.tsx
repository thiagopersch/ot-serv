"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type OtbSyncDialogProps = {
  onSynced: () => void;
};

/** Sobe o `items.otb` do servidor para preencher `clientId` (e vincular a looktype
 * correspondente) dos items que ainda não têm esses campos definidos — ver
 * `/api/admin/items/sync-client-ids`. Não reaproveita `XmlImportDialog` (aceita `.xml`, tem
 * checkbox de "substituir" sem sentido aqui e espera uma resposta `{imported,skipped,errors}`
 * diferente da deste fluxo). */
export function OtbSyncDialog({ onSynced }: OtbSyncDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSync() {
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      toast.error("Selecione o arquivo items.otb.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/items/sync-client-ids", {
      method: "POST",
      body: formData,
    });

    setIsSubmitting(false);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(data?.error ?? "Não foi possível sincronizar o arquivo.");
      return;
    }

    toast.success(
      `${data.clientIdsFilled} client id(s) preenchido(s), ${data.lookTypesLinked} looktype(s) vinculada(s)` +
        (data.otbEntriesSkipped ? `, ${data.otbEntriesSkipped} ignorado(s).` : ".")
    );

    setOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onSynced();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Upload className="size-4" />
            Sincronizar client IDs (.otb)
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sincronizar client IDs a partir do items.otb</DialogTitle>
          <DialogDescription>
            Envie o <code>items.otb</code> do servidor. Preenche o <code>clientId</code> só dos
            items que ainda não têm um definido, e vincula automaticamente a looktype
            correspondente (nome contendo o número do client id) quando o item ainda não tem
            nenhuma vinculada. Valores já preenchidos manualmente nunca são sobrescritos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otb-sync-file">Arquivo items.otb</Label>
          <Input id="otb-sync-file" type="file" accept=".otb" ref={fileInputRef} />
        </div>

        <DialogFooter>
          <Button onClick={handleSync} disabled={isSubmitting}>
            {isSubmitting ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
