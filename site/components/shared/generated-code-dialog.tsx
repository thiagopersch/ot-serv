"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { XmlCodeViewer } from "@/components/shared/xml-code-viewer";
import { LuaCodeEditor } from "@/components/shared/lua-code-editor";
import { GlslCodeViewer } from "@/components/shared/glsl-code-viewer";

/** Uma seção do dialog. `image`: arquivo binário (ex.: APNG da barra) — `url` serve o preview e
 * `downloadUrl` o arquivo original (bytes intactos); os demais são texto. */
export type GeneratedCodeSection =
  | { title: string; filename: string; language: "xml" | "lua" | "glsl"; text: string }
  | { title: string; filename: string; language: "image"; url: string; downloadUrl: string };

type GeneratedCodeDialogProps = {
  trigger: React.ReactElement;
  title: string;
  description?: React.ReactNode;
  /** Chamado ao abrir o diálogo — busca o(s) arquivo(s) gerado(s) na hora (seleção atual). */
  load: () => Promise<GeneratedCodeSection[]>;
  /** Ações extras no topo do conteúdo (ex.: "Baixar pacote .zip"). */
  actions?: React.ReactNode;
};

/** Salva um texto já gerado como arquivo, sem nova ida ao servidor. */
export function downloadText(text: string, filename: string, mimeType = "application/xml") {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

/** Diálogo "Gerar arquivo": pré-visualiza o(s) arquivo(s) gerado(s) com botões de copiar e
 * baixar por seção (ex.: outfits.xml, ou Lua + trecho do actions.xml). */
export function GeneratedCodeDialog({ trigger, title, description, load, actions }: GeneratedCodeDialogProps) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<GeneratedCodeSection[] | null>(null);

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;

    setSections(null);
    try {
      setSections(await load());
    } catch {
      toast.error("Não foi possível gerar o arquivo.");
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {sections === null ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            {sections.map((section) => (
              <div key={section.filename} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{section.title}</p>
                  <div className="flex gap-2">
                    {section.language === "image" ? (
                      <Button
                        type="button"
                        variant="outline"
                        nativeButton={false}
                        render={<a href={section.downloadUrl} download={section.filename} />}
                      >
                        <Download className="size-4" />
                        Baixar {section.filename}
                      </Button>
                    ) : (
                      <>
                        <CopyXmlButton label="Copiar" getText={() => section.text} />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            downloadText(
                              section.text,
                              section.filename,
                              section.language === "lua"
                                ? "text/x-lua"
                                : section.language === "glsl"
                                  ? "text/plain"
                                  : "application/xml",
                            )
                          }
                        >
                          <Download className="size-4" />
                          Baixar {section.filename}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {section.language === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- preview do arquivo original (APNG anima no <img>)
                  <img
                    src={section.url}
                    alt={section.filename}
                    className="max-h-48 self-start rounded-md border bg-muted/40 object-contain p-2"
                    style={{ imageRendering: "pixelated", minWidth: 96 }}
                  />
                ) : section.language === "lua" ? (
                  <LuaCodeEditor value={section.text} onChange={() => {}} readOnly minHeight="200px" />
                ) : section.language === "glsl" ? (
                  <GlslCodeViewer value={section.text} maxHeight="50vh" />
                ) : (
                  <XmlCodeViewer value={section.text} maxHeight="50vh" />
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
