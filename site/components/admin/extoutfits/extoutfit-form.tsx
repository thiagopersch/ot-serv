"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  EXTOUTFIT_KINDS,
  EXTOUTFIT_KIND_LABELS,
  defaultExtOutfitValues,
  extOutfitSchema,
  extOutfitValueField,
  type ExtOutfitInput,
  type ExtOutfitKind,
} from "@/lib/validations/admin/extoutfit";
import { extOutfitToXml } from "@/lib/extoutfit-xml";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberField } from "@/components/shared/number-field";
import { XmlPreviewCard } from "@/components/shared/xml-preview-card";
import { OutfitLooktypeSearchField } from "@/components/shared/outfit-looktype-search-field";
import { EntityImageUpload } from "@/components/shared/entity-image-upload";
import { useEntityImages } from "@/components/shared/use-entity-images";
import { ShaderFilesCard } from "@/components/admin/extoutfits/shader-files-card";
import { ExtOutfitPreviewButton } from "@/components/admin/extoutfits/extoutfit-preview-dialog";

type ExtOutfitFormProps = {
  /** Presente na edição — id do registro no portal. */
  extOutfitId?: number;
  initialValues?: ExtOutfitInput;
  initialLooktypeNumber?: number | null;
  /** URL da textura `u_Tex1` já enviada (shaders). */
  shaderTex1Url?: string | null;
};

export function ExtOutfitForm({ extOutfitId, initialValues, initialLooktypeNumber, shaderTex1Url }: ExtOutfitFormProps) {
  const router = useRouter();
  const isEditing = extOutfitId !== undefined;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [looktypeNumber, setLooktypeNumber] = useState<number | null>(initialLooktypeNumber ?? null);
  /** Arquivos escolhidos no cadastro novo — enviados logo após criar o registro. */
  const [pendingFiles, setPendingFiles] = useState<Partial<Record<PendingFilePart, File>>>({});

  const form = useForm<ExtOutfitInput, unknown, ExtOutfitInput>({
    resolver: zodResolver(extOutfitSchema),
    defaultValues: initialValues ?? defaultExtOutfitValues,
  });

  const values = useWatch({ control: form.control }) as ExtOutfitInput;
  const valueField = extOutfitValueField(values.kind);
  const images = useEntityImages("extoutfit", extOutfitId !== undefined ? [extOutfitId] : []);

  const previewXml = extOutfitToXml({
    kind: values.kind,
    xmlId: values.xmlId,
    name: values.name ?? "",
    looktypeNumber,
    shaderName: values.shaderName ?? "",
    image: values.image ?? "",
    posx: values.posx ?? null,
    posy: values.posy ?? null,
  });

  function pickFile(part: PendingFilePart, file: File | undefined) {
    setPendingFiles((current) => ({ ...current, [part]: file }));
    if (!file) return;
    const stem = file.name.replace(/\.[^.]+$/, "");
    // Pré-preenche o atributo do XML a partir do nome do arquivo (mesma convenção do cliente).
    if (part === "image" && (values.kind === "healthbars" || values.kind === "manabars") && !form.getValues("image")) {
      form.setValue("image", `/images/bars/${stem}`);
    }
    if (part === "fragment" && values.kind === "shaders" && !form.getValues("shaderName")) {
      form.setValue("shaderName", stem.replace(/_fragment$/i, ""));
    }
    if (!form.getValues("name")) form.setValue("name", stem.replace(/_fragment$/i, ""));
  }

  /** Envia os arquivos escolhidos no cadastro novo para o registro recém-criado. Devolve os que
   * falharam (o registro já existe — o admin reenvia na edição). */
  async function uploadPendingFiles(id: number, kind: ExtOutfitKind): Promise<string[]> {
    const failed: string[] = [];
    if (pendingFiles.image) {
      const formData = new FormData();
      formData.append("file", pendingFiles.image);
      const response = await fetch(`/api/admin/images/extoutfit/${id}`, { method: "POST", body: formData });
      if (!response.ok) failed.push(pendingFiles.image.name);
    }
    if (kind === "shaders") {
      const formData = new FormData();
      for (const part of ["fragment", "vertex", "tex1"] as const) {
        const file = pendingFiles[part];
        if (file) formData.append(part, file);
      }
      if ([...formData.keys()].length > 0) {
        const response = await fetch(`/api/admin/extoutfits/${id}/shader`, { method: "PUT", body: formData });
        if (!response.ok) failed.push("arquivos do shader");
      }
    }
    return failed;
  }

  async function onSubmit(submitted: ExtOutfitInput) {
    setIsSubmitting(true);

    const response = await fetch(isEditing ? `/api/admin/extoutfits/${extOutfitId}` : "/api/admin/extoutfits", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submitted),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setIsSubmitting(false);
      toast.error(data?.error ?? "Não foi possível salvar o registro.");
      return;
    }

    if (!isEditing && data?.extOutfit?.id) {
      const failed = await uploadPendingFiles(data.extOutfit.id, submitted.kind);
      setIsSubmitting(false);
      if (failed.length > 0) {
        toast.error(`Registro criado, mas não foi possível enviar: ${failed.join(", ")}. Reenvie na edição.`);
        router.push(`/admin/extoutfits/${data.extOutfit.id}`);
        return;
      }
    }

    setIsSubmitting(false);
    toast.success(isEditing ? "Registro atualizado." : "Registro criado.");
    router.push("/admin/extoutfits");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]"
      >
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={(value) => field.onChange(value as ExtOutfitKind)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) => EXTOUTFIT_KIND_LABELS[value as ExtOutfitKind] ?? value}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXTOUTFIT_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {EXTOUTFIT_KIND_LABELS[kind]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <NumberField control={form.control} name="xmlId" label="ID (no tipo)" min={1} />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={100} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="sm:col-span-2">
                <OutfitLooktypeSearchField
                  control={form.control}
                  name="looktypeId"
                  label={valueField === "looktype" ? "Looktype" : "Sprite de preview (opcional — não vai para o XML)"}
                  onLooktypeChange={(looktype) => setLooktypeNumber(looktype?.looktypeNumber ?? null)}
                />
              </div>

              {valueField === "shadername" && (
                <FormField
                  control={form.control}
                  name="shaderName"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>shadername (registrado via g_shaders.createOutfitShader)</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {valueField === "image" && (
                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>image (path no cliente, sem extensão)</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={255} placeholder="/images/bars/..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <NumberField
                control={form.control}
                name="posx"
                label="posx (opcional)"
                nullable
              />
              <NumberField
                control={form.control}
                name="posy"
                label="posy (opcional)"
                nullable
              />
            </CardContent>
          </Card>

          {!isEditing && (
            <Card>
              <CardHeader>
                <CardTitle>Arquivos</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Enviados junto com o cadastro e incluídos nos arquivos gerados (download por registro e pacote
                  .zip).{" "}
                  {values.kind === "healthbars" || values.kind === "manabars"
                    ? "A imagem é o arquivo da barra no cliente (PNG/APNG/GIF) — o atributo image é preenchido pelo nome do arquivo."
                    : "A imagem (PNG/APNG/GIF/.obd) é usada só no preview do portal."}
                </p>
                <PendingFileInput
                  label={values.kind === "healthbars" || values.kind === "manabars" ? "Imagem da barra" : "Imagem de preview (opcional)"}
                  accept=".png,.gif,.obd"
                  file={pendingFiles.image}
                  onChange={(file) => pickFile("image", file)}
                  showImage
                />
                {values.kind === "shaders" && (
                  <>
                    <PendingFileInput
                      label="Fragment (.frag)"
                      accept=".frag,.vert,.glsl"
                      file={pendingFiles.fragment}
                      onChange={(file) => pickFile("fragment", file)}
                    />
                    <PendingFileInput
                      label="Vertex (opcional — vazio usa outfit_default_vertex)"
                      accept=".frag,.vert,.glsl"
                      file={pendingFiles.vertex}
                      onChange={(file) => pickFile("vertex", file)}
                    />
                    <PendingFileInput
                      label="Textura u_Tex1 (opcional)"
                      accept=".png,.gif"
                      file={pendingFiles.tex1}
                      onChange={(file) => pickFile("tex1", file)}
                      showImage
                    />
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {isEditing && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Imagem de preview</CardTitle>
                <ExtOutfitPreviewButton initial={{ kind: values.kind, id: extOutfitId }} />
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  Envie uma imagem (PNG/GIF/.obd) ou vincule uma sprite do cadastro. A imagem enviada tem
                  precedência no preview; em wings/auras o looktype do XML continua o selecionado acima.
                </p>
                <EntityImageUpload
                  entityType="extoutfit"
                  id={extOutfitId}
                  name={values.name}
                  currentImage={images.get(extOutfitId) ?? null}
                  onLooktypeLinked={(looktypeId) => form.setValue("looktypeId", looktypeId)}
                />
              </CardContent>
            </Card>
          )}

          {isEditing && values.kind === "shaders" && (
            <ShaderFilesCard extOutfitId={extOutfitId} tex1Url={shaderTex1Url ?? null} />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              nativeButton={false}
              render={<Link href="/admin/extoutfits" />}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar registro"}
            </Button>
          </div>
        </div>

        <XmlPreviewCard value={previewXml} />
      </form>
    </Form>
  );
}

type PendingFilePart = "image" | "fragment" | "vertex" | "tex1";

/** Campo de arquivo do cadastro novo (o arquivo só sobe depois que o registro é criado). */
function PendingFileInput({
  label,
  accept,
  file,
  onChange,
  showImage = false,
}: {
  label: string;
  accept: string;
  file: File | undefined;
  onChange: (file: File | undefined) => void;
  showImage?: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="file"
          accept={accept}
          className="max-w-sm"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(picked && showImage && /\.(png|gif)$/i.test(picked.name) ? URL.createObjectURL(picked) : null);
            onChange(picked);
          }}
        />
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- preview local do arquivo escolhido (APNG anima)
          <img src={previewUrl} alt={file?.name ?? ""} className="h-10 rounded border" style={{ imageRendering: "pixelated" }} />
        )}
        {file && !previewUrl && <span className="text-xs text-muted-foreground">{file.name}</span>}
      </div>
    </div>
  );
}