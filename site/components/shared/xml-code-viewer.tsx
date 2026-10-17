"use client";

import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { xml } from "@codemirror/legacy-modes/mode/xml";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";

const xmlLanguage = StreamLanguage.define(xml);

type XmlCodeViewerProps = {
  value: string;
  maxHeight?: string;
};

/** Visualizador de XML com syntax highlighting (CodeMirror 6 + modo XML legado) — mesma
 * base do editor de Lua (`components/shared/lua-code-editor.tsx`), mas somente leitura.
 * Usado nas pré-visualizações de XML (Doodad/Wall/Ground/Border) no lugar de um `<pre>` plano.
 * Sem `minHeight`: a altura acompanha o conteúdo (XML curto não deixa espaço vazio embaixo);
 * `maxHeight` só entra para limitar/rolar quando o XML é grande. */
export function XmlCodeViewer({ value, maxHeight = "70vh" }: XmlCodeViewerProps) {
  return (
    <div className="overflow-hidden rounded-md border border-input">
      <CodeMirror
        value={value}
        theme={vscodeDark}
        extensions={[xmlLanguage, EditorView.lineWrapping]}
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
