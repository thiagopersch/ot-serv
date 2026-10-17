"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { c as cLike } from "@codemirror/legacy-modes/mode/clike";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { Download, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";

const glslLanguage = StreamLanguage.define(cLike);

const textFetcher = (url: string) => fetch(url).then((response) => (response.ok ? response.text() : null));

type ShaderFilesCardProps = {
  extOutfitId: number;
  tex1Url: string | null;
  onChanged?: () => void;
};

type Part = "fragment" | "vertex";

/** Arquivos do shader guardados no portal: fragment (`.frag`), vertex opcional e textura `u_Tex1`
 * — upload, visualização (GLSL), copiar, baixar e remover. */
export function ShaderFilesCard({ extOutfitId, tex1Url, onChanged }: ShaderFilesCardProps) {
  const [version, setVersion] = useState(0);
  const [currentTex1Url, setCurrentTex1Url] = useState(tex1Url);
  const fragmentInput = useRef<HTMLInputElement>(null);
  const vertexInput = useRef<HTMLInputElement>(null);
  const tex1Input = useRef<HTMLInputElement>(null);

  const sourceUrl = (part: Part) => `/api/admin/extoutfits/${extOutfitId}/shader?part=${part}&inline=1&v=${version}`;
  const { data: fragment } = useSWR<string | null>(sourceUrl("fragment"), textFetcher);
  const { data: vertex } = useSWR<string | null>(sourceUrl("vertex"), textFetcher);

  async function upload(field: "fragment" | "vertex" | "tex1", file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.append(field, file);
    const response = await fetch(`/api/admin/extoutfits/${extOutfitId}/shader`, { method: "PUT", body: formData });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(data?.error ?? "Não foi possível enviar o arquivo.");
      return;
    }
    toast.success("Arquivo enviado.");
    if (field === "tex1") setCurrentTex1Url(`${URL.createObjectURL(file)}`);
    setVersion((value) => value + 1);
    onChanged?.();
  }

  async function remove(part: Part | "tex1") {
    const response = await fetch(`/api/admin/extoutfits/${extOutfitId}/shader?part=${part}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover.");
      return;
    }
    if (part === "tex1") setCurrentTex1Url(null);
    setVersion((value) => value + 1);
    onChanged?.();
  }

  function renderPart(part: Part, source: string | null | undefined, input: React.RefObject<HTMLInputElement | null>) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {part === "fragment" ? "Fragment (.frag)" : "Vertex (opcional — vazio usa outfit_default_vertex)"}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept=".frag,.vert,.glsl"
              className="hidden"
              onChange={(event) => {
                void upload(part, event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
              <Upload className="size-4" />
              {source ? "Substituir" : "Enviar"}
            </Button>
            {source && (
              <>
                <CopyXmlButton label="Copiar" getText={() => source} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <a href={`/api/admin/extoutfits/${extOutfitId}/shader?part=${part}`} />
                  }
                >
                  <Download className="size-4" />
                  Baixar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(part)}>
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        {source ? (
          <div className="overflow-hidden rounded-md border border-input">
            <CodeMirror
              value={source}
              theme={vscodeDark}
              extensions={[glslLanguage, EditorView.lineWrapping]}
              editable={false}
              style={{ fontSize: 12 }}
              maxHeight="320px"
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum arquivo enviado.</p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arquivos do shader</CardTitle>
        <CardDescription>
          Guardados no portal para preview e download — o cliente continua lendo de{" "}
          <code>cliente/data/shaders</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {renderPart("fragment", fragment, fragmentInput)}
        {renderPart("vertex", vertex, vertexInput)}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium">Textura u_Tex1 (opcional)</p>
          {currentTex1Url && (
            // eslint-disable-next-line @next/next/no-img-element -- preview pequeno da textura enviada
            <img src={currentTex1Url} alt="u_Tex1" className="h-10 rounded border" />
          )}
          <input
            ref={tex1Input}
            type="file"
            accept=".png,.gif"
            className="hidden"
            onChange={(event) => {
              void upload("tex1", event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => tex1Input.current?.click()}>
            <Upload className="size-4" />
            {currentTex1Url ? "Substituir" : "Enviar"}
          </Button>
          {currentTex1Url && (
            <Button type="button" variant="ghost" size="sm" onClick={() => remove("tex1")}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
