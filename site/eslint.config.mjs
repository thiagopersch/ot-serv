import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Rotina do React Compiler avisa que não consegue auto-memoizar componentes que usam
  // APIs de libs de terceiros (react-hook-form `watch`, TanStack Table/Virtual) — a
  // mensagem é informativa (só "conomia" de memo), não é erro de correção. Essas libs são
  // uso padrão do projeto, então o aviso é silenciado.
  {
    rules: {
      "react-hooks/incompatible-library": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Snapshots de git worktree (checkout separado do projeto) — não deve ser lintado.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
