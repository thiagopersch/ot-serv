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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TilesetImportDialogProps = {
  onImported: () => void;
};

/** Variante de `XmlImportDialog` específica para tilesets: aceita XML (formato nativo
 * do RME) ou JSON (export próprio do portal), além do XML importa por substituir
 * tilesets já existentes (por nome) em vez de só pular duplicados. */
export function TilesetImportDialog({ onImported }: TilesetImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [format, setFormat] = useState<"xml" | "json">("xml");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      toast.error("Selecione um arquivo.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", format);
    formData.append("replaceExisting", String(replaceExisting));

    const response = await fetch("/api/admin/tilesets/import", {
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
      `${data.imported} tileset(s) importado(s)${data.skipped ? `, ${data.skipped} ignorado(s) (já existiam)` : ""}${
        data.unresolvedBrushNames?.length ? `, ${data.unresolvedBrushNames.length} brush(es) não encontrado(s)` : ""
      }.`
    );

    if (data.unresolvedBrushNames?.length) {
      console.warn("Brushes não resolvidos na importação:", data.unresolvedBrushNames);
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
            Importar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar tilesets</DialogTitle>
          <DialogDescription>
            Envie um <code>tilesets.xml</code> do RME ou um JSON exportado por este portal.
            Tilesets com nomes duplicados são ignorados, a menos que você marque
            &quot;substituir&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tileset-import-format">Formato</Label>
            <Select value={format} onValueChange={(value) => value && setFormat(value as "xml" | "json")}>
              <SelectTrigger id="tileset-import-format" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xml">XML (tilesets.xml)</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tileset-import-file">Arquivo</Label>
            <Input id="tileset-import-file" type="file" accept={format === "xml" ? ".xml" : ".json"} ref={fileInputRef} />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="tileset-import-replace"
              type="checkbox"
              className="size-4"
              checked={replaceExisting}
              onChange={(event) => setReplaceExisting(event.target.checked)}
            />
            <Label htmlFor="tileset-import-replace" className="font-normal">
              Substituir tilesets existentes com o mesmo nome (recria as categorias)
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
