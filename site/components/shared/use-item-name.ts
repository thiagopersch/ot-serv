import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";

/** Busca o nome de um item pelo id — usado onde só se tem o id salvo (ex.: preencher um campo
 * "Comentário" automaticamente, ou passar `name` pro tooltip de `EntityThumb`). */
export function useItemName(id: number | null | undefined) {
  const key =
    typeof id === "number" && Number.isFinite(id) && id > 0 ? `/api/admin/items/${id}` : null;
  const { data } = useSWR<{ item: { name: string } }>(key, fetcher);
  return data?.item.name ?? null;
}
