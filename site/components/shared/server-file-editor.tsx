"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { xml } from "@codemirror/legacy-modes/mode/xml";
import { json } from "@codemirror/lang-json";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import type { Extension } from "@codemirror/state";

const luaLanguage = StreamLanguage.define(lua);
const xmlLanguage = StreamLanguage.define(xml);

const XML_EXTENSIONS = new Set([".xml", ".html", ".htm"]);

function languageExtensionsFor(fileName: string): Extension[] {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

  if (extension === ".lua") return [luaLanguage];
  if (XML_EXTENSIONS.has(extension)) return [xmlLanguage];
  if (extension === ".json") return [json()];
  return [];
}

type ServerFileEditorProps = {
  fileName: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

/** Editor de código para o Explorador de arquivos do servidor
 * (`components/admin/lua-scripts/server-file-explorer.tsx`) — mesma base CodeMirror 6 +
 * tema `vscodeDark` de `components/shared/lua-code-editor.tsx`, mas escolhendo o modo de
 * linguagem pela extensão do arquivo em vez de ser fixo em Lua (o explorador abre `.lua`,
 * `.xml` e outros arquivos de texto/código). */
export function ServerFileEditor({ fileName, value, onChange, readOnly }: ServerFileEditorProps) {
  const extensions = useMemo(() => languageExtensionsFor(fileName), [fileName]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={vscodeDark}
      extensions={extensions}
      readOnly={readOnly}
      height="100%"
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        tabSize: 4,
      }}
      style={{ fontSize: 13, height: "100%" }}
    />
  );
}
