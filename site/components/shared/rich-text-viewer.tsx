import { generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";

import { AudioEmbed, FontSize, VideoEmbed } from "@/components/shared/rich-text-extensions";
import { cn } from "@/lib/utils";

const VIEWER_EXTENSIONS = [
  StarterKit.configure({ link: { openOnClick: true } }),
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Image,
  VideoEmbed,
  AudioEmbed,
  Table,
  TableRow,
  TableHeader,
  TableCell,
];

type RichTextViewerProps = {
  content: JSONContent;
  className?: string;
};

/** Render estático (server-safe) do JSON do Tiptap para as páginas públicas. */
export function RichTextViewer({ content, className }: RichTextViewerProps) {
  const html = generateHTML(content, VIEWER_EXTENSIONS);

  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
