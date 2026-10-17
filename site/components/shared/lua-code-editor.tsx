"use client";

import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";

const luaLanguage = StreamLanguage.define(lua);

type LuaCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  minHeight?: string;
  readOnly?: boolean;
};

/** Editor de código Lua com syntax highlighting (CodeMirror 6 + modo Lua legado). Usado no
 * cadastro de LuaScript (`components/admin/lua-scripts/lua-script-form.tsx`) no lugar de um
 * `<textarea>` plano — a UI do portal é sempre dark mode (ver app/layout.tsx), então o tema
 * do editor é fixo em `vscodeDark`, sem alternância. */
export function LuaCodeEditor({
  value,
  onChange,
  onBlur,
  minHeight = "480px",
  readOnly,
}: LuaCodeEditorProps) {
  return (
    <div className="overflow-hidden rounded-md border border-input">
      <CodeMirror
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        theme={vscodeDark}
        extensions={[luaLanguage]}
        readOnly={readOnly}
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
        style={{ fontSize: 13 }}
        minHeight={minHeight}
      />
    </div>
  );
}
