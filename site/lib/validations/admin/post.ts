import { z } from "zod";

/** Onde o post aparece no site público — `home` é a listagem geral (`/posts`, landing);
 * as demais são as seções de gameplay que viraram CMS (cards ou tabela, ver
 * `app/(site)/gameplay/*`). */
export const POST_PAGES = [
  { value: "home", label: "Geral (posts/landing)" },
  { value: "rules", label: "Regras (/rules)" },
  { value: "town", label: "Cidades (cards)" },
  { value: "system", label: "Sistemas (cards)" },
  { value: "event", label: "Eventos (cards)" },
  { value: "quest", label: "Quests (tabela)" },
  { value: "raid", label: "Raids (tabela)" },
  { value: "task", label: "Tarefas (tabela)" },
  { value: "mission", label: "Missões (tabela)" },
] as const;
export type PostPage = (typeof POST_PAGES)[number]["value"];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const postSchema = z.object({
  title: z.string().min(1, "Informe o título").max(255),
  slug: z
    .string()
    .min(1, "Informe o slug")
    .max(255)
    .regex(SLUG_PATTERN, "Use apenas letras minúsculas, números e hífen (ex.: meu-post-legal)"),
  page: z.enum(POST_PAGES.map((p) => p.value) as [PostPage, ...PostPage[]]),
  excerpt: z.string().max(500).nullable(),
  /** Documento Tiptap (JSON) — validado de verdade só no editor; aqui só garante que é
   * um objeto serializável. */
  content: z.record(z.string(), z.unknown()),
  published: z.boolean(),
});
export type PostInput = z.infer<typeof postSchema>;

export const defaultPostContent = { type: "doc", content: [{ type: "paragraph" }] };

export const defaultPostValues: PostInput = {
  title: "",
  slug: "",
  page: "home",
  excerpt: null,
  content: defaultPostContent,
  published: false,
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
