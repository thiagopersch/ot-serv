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

/** Import de um ou mais arquivos XML de NPC de uma vez — mesmo padrão do import de
 * monstros (`MonsterXmlImportDialog`): um único `<npc>` por arquivo. */
export function NpcXmlImportDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    const files = fileInputRef.current?.files;

    if (!files || files.length === 0) {
      toast.error("Selecione ao menos um arquivo XML.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    formData.append("replaceExisting", String(replaceExisting));

    const response = await fetch("/api/admin/npcs/import", {
      method: "POST",
      body: formData,
    });

    setIsSubmitting(false);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(data?.error ?? "Não foi possível importar os arquivos.");
      return;
    }

    toast.success(
      `${data.imported} NPC(s) importado(s)${data.skipped ? `, ${data.skipped} ignorado(s)` : ""}.`,
    );

    if (data.errors?.length) {
      console.warn("NPCs ignorados na importação:", data.errors);
    }

    setOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onImported();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Upload className="size-4" />
            Importar NPC (XML)
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar NPCs</DialogTitle>
          <DialogDescription>
            Envie um ou mais arquivos no formato <code>data/npc/*.xml</code> do
            OTServer (um único <code>{"<npc>"}</code> por arquivo) — todos são
            importados de uma vez. A sprite vinculada e a posição não vêm do
            XML; ajuste-as manualmente depois, editando cada NPC.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="npc-import-files">Arquivo(s) XML</Label>
            <Input
              id="npc-import-files"
              type="file"
              accept=".xml"
              multiple
              ref={fileInputRef}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="npc-import-replace"
              type="checkbox"
              className="size-4"
              checked={replaceExisting}
              onChange={(event) => setReplaceExisting(event.target.checked)}
            />
            <Label htmlFor="npc-import-replace" className="font-normal">
              Atualizar cadastro se já existir um NPC com esse nome
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleImport} disabled={isSubmitting}>
            {isSubmitting ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
