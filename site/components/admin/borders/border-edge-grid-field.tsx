"use client";

import type { Control, FieldPath } from "react-hook-form";

import { type BorderFormInput, type BorderEdge, BORDER_EDGES } from "@/lib/validations/admin/border";
import { ItemSearchField } from "@/components/shared/item-search-field";

type BorderEdgeGridFieldProps = {
  control: Control<BorderFormInput>;
};

const EDGE_LABELS: Record<BorderEdge, string> = {
  n: "Norte (n)",
  e: "Leste (e)",
  s: "Sul (s)",
  w: "Oeste (w)",
  cnw: "Canto côncavo NO (cnw)",
  cne: "Canto côncavo NE (cne)",
  cse: "Canto côncavo SE (cse)",
  csw: "Canto côncavo SO (csw)",
  dnw: "Canto diagonal NO (dnw)",
  dne: "Canto diagonal NE (dne)",
  dse: "Canto diagonal SE (dse)",
  dsw: "Canto diagonal SO (dsw)",
};

const EDGE_TOOLTIPS: Record<BorderEdge, string> = {
  n: "Lado norte (topo) do tile — letra n.",
  e: "Lado leste (direita) do tile — letra e.",
  s: "Lado sul (base) do tile — letra s.",
  w: "Lado oeste (esquerda) do tile — letra w.",
  cnw: "Canto côncavo noroeste (o border \"entra\" no tile) — prefixo c + nw.",
  cne: "Canto côncavo nordeste (o border \"entra\" no tile) — prefixo c + ne.",
  cse: "Canto côncavo sudeste (o border \"entra\" no tile) — prefixo c + se.",
  csw: "Canto côncavo sudoeste (o border \"entra\" no tile) — prefixo c + sw.",
  dnw: "Canto diagonal noroeste (o border \"sai\" na diagonal) — prefixo d + nw.",
  dne: "Canto diagonal nordeste (o border \"sai\" na diagonal) — prefixo d + ne.",
  dse: "Canto diagonal sudeste (o border \"sai\" na diagonal) — prefixo d + se.",
  dsw: "Canto diagonal sudoeste (o border \"sai\" na diagonal) — prefixo d + sw.",
};

/** Linha = [lado reto, canto côncavo correspondente, canto diagonal correspondente]. */
const EDGE_ROWS: [BorderEdge, BorderEdge, BorderEdge][] = [
  ["n", "cnw", "dnw"],
  ["s", "cne", "dne"],
  ["e", "cse", "dse"],
  ["w", "csw", "dsw"],
];

export function BorderEdgeGridField({ control }: BorderEdgeGridFieldProps) {
  const indexByEdge = new Map(BORDER_EDGES.map((edge, index) => [edge, index]));

  return (
    <div className="flex flex-col gap-4">
      {EDGE_ROWS.map((row) => (
        <div key={row[0]} className="grid gap-4 sm:grid-cols-3">
          {row.map((edge) => (
            <ItemSearchField
              key={edge}
              control={control}
              name={`edges.${indexByEdge.get(edge)}.itemId` as FieldPath<BorderFormInput>}
              label={EDGE_LABELS[edge]}
              tooltip={EDGE_TOOLTIPS[edge]}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
