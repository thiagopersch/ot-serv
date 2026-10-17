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

type XmlImportDialogProps = {
  endpoint: string;
  title: string;
  description: React.ReactNode;
  replaceLabel: string;
  itemLabel: string;
  onImported: () => void;
  /** Mensagem de sucesso customizada a partir da resposta da rota (default: "N importado(s)"). */
  formatSuccess?: (data: { imported: number; skipped?: number } & Record<string, unknown>) => string;
};

export function XmlImportDialog({
  endpoint,
  title,
  description,
  replaceLabel,
  itemLabel,
  onImported,
  formatSuccess,
}: XmlImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      toast.error("Selecione um arquivo XML.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("replaceExisting", String(replaceExisting));

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    setIsSubmitting(false);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(data?.error ?? "Não foi possível importar o arquivo.");
      return;
    }

    toast.success(
      formatSuccess
        ? formatSuccess(data)
        : `${data.imported} ${itemLabel} importado(s)${data.skipped ? `, ${data.skipped} ignorado(s)` : ""}.`
    );

    if (data.errors?.length) {
      console.warn("Brushes ignorados na importação:", data.errors);
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
            Importar XML
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="xml-import-file">Arquivo XML</Label>
            <Input id="xml-import-file" type="file" accept=".xml" ref={fileInputRef} />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="xml-import-replace"
              type="checkbox"
              className="size-4"
              checked={replaceExisting}
              onChange={(event) => setReplaceExisting(event.target.checked)}
            />
            <Label htmlFor="xml-import-replace" className="font-normal">
              {replaceLabel}
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
