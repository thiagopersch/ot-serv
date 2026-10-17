"use client";

import { useRef, useState } from "react";
import { Download, PackageOpen } from "lucide-react";
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

type ImportResult = { imported: number; skipped: number; errors: string[] };

async function downloadFile(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar ${filename}`);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function importOne(endpoint: string, file: File, replaceExisting: boolean): Promise<ImportResult | null> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("replaceExisting", String(replaceExisting));

  const response = await fetch(endpoint, { method: "POST", body: formData });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    toast.error(data?.error ?? `Não foi possível importar ${file.name}.`);
    return null;
  }

  return data as ImportResult;
}

/**
 * Painel de import/export conjunto de `items.xml` + `movements.xml` — complementa (não
 * substitui) os diálogos individuais já existentes em `/admin/items` e `/admin/movements`.
 * Sem dependência de zip: exporta disparando dois downloads sequenciais via Blob, e importa
 * chamando os dois endpoints de import em sequência, mostrando os dois resultados separados.
 */
export function XmlBundlePanel({ onImported }: { onImported?: () => void }) {
  const [isExporting, setIsExporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [itemsResult, setItemsResult] = useState<ImportResult | null>(null);
  const [movementsResult, setMovementsResult] = useState<ImportResult | null>(null);
  const itemsFileRef = useRef<HTMLInputElement>(null);
  const movementsFileRef = useRef<HTMLInputElement>(null);

  async function handleExportBundle() {
    setIsExporting(true);
    try {
      await downloadFile("/api/admin/items/export", "items.xml");
      // Pequeno intervalo entre os dois cliques — alguns navegadores tratam downloads
      // disparados em sequência imediata como popup e bloqueiam o segundo.
      await wait(300);
      await downloadFile("/api/admin/movements/export", "movements.xml");
      toast.success("items.xml e movements.xml baixados.");
    } catch {
      toast.error("Não foi possível baixar um dos arquivos.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportBundle() {
    const itemsFile = itemsFileRef.current?.files?.[0];
    const movementsFile = movementsFileRef.current?.files?.[0];

    if (!itemsFile) {
      toast.error("Selecione o arquivo items.xml.");
      return;
    }

    setIsImporting(true);
    setItemsResult(null);
    setMovementsResult(null);

    const itemsRes = await importOne("/api/admin/items/import", itemsFile, replaceExisting);
    setItemsResult(itemsRes);

    if (movementsFile) {
      const movementsRes = await importOne("/api/admin/movements/import", movementsFile, replaceExisting);
      setMovementsResult(movementsRes);
    }

    setIsImporting(false);

    if (itemsRes) {
      toast.success("Importação em conjunto concluída — confira o resumo no diálogo.");
      onImported?.();
    }
  }

  return (
    <>
      <Button variant="outline" onClick={handleExportBundle} disabled={isExporting}>
        <Download className="size-4" />
        {isExporting ? "Baixando..." : "Exportar items.xml + movements.xml"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="outline">
              <PackageOpen className="size-4" />
              Importar em conjunto
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar items.xml + movements.xml</DialogTitle>
            <DialogDescription>
              O <code>items.xml</code> é obrigatório. O <code>movements.xml</code> é opcional — se
              não for enviado, só os items são importados.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bundle-items-file">items.xml</Label>
              <Input id="bundle-items-file" type="file" accept=".xml" ref={itemsFileRef} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bundle-movements-file">movements.xml (opcional)</Label>
              <Input id="bundle-movements-file" type="file" accept=".xml" ref={movementsFileRef} />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="bundle-replace"
                type="checkbox"
                className="size-4"
                checked={replaceExisting}
                onChange={(event) => setReplaceExisting(event.target.checked)}
              />
              <Label htmlFor="bundle-replace" className="font-normal">
                Substituir todos os registros existentes antes de importar (aplica-se aos dois)
              </Label>
            </div>

            {itemsResult && (
              <p className="text-sm">
                <strong>Items:</strong> {itemsResult.imported} importado(s)
                {itemsResult.skipped ? `, ${itemsResult.skipped} ignorado(s)` : ""}.
              </p>
            )}
            {movementsResult && (
              <p className="text-sm">
                <strong>Movements:</strong> {movementsResult.imported} importado(s)
                {movementsResult.skipped ? `, ${movementsResult.skipped} ignorado(s)` : ""}.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleImportBundle} disabled={isImporting}>
              {isImporting ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
