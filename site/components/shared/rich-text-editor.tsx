"use client";

import { useCallback, useRef } from "react";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  ImageIcon,
  Video as VideoIcon,
  Music,
  Table as TableIcon,
  Undo,
  Redo,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AudioEmbed, FontSize, POST_FONT_FAMILIES, POST_FONT_SIZES, VideoEmbed } from "@/components/shared/rich-text-extensions";

type RichTextEditorProps = {
  postId: number | null;
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  onBlur?: () => void;
};

const EDITOR_EXTENSIONS = [
  StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Image,
  VideoEmbed,
  AudioEmbed,
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Placeholder.configure({ placeholder: "Escreva o conteúdo do post..." }),
];

/** Editor de conteúdo rico (Tiptap) para Posts — imagem/gif/vídeo/áudio, tabela, cores,
 * fontes, alinhamento e listas. `postId` null (post ainda não criado) desabilita upload de
 * mídia embutida, já que os arquivos ficam em `public/storage/post-media/{postId}/`. */
export function RichTextEditor({ postId, content, onChange, onBlur }: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    onBlur: () => onBlur?.(),
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none min-h-[280px] px-3 py-2 focus:outline-none",
      },
    },
  });

  const uploadMedia = useCallback(
    async (file: File, kind: "image" | "video" | "audio") => {
      if (!postId) {
        toast.error("Salve o post antes de inserir mídia.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/admin/posts/${postId}/media`, { method: "POST", body: formData });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.error ?? "Não foi possível enviar o arquivo.");
        return;
      }
      const data = await response.json();
      if (!editor) return;
      if (kind === "image") {
        editor.chain().focus().setImage({ src: data.url }).run();
      } else if (kind === "video") {
        editor.chain().focus().insertContent({ type: "video", attrs: { src: data.url } }).run();
      } else {
        editor.chain().focus().insertContent({ type: "audio", attrs: { src: data.url } }).run();
      }
    },
    [editor, postId]
  );

  if (!editor) return null;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>, kind: "image" | "video" | "audio") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadMedia(file, kind);
  }

  function toggleLink() {
    const previousUrl = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-input p-1.5">
        <ToolbarToggle icon={Bold} label="Negrito" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarToggle icon={Italic} label="Itálico" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarToggle icon={UnderlineIcon} label="Sublinhado" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolbarToggle icon={Strikethrough} label="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />

        <Divider />

        <ToolbarToggle icon={Heading1} label="Título 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <ToolbarToggle icon={Heading2} label="Título 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarToggle icon={Heading3} label="Título 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />

        <Divider />

        <ToolbarToggle icon={List} label="Lista com marcadores" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarToggle icon={ListOrdered} label="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />

        <Divider />

        <ToolbarToggle icon={AlignLeft} label="Alinhar à esquerda" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
        <ToolbarToggle icon={AlignCenter} label="Centralizar" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
        <ToolbarToggle icon={AlignRight} label="Alinhar à direita" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
        <ToolbarToggle icon={AlignJustify} label="Justificar" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} />

        <Divider />

        <Select
          value={(editor.getAttributes("textStyle").fontFamily as string | undefined) || "default"}
          onValueChange={(value) => {
            if (value && value !== "default") editor.chain().focus().setFontFamily(value).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-36 text-xs">
            <SelectValue placeholder="Fonte" />
          </SelectTrigger>
          <SelectContent>
            {POST_FONT_FAMILIES.map((font) => (
              <SelectItem key={font.label} value={font.value || "default"}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={(editor.getAttributes("textStyle").fontSize as string | undefined) ?? ""}
          onValueChange={(value) => {
            if (value) editor.chain().focus().setFontSize(value).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-20 text-xs">
            <SelectValue placeholder="Tam." />
          </SelectTrigger>
          <SelectContent>
            {POST_FONT_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          type="color"
          title="Cor do texto"
          className="h-8 w-8 cursor-pointer rounded border border-input bg-background p-1"
          value={(editor.getAttributes("textStyle").color as string | undefined) ?? "#000000"}
          onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
        />

        <Divider />

        <ToolbarToggle icon={LinkIcon} label="Link" active={editor.isActive("link")} onClick={toggleLink} />
        <ToolbarToggle icon={ImageIcon} label="Imagem/GIF" onClick={() => imageInputRef.current?.click()} />
        <ToolbarToggle icon={VideoIcon} label="Vídeo" onClick={() => videoInputRef.current?.click()} />
        <ToolbarToggle icon={Music} label="Áudio" onClick={() => audioInputRef.current?.click()} />
        <ToolbarToggle
          icon={TableIcon}
          label="Inserir tabela"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        />

        <Divider />

        <ToolbarToggle icon={Undo} label="Desfazer" onClick={() => editor.chain().focus().undo().run()} />
        <ToolbarToggle icon={Redo} label="Refazer" onClick={() => editor.chain().focus().redo().run()} />

        <input ref={imageInputRef} type="file" accept="image/png,image/gif,image/jpeg,image/webp" className="hidden" onChange={(event) => handleFileChange(event, "image")} />
        <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(event) => handleFileChange(event, "video")} />
        <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/ogg" className="hidden" onChange={(event) => handleFileChange(event, "audio")} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function Divider() {
  return <div className="mx-0.5 h-6 w-px bg-border" />;
}

function ToolbarToggle({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={label}
      className={cn(active && "bg-muted text-foreground")}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  );
}
