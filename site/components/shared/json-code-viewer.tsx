"use client";

import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { json } from "@codemirror/lang-json";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";

type JsonCodeViewerProps = {
  value: unknown;
  maxHeight?: string;
};

/** Visualizador de JSON com syntax highlighting (CodeMirror 6) — mesma base do editor de
 * Lua (`components/shared/lua-code-editor.tsx`) e do `XmlCodeViewer`, mas somente leitura.
 * Usado na auditoria para formatar metadata/request/response no lugar de um `<pre>` plano. */
export function JsonCodeViewer({ value, maxHeight = "60vh" }: JsonCodeViewerProps) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return (
    <div className="overflow-hidden rounded-md border border-input">
      <CodeMirror
        value={text}
        theme={vscodeDark}
        extensions={[json(), EditorView.lineWrapping]}
        editable={false}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          bracketMatching: true,
        }}
        style={{ fontSize: 12 }}
        maxHeight={maxHeight}
      />
    </div>
  );
}
