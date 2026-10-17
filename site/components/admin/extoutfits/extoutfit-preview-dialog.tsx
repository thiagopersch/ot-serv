"use client";

import { useState } from "react";
import useSWR from "swr";
import { Eye, Pause, Play } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import type { ExtOutfitRow } from "@/lib/extoutfit-mapper";
import { entityImageUrl } from "@/lib/entity-image";
import { formatLooktypeOption } from "@/lib/validations/admin/looktype";
import { EXTOUTFIT_KINDS, EXTOUTFIT_KIND_LABELS, type ExtOutfitKind } from "@/lib/validations/admin/extoutfit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import { useEntityImages } from "@/components/shared/use-entity-images";
import { LooktypeAnimatedImage } from "@/components/shared/looktype-animated-image";
import { renderLooktypeOption } from "@/components/shared/outfit-looktype-search-field";
import { useDefaultPreviewOutfit } from "@/components/admin/extoutfits/use-default-preview-outfit";
import { DEFAULT_PREVIEW_OUTFIT_COLORS } from "@/lib/extoutfit-preview-defaults";
import {
  OutfitCompositePreview,
  type CompositeLayer,
  type CompositeLooktype,
  type OutfitColorsInput,
} from "@/components/shared/outfit-composite-preview";

type OutfitLooktypeRow = CompositeLooktype & { name: string; looktypeNumber: number | null };

const DIRECTIONS = [
  { value: 0, label: "Norte" },
  { value: 1, label: "Leste" },
  { value: 2, label: "Sul" },
  { value: 3, label: "Oeste" },
];

const DEFAULT_COLORS: OutfitColorsInput = { ...DEFAULT_PREVIEW_OUTFIT_COLORS };

const textFetcher = (url: string) => fetch(url).then((response) => (response.ok ? response.text() : null));

type ExtOutfitPreviewDialogProps = {
  trigger: React.ReactElement;
  /** Abre com esse registro já marcado (ação da linha). */
  initial?: { kind: ExtOutfitKind; id: number };
};

/** Dialog "Pré-visualizar em outfit": escolhe uma outfit do cadastro de looktypes e marca quais
 * extoutfits aplicar (1 ou vários tipos, um registro de cada). */
export function ExtOutfitPreviewDialog({ trigger, initial }: ExtOutfitPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  // Outfit padrão (2334) até o usuário escolher outra ou limpar o campo.
  const defaultOutfit = useDefaultPreviewOutfit();
  const [pickedOutfit, setPickedOutfit] = useState<OutfitLooktypeRow | null>(null);
  const [outfitCleared, setOutfitCleared] = useState(false);
  const outfit = pickedOutfit ?? (outfitCleared ? null : defaultOutfit);
  const [enabled, setEnabled] = useState<Record<ExtOutfitKind, boolean>>(() => emptyKindMap(false, initial));
  const [selected, setSelected] = useState<Record<ExtOutfitKind, number | null>>(() => emptyKindMap(null, initial));
  const [offsets, setOffsets] = useState<Record<"wings" | "auras", { x: number; y: number }>>({
    wings: { x: 0, y: 0 },
    auras: { x: 0, y: 0 },
  });
  const [auraFront, setAuraFront] = useState(false);
  const [direction, setDirection] = useState(2);
  const [addons, setAddons] = useState(0);
  const [colors, setColors] = useState<OutfitColorsInput>(DEFAULT_COLORS);
  const [animate, setAnimate] = useState(true);
  const [zoom, setZoom] = useState(2);
  const [shaderError, setShaderError] = useState<string | null>(null);

  const { data: rowsData } = useSWR<PaginatedResult<ExtOutfitRow>>(
    open ? "/api/admin/extoutfits?pageSize=200" : null,
    fetcher,
  );
  const rows = rowsData?.data ?? [];
  const images = useEntityImages(
    "extoutfit",
    open ? rows.map((row) => row.id) : [],
  );

  const rowFor = (kind: ExtOutfitKind) =>
    enabled[kind] ? (rows.find((row) => row.kind === kind && row.id === selected[kind]) ?? null) : null;

  /** URL da imagem enviada do registro (`EntityImage`), `null` se não houver. */
  function imageUrlFor(rowId: number): string | null {
    const image = images.get(rowId);
    return image?.extension && image.updatedAt
      ? entityImageUrl("extoutfit", rowId, image.extension, new Date(image.updatedAt))
      : null;
  }

  function layerFor(kind: ExtOutfitKind, offset = { x: 0, y: 0 }): CompositeLayer | null {
    const row = rowFor(kind);
    if (!row) return null;
    return {
      imageUrl: imageUrlFor(row.id),
      looktype: row.looktype,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }

  const shaderRow = rowFor("shaders");
  const { data: fragment } = useSWR<string | null>(
    shaderRow?.hasShaderSource
      ? `/api/admin/extoutfits/${shaderRow.id}/shader?part=fragment&inline=1&v=${shaderRow.updatedAt}`
      : null,
    textFetcher,
  );
  const { data: vertex } = useSWR<string | null>(
    shaderRow?.hasShaderVertex
      ? `/api/admin/extoutfits/${shaderRow.id}/shader?part=vertex&inline=1&v=${shaderRow.updatedAt}`
      : null,
    textFetcher,
  );

  function selectRecord(kind: ExtOutfitKind, id: number) {
    setSelected((current) => ({ ...current, [kind]: id }));
    if (kind === "wings" || kind === "auras") {
      const row = rows.find((entry) => entry.id === id);
      setOffsets((current) => ({ ...current, [kind]: { x: row?.posx ?? 0, y: row?.posy ?? 0 } }));
    }
  }

  const auraLayer = layerFor("auras", offsets.auras);
  const addonOptions = outfit?.addonSlots ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Pré-visualizar extoutfits em uma outfit</DialogTitle>
          <DialogDescription>
            Escolha a outfit no cadastro de looktypes e marque o que aplicar. Ordem de desenho, offsets e
            shader seguem o <code>Outfit::draw</code> do cliente — a posição exata pode variar com os
            offsets por looktype do <code>game_auraoffset.lua</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[75vh] gap-6 overflow-y-auto md:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Outfit</Label>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <EntitySearchCombobox<OutfitLooktypeRow>
                    endpoint="/api/admin/looktypes?category=outfit"
                    value={outfit?.id ?? null}
                    placeholder="Buscar outfit por nome ou número..."
                    formatOption={formatLooktypeOption}
                    renderOption={renderLooktypeOption}
                    onSelect={(row) => {
                      setPickedOutfit(row);
                      setOutfitCleared(row === null);
                      setAddons(0);
                    }}
                  />
                </div>
                {outfit && (
                  <LooktypeAnimatedImage
                    key={outfit.id}
                    looktypeId={outfit.id}
                    frameCount={outfit.frameCount}
                    frameDurationsMs={outfit.frameDurationsMs}
                    updatedAt={outfit.updatedAt}
                    size="md"
                  />
                )}
              </div>
            </div>

            {EXTOUTFIT_KINDS.map((kind) => {
              const ofKind = rows.filter((row) => row.kind === kind);
              return (
                <div key={kind} className="flex flex-col gap-1.5 rounded-md border p-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={enabled[kind]}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setEnabled((current) => ({ ...current, [kind]: checked }));
                        if (checked && selected[kind] == null && ofKind[0]) selectRecord(kind, ofKind[0].id);
                      }}
                    />
                    {EXTOUTFIT_KIND_LABELS[kind]}
                  </label>
                  {enabled[kind] && (
                    <>
                      <Select
                        value={selected[kind] != null ? String(selected[kind]) : ""}
                        onValueChange={(value) => selectRecord(kind, Number(value))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione...">
                            {(value: string) => {
                              const row = ofKind.find((entry) => String(entry.id) === value);
                              return row ? renderRecordOption(row, imageUrlFor(row.id)) : "Selecione...";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ofKind.map((row) => (
                            <SelectItem key={row.id} value={String(row.id)}>
                              {renderRecordOption(row, imageUrlFor(row.id))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(kind === "wings" || kind === "auras") && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Offset</span>
                          <Input
                            type="number"
                            className="h-7 w-20"
                            value={offsets[kind].x}
                            onChange={(event) =>
                              setOffsets((current) => ({ ...current, [kind]: { ...current[kind], x: Number(event.target.value) } }))
                            }
                          />
                          <Input
                            type="number"
                            className="h-7 w-20"
                            value={offsets[kind].y}
                            onChange={(event) =>
                              setOffsets((current) => ({ ...current, [kind]: { ...current[kind], y: Number(event.target.value) } }))
                            }
                          />
                          {kind === "auras" && (
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                className="size-3.5"
                                checked={auraFront}
                                onChange={(event) => setAuraFront(event.target.checked)}
                              />
                              Na frente
                            </label>
                          )}
                        </div>
                      )}
                      {kind === "shaders" && shaderRow && !shaderRow.hasShaderSource && (
                        <p className="text-xs text-amber-500">
                          Esse shader ainda não tem arquivo .frag enviado — a outfit aparece sem efeito.
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {DIRECTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={direction === option.value ? "default" : "outline"}
                  onClick={() => setDirection(option.value)}
                >
                  {option.label}
                </Button>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setAnimate((value) => !value)}>
                {animate ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              {[1, 2, 3].map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={zoom === value ? "default" : "outline"}
                  onClick={() => setZoom(value)}
                >
                  {value}x
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
              {(["head", "body", "legs", "feet"] as const).map((region) => (
                <label key={region} className="flex items-center gap-1">
                  {region}
                  <Input
                    type="number"
                    min={0}
                    max={132}
                    className="h-7 w-16"
                    value={colors[region]}
                    onChange={(event) => setColors((current) => ({ ...current, [region]: Number(event.target.value) }))}
                  />
                </label>
              ))}
              {addonOptions > 0 &&
                Array.from({ length: addonOptions }, (_, index) => (
                  <label key={index} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      className="size-3.5"
                      checked={!!(addons & (1 << index))}
                      onChange={() => setAddons((current) => current ^ (1 << index))}
                    />
                    Addon {index + 1}
                  </label>
                ))}
            </div>

            <div className="max-w-full overflow-auto">
              <OutfitCompositePreview
                outfit={outfit}
                direction={direction}
                addons={addons}
                colors={colors}
                animate={animate}
                zoom={zoom}
                wings={layerFor("wings", offsets.wings)}
                aura={auraLayer ? { ...auraLayer, front: auraFront } : null}
                shader={fragment ? { fragment, vertex: vertex ?? null, tex1Url: shaderRow?.shaderTex1Url ?? null } : null}
                healthBar={layerFor("healthbars")}
                manaBar={layerFor("manabars")}
                onShaderError={setShaderError}
              />
            </div>

            {!outfit && <p className="text-sm text-muted-foreground">Selecione uma outfit para visualizar.</p>}
            {shaderError && (
              <pre className="max-w-full overflow-auto rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                {shaderError}
              </pre>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Opção do select de registro: imagem enviada (APNG anima no `<img>`) ou, sem ela, a sprite
 * vinculada; wings/auras mostram o número da looktype do XML, barras/shaders o `image`/`shadername`. */
function renderRecordOption(row: ExtOutfitRow, imageUrl: string | null) {
  const label = `#${row.xmlId} — ${row.name}`;
  const isLooktypeKind = row.kind === "wings" || row.kind === "auras";
  const detail = isLooktypeKind
    ? row.looktypeNumber !== null
      ? `nº ${row.looktypeNumber}`
      : null
    : row.shaderName || row.image || null;

  let thumb: React.ReactNode = null;
  if (imageUrl) {
    thumb = (
      // eslint-disable-next-line @next/next/no-img-element -- miniatura da imagem enviada (APNG anima nativo)
      <img
        src={imageUrl}
        alt=""
        className="h-6 max-w-16 shrink-0 object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    );
  } else if (row.looktype) {
    thumb = (
      <LooktypeAnimatedImage
        looktypeId={row.looktype.id}
        frameCount={row.looktype.frameCount}
        frameDurationsMs={row.looktype.frameDurationsMs}
        updatedAt={row.looktype.updatedAt}
        size="sm"
        zoomOnHover={false}
      />
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      {thumb}
      <span className="truncate">{label}</span>
      {detail && <span className="truncate text-xs text-muted-foreground">({detail})</span>}
    </span>
  );
}

function emptyKindMap<T>(value: T, initial?: { kind: ExtOutfitKind; id: number }): Record<ExtOutfitKind, T> {
  const map = Object.fromEntries(EXTOUTFIT_KINDS.map((kind) => [kind, value])) as Record<ExtOutfitKind, T>;
  if (initial) {
    (map as Record<ExtOutfitKind, unknown>)[initial.kind] = typeof value === "boolean" ? true : initial.id;
  }
  return map;
}

export function ExtOutfitPreviewButton({ initial }: { initial?: { kind: ExtOutfitKind; id: number } }) {
  return (
    <ExtOutfitPreviewDialog
      initial={initial}
      trigger={
        <Button variant="outline">
          <Eye className="size-4" />
          Pré-visualizar em outfit
        </Button>
      }
    />
  );
}
