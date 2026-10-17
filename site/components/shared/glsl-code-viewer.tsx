"use client";

import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { c as cLike } from "@codemirror/legacy-modes/mode/clike";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";

const glslLanguage = StreamLanguage.define(cLike);

/** Visualizador somente leitura de GLSL (`.frag` dos shaders do cliente) — modo C do CodeMirror,
 * mesma base do `XmlCodeViewer`. */
export function GlslCodeViewer({ value, maxHeight = "320px" }: { value: string; maxHeight?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-input">
      <CodeMirror
        value={value}
        theme={vscodeDark}
        extensions={[glslLanguage, EditorView.lineWrapping]}
        editable={false}
        style={{ fontSize: 12 }}
        maxHeight={maxHeight}
      />
    </div>
  );
}
