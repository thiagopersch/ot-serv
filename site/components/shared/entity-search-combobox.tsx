"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";

type SearchOption = { value: number; label: string };

const SEARCH_DEBOUNCE_MS = 300;

/** Combobox genérico de busca por id — busca uma lista paginada de um endpoint admin
 * (`/api/admin/spells`, `/api/admin/items`, ...) e deixa selecionar um registro pelo id,
 * devolvendo a linha original via `onSelect`. Generalização de
 * `components/admin/monsters/monster-spell-combobox.tsx` para qualquer entidade.
 *
 * Encaminha o texto digitado como `?search=` (debounced) pro endpoint em vez de só filtrar
 * os `pageSize` primeiros registros no cliente — necessário para catálogos grandes (ex.:
 * `/api/admin/items`, +50 mil linhas), onde os primeiros N resultados quase nunca incluem o
 * item procurado. O endpoint de items já resolve `search` numérico como id (`search=2160`
 * encontra o item #2160 mesmo que o nome não contenha "2160"). */
export function EntitySearchCombobox<Row extends { id: number }>({
  endpoint,
  value,
  onSelect,
  formatOption,
  renderOption,
  placeholder = "Buscar...",
  pageSize = 30,
}: {
  endpoint: string;
  value: number | null;
  onSelect: (row: Row | null) => void;
  formatOption: (row: Row) => string;
  /** Sobrepõe o conteúdo de cada item da lista (ex.: sprite 32x32 + nome) — o texto de
   * `formatOption` continua usado para o filtro/label acessível do combobox. */
  renderOption?: (row: Row) => React.ReactNode;
  placeholder?: string;
  pageSize?: number;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleInputValueChange(nextValue: string) {
    setSearchInput(nextValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(nextValue), SEARCH_DEBOUNCE_MS);
  }

  const separator = endpoint.includes("?") ? "&" : "?";
  // `skipCount=1`: o combobox nunca usa `total`/`pageCount`, só `data` — pula o `COUNT(*)` nas
  // rotas que suportam o flag (catálogos grandes tipo items/monstros, onde o count com `LIKE`
  // custa uma varredura completa da tabela a cada tecla digitada).
  const { data, isLoading } = useSWR<PaginatedResult<Row>>(
    `${endpoint}${separator}pageSize=${pageSize}&search=${encodeURIComponent(search)}&skipCount=1`,
    fetcher,
  );

  // A opção já selecionada (vinda de um registro existente, ex.: form de edição) pode não estar
  // na primeira página da busca em branco em catálogos grandes (items, looktypes) — sem isso o
  // campo aparece vazio até o usuário digitar algo que traga o registro pra lista. Busca à parte
  // por `?id=`, que os endpoints admin resolvem como match exato por chave primária (ver
  // `parseIdsParam`) — usar `search` aqui seria ambíguo (fuzzy por nome, paginado) e podia nunca
  // devolver o registro certo dependendo de colisão com outros nomes/ids do catálogo.
  const resolvedRow = data?.data.find((row) => row.id === value) ?? null;
  const { data: valueData } = useSWR<PaginatedResult<Row>>(
    value != null && resolvedRow === null ? `${endpoint}${separator}id=${value}` : null,
    fetcher,
  );

  const options: SearchOption[] = (data?.data ?? []).map((row) => ({
    value: row.id,
    label: formatOption(row),
  }));

  const selectedRow = resolvedRow ?? valueData?.data.find((row) => row.id === value) ?? null;
  const selected = selectedRow ? { value: selectedRow.id, label: formatOption(selectedRow) } : null;

  // `inputValue` é 100% controlado por `searchInput` — base-ui não sincroniza sozinho o texto
  // do input com `value`/`selected` (são conceitos independentes ali). Sem isso, o campo mostra
  // vazio mesmo com um item corretamente selecionado por baixo dos panos (ex.: ao abrir um form
  // de edição). Só sincroniza quando o id selecionado (prop `value`) muda de fora — nunca
  // enquanto o usuário está digitando pra filtrar (a busca não altera `value`).
  const lastSyncedValueRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (lastSyncedValueRef.current === value) return;
    // Vários campos usam `0` (não só `null`) como sentinela de "nada selecionado" — trata igual.
    if (value == null || value <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza texto do input (estado interno, não sincronizável via derivação de render por depender do fetch assíncrono do label) com o id externo, sem sobrescrever o que o usuário está digitando
      setSearchInput("");
      lastSyncedValueRef.current = value;
      return;
    }
    if (selected) {
      setSearchInput(selected.label);
      lastSyncedValueRef.current = value;
    }
    // else: `value` já mudou mas o label ainda não resolveu (fetch em andamento) — não marca
    // como sincronizado ainda, o efeito roda de novo assim que `selected` ficar disponível.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à mudança do id (`value`), não a cada re-render de `selected`
  }, [value, selected?.label]);

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(item) => {
        const option = item as SearchOption | null;
        if (!option) {
          onSelect(null);
          return;
        }
        const row = data?.data.find((entry) => entry.id === option.value);
        onSelect(row ?? null);
      }}
      inputValue={searchInput}
      onInputValueChange={handleInputValueChange}
      filter={null}
      isItemEqualToValue={(a: SearchOption, b: SearchOption) =>
        a.value === b.value
      }
      itemToStringLabel={(item: SearchOption) => item.label}
    >
      <ComboboxInput placeholder={placeholder} showClear className="w-full" />
      <ComboboxContent>
        {isLoading ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <>
            <ComboboxEmpty>Nenhum resultado encontrado.</ComboboxEmpty>
            <ComboboxList>
              {(item: SearchOption) => {
                const row = data?.data.find((entry) => entry.id === item.value);
                return (
                  <ComboboxItem key={item.value} value={item}>
                    {renderOption && row ? renderOption(row) : item.label}
                  </ComboboxItem>
                );
              }}
            </ComboboxList>
          </>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
