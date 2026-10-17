"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { JSONContent } from "@tiptap/react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { Loader2, Check, Eye } from "lucide-react";

import { POST_PAGES, postSchema, slugify, type PostInput } from "@/lib/validations/admin/post";
import { entityImageUrl } from "@/lib/entity-image";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EntityImageUpload } from "@/components/shared/entity-image-upload";
import { Skeleton } from "@/components/ui/skeleton";
import { backToListClassName } from "@/components/shared/back-to-list-button";

/** O editor Tiptap (core + extensões) é o maior custo de JS dessa página — carrega sob demanda
 * (fora do bundle inicial) em vez de bloquear a primeira renderização do formulário. */
const RichTextEditor = dynamic(
  () => import("@/components/shared/rich-text-editor").then((mod) => mod.RichTextEditor),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);
const RichTextViewer = dynamic(
  () => import("@/components/shared/rich-text-viewer").then((mod) => mod.RichTextViewer),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> },
);

type PostFormPost = {
  id: number;
  title: string;
  slug: string;
  page: string;
  excerpt: string | null;
  content: unknown;
  published: boolean;
  image?: EntityImageInfo | null;
};

type PostFormProps = {
  post: PostFormPost;
};

const AUTOSAVE_DELAY_MS = 5000;

/** CRUD do Post — grava com autosave: 5s após o usuário sair de qualquer campo (blur), salva
 * via PATCH sem fechar/navegar, só para não perder o que foi digitado. O post já existe (é
 * criado como rascunho pela listagem antes de chegar aqui), então media/autosave sempre têm
 * um id válido para usar. */
export function PostForm({ post }: PostFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  /** Só sincroniza o slug automaticamente enquanto ele ainda parece o rascunho recém-criado
   * (`novo-post-<timestamp>`, ver handleCreate na listagem) — evita trocar silenciosamente o
   * slug de um post já publicado (link quebrado) só porque o título foi ajustado depois. */
  const slugTouchedRef = useRef(!/^novo-post-\d+$/.test(post.slug));

  const form = useForm<PostInput>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: post.title,
      slug: post.slug,
      page: post.page as PostInput["page"],
      excerpt: post.excerpt,
      content: (post.content as JSONContent) ?? { type: "doc", content: [{ type: "paragraph" }] },
      published: post.published,
    },
  });

  const save = useCallback(async () => {
    const values = form.getValues();
    const parsed = postSchema.safeParse(values);
    if (!parsed.success) return;

    savingRef.current = true;
    setStatus("saving");

    const response = await fetch(`/api/admin/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    savingRef.current = false;

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setStatus("error");
      toast.error(data?.error ?? "Não foi possível salvar o post.");
      return;
    }

    setStatus("saved");
    router.refresh();
  }, [form, post.id, router]);

  const scheduleAutosave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void save();
    }, AUTOSAVE_DELAY_MS);
  }, [save]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const previewTitle = form.watch("title");
  const previewContent = form.watch("content");

  return (
    <Form {...form}>
      <form
        onBlur={scheduleAutosave}
        className="flex flex-col gap-6 lg:flex-row lg:items-start"
      >
        <div className="flex flex-1 flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          if (!slugTouchedRef.current) {
                            form.setValue("slug", slugify(event.target.value), { shouldDirty: true });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(event) => {
                          slugTouchedRef.current = true;
                          field.onChange(event);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="excerpt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resumo</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conteúdo</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        postId={post.id}
                        content={field.value as JSONContent}
                        onChange={(content) => field.onChange(content)}
                        onBlur={scheduleAutosave}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-80">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {status === "saving" && (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Salvando...
                  </>
                )}
                {status === "saved" && (
                  <>
                    <Check className="size-3.5 text-green-500" /> Salvo
                  </>
                )}
                {status === "idle" && "Alterações são salvas automaticamente."}
                {status === "error" && <span className="text-destructive">Falha ao salvar.</span>}
              </div>

              <FormField
                control={form.control}
                name="page"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Página</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        scheduleAutosave();
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione a página" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {POST_PAGES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="published"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) => {
                          field.onChange(event.target.checked);
                          scheduleAutosave();
                        }}
                        className="size-4"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Publicado</FormLabel>
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <FormLabel>Imagem de capa</FormLabel>
                <EntityImageUpload entityType="post" id={post.id} name={post.title} currentImage={post.image} />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button type="button" onClick={() => void save()} disabled={status === "saving"}>
                  Salvar agora
                </Button>
                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                  <DialogTrigger render={<Button type="button" variant="outline" />}>
                    <Eye className="size-4" />
                    Pré-visualizar
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Pré-visualização</DialogTitle>
                    </DialogHeader>
                    <article className="mx-auto w-full max-w-3xl px-4 pb-4">
                      {post.image?.extension && post.image.updatedAt && (
                        // eslint-disable-next-line @next/next/no-img-element -- readonly preview, mesma imagem servida na página pública
                        <img
                          src={entityImageUrl("post", post.id, post.image.extension, new Date(post.image.updatedAt))}
                          alt={previewTitle}
                          className="mb-6 aspect-video w-full rounded-lg border border-border object-cover"
                        />
                      )}
                      <h1 className="mb-2 text-3xl font-bold">{previewTitle || "Sem título"}</h1>
                      <p className="mb-8 text-sm text-muted-foreground">
                        Publicado em {dayjs().format("DD/MM/YYYY")}
                      </p>
                      <RichTextViewer content={previewContent as JSONContent} />
                    </article>
                  </DialogContent>
                </Dialog>
                <Button
                  type="button"
                  variant="ghost"
                  className={backToListClassName}
                  nativeButton={false}
                  render={<Link href="/admin/posts" />}
                >
                  Voltar para a lista
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}
