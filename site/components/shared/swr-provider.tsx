"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

import { FetchError } from "@/lib/fetcher";

/** Config global do SWR: nunca insiste em re-tentar uma request que falhou por sessão
 * expirada/sem permissão (401/403) — quem consome o hook decide o que fazer (ex.: redirecionar
 * para o login) em vez de ficar re-buscando os mesmos dados indefinidamente. */
export function SwrProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        onErrorRetry: (error, key, config, revalidate, opts) => {
          if (error instanceof FetchError && (error.status === 401 || error.status === 403)) {
            return;
          }
          if ((opts.retryCount ?? 0) >= 5) return;
          setTimeout(() => revalidate(opts), 5000);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
