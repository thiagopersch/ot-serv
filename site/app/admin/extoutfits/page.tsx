"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Eye, FileArchive, FileCode, ImageUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/pagination";
import type { ExtOutfitRow } from "@/lib/extoutfit-mapper";
import { extOutfitToXml, extOutfitsToXmlDocument } from "@/lib/extoutfit-xml";
import { EXTOUTFIT_KINDS, EXTOUTFIT_KIND_LABELS } from "@/lib/validations/admin/extoutfit";
import { useServerTable } from "@/hooks/use-server-table";
import { useCrossPageSelection } from "@/hooks/use-cross-page-selection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { CopyXmlButton } from "@/components/shared/copy-xml-button";
import { XmlImportDialog } from "@/components/shared/xml-import-dialog";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { useEntityImages } from "@/components/shared/use-entity-images";
import { EntityImageUploadDialog } from "@/components/shared/entity-image-upload-dialog";
import { MultiFileUploadDialog } from "@/components/shared/multi-file-upload-dialog";
import { ShaderOutfitThumb } from "@/components/admin/extoutfits/shader-outfit-thumb";
import { useDefaultPreviewOutfit } from "@/components/admin/extoutfits/use-default-preview-outfit";
import { ExtOutfitPreviewButton, ExtOutfitPreviewDialog } from "@/components/admin/extoutfits/extoutfit-preview-dialog";
import {
  GeneratedCodeDialog,
  downloadText,
  type GeneratedCodeSection,
} from "@/components/shared/generated-code-dialog";
import type { FilterFieldConfig } from "@/components/shared/advanced-filter-panel";

export default function AdminExtOutfitsPage() {
  const table = useServerTable();

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<ExtOutfitRow>>(
    `/api/admin/extoutfits?${table.buildQueryParams().toString()}`,
    fetcher,
  );

  const selection = useCrossPageSelection(data?.data);
  const defaultPreviewOutfit = useDefaultPreviewOutfit();
  const images = useEntityImages(
    "extoutfit",
    (data?.data ?? []).map((row) => row.id),
  );
  const selectedCount = selection.selectedIds.size;
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  async function loadXml() {
    const query = selectedCount > 0 ? `&ids=${[...selection.selectedIds].join(",")}` : "";
    const response = await fetch(`/api/admin/extoutfits/export?inline=1${query}`);
    if (!response.ok) throw new Error();
    return [
      { title: "extoutfits.xml", filename: "extoutfits.xml", language: "xml" as const, text: await response.text() },
    ];
  }

  /** Seções do "Gerar / ver arquivos" de um registro: linha XML + arquivos conforme o tipo
   * (.frag/vertex em GLSL, imagem original — APNG preservado). */
  async function loadRowSections(row: ExtOutfitRow): Promise<GeneratedCodeSection[]> {
    const sections: GeneratedCodeSection[] = [
      {
        title: "Linha do extoutfits.xml",
        filename: `${row.kind}_${row.xmlId}.xml`,
        language: "xml",
        text: extOutfitToXml(row),
      },
    ];
    for (const file of row.files) {
      const fileUrl = `/api/admin/extoutfits/${row.id}/file?part=${file.part}`;
      if (file.part === "fragment" || file.part === "vertex") {
        const response = await fetch(`${fileUrl}&inline=1`);
        if (!response.ok) continue;
        sections.push({ title: file.clientPath, filename: file.fileName, language: "glsl", text: await response.text() });
      } else {
        sections.push({
          title: file.clientPath,
          filename: file.fileName,
          language: "image",
          url: `${fileUrl}&inline=1&v=${row.updatedAt}`,
          downloadUrl: fileUrl,
        });
      }
    }
    return sections;
  }

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/extoutfits/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Não foi possível remover o registro.");
      return;
    }
    toast.success("Registro removido.");
    mutate();
  }

  async function handleBulkDelete() {
    setIsBulkDeleting(true);
    try {
      const response = await fetch("/api/admin/extoutfits/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selection.selectedIds] }),
      });
      const responseData = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(responseData?.error ?? "Não foi possível excluir os selecionados.");
        return;
      }
      selection.clearSelection();
      mutate();
      toast.success(`${responseData.deletedCount} registro(s) removido(s).`);
    } finally {
      setIsBulkDeleting(false);
    }
  }

  const filterFields: FilterFieldConfig[] = [
    {
      key: "kind",
      label: "Tipo",
      type: "select",
      options: EXTOUTFIT_KINDS.map((kind) => ({ value: kind, label: EXTOUTFIT_KIND_LABELS[kind] })),
    },
  ];

  const columns: ColumnDef<ExtOutfitRow>[] = [
    {
      accessorKey: "kind",
      header: "Tipo",
      cell: ({ row }) => <Badge variant="secondary">{EXTOUTFIT_KIND_LABELS[row.original.kind]}</Badge>,
    },
    { accessorKey: "xmlId", header: "ID" },
    {
      id: "preview",
      header: "Preview",
      cell: ({ row }) => {
        const image = images.get(row.original.id);
        // Shaders sem imagem/sprite própria: demonstra o efeito na outfit padrão.
        if (row.original.kind === "shaders" && !image?.extension && !image?.looktype) {
          return <ShaderOutfitThumb row={row.original} outfit={defaultPreviewOutfit} />;
        }
        return (
        <EntityThumb
          entityType="extoutfit"
          id={row.original.id}
          name={row.original.name}
          image={image ?? null}
          size="md"
        />
        );
      },
    },
    { accessorKey: "name", header: "Nome" },
    {
      id: "value",
      header: "Looktype / shader / imagem",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs">
            {row.original.kind === "wings" || row.original.kind === "auras"
              ? row.original.looktypeNumber
              : row.original.shaderName || row.original.image || "—"}
          </span>
          {row.original.kind === "shaders" &&
            (row.original.hasShaderSource ? (
              <Badge variant="secondary" title={row.original.shaderFileName ?? undefined}>
                .frag
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-500">
                sem .frag
              </Badge>
            ))}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <span className="flex items-center gap-1">
        <ExtOutfitPreviewDialog
          initial={{ kind: row.original.kind, id: row.original.id }}
          trigger={
            <Button type="button" variant="ghost" size="icon-sm" title="Pré-visualizar em outfit">
              <Eye className="size-4" />
            </Button>
          }
        />
        <GeneratedCodeDialog
          title={`${EXTOUTFIT_KIND_LABELS[row.original.kind]} #${row.original.xmlId} — ${row.original.name}`}
          description="Linha do XML e os arquivos do registro conforme o tipo, com copiar e baixar no formato original."
          load={() => loadRowSections(row.original)}
          trigger={
            <Button type="button" variant="ghost" size="icon-sm" title="Gerar / ver arquivos">
              <FileCode className="size-4" />
            </Button>
          }
        />
        <RowActionsMenu>
          <DropdownMenuItem render={<Link href={`/admin/extoutfits/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <EntityImageUploadDialog
            entityType="extoutfit"
            id={row.original.id}
            name={row.original.name}
            image={images.get(row.original.id) ?? null}
            onUploaded={() => mutate()}
            trigger={
              <DropdownMenuItem>
                <ImageUp className="size-4" />
                Imagem / sprite
              </DropdownMenuItem>
            }
          />
          {row.original.files.map((file) => (
            <DropdownMenuItem
              key={file.part}
              render={
                <a href={`/api/admin/extoutfits/${row.original.id}/file?part=${file.part}`} download={file.fileName} />
              }
            >
              <Download className="size-4" />
              Baixar {file.fileName}
            </DropdownMenuItem>
          ))}
          <CopyXmlButton variant="menuitem" label="Copiar XML" getText={() => extOutfitToXml(row.original)} />
          <DropdownMenuItem
            onClick={() =>
              downloadText(
                extOutfitsToXmlDocument([row.original]),
                `${row.original.kind}_${row.original.xmlId}.xml`,
              )
            }
          >
            <Download className="size-4" />
            Baixar XML da linha
          </DropdownMenuItem>
          <DeleteRowMenuItem
            title="Remover registro"
            description="Esta ação não pode ser desfeita."
            confirmLabel="Remover"
            onConfirm={() => handleDelete(row.original.id)}
          />
        </RowActionsMenu>
        </span>
      ),
    },
  ];

  const scopeLabel = selectedCount > 0 ? `${selectedCount} selecionado(s)` : "todos";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Extoutfits</h1>
        <p className="text-muted-foreground">
          Wings, auras, shaders, health bars e mana bars do <code>data/XML/extoutfits.xml</code>.
          Wings e auras usam as looktypes do cadastro. Selecione registros para gerar o XML só deles.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por nome, id, looktype, shader ou imagem..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
        filters={filterFields}
        filterValues={table.draftFilters}
        onFilterValuesChange={table.setDraftFilters}
        onApplyFilters={table.applyFilters}
        onClearFilters={table.clearFilters}
        enableRowSelection
        rowSelection={selection.rowSelection}
        onRowSelectionChange={selection.onRowSelectionChange}
        getRowId={(row) => String(row.id)}
        manualPagination
        pageIndex={table.pageIndex}
        pageSize={table.pageSize}
        pageCount={data?.pageCount ?? 1}
        totalCount={data?.total}
        onPageChange={table.setPageIndex}
        onPageSizeChange={table.setPageSize}
        toolbar={
          <>
            {selectedCount > 0 && (
              <>
                <Button variant="ghost" onClick={selection.clearSelection}>
                  Limpar seleção
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive" disabled={isBulkDeleting}>
                      <Trash2 className="size-4" />
                      Excluir ({selectedCount})
                    </Button>
                  }
                  title="Excluir registros selecionados"
                  description={`Isso vai remover ${selectedCount} registro(s). As looktypes do cadastro são mantidas. Esta ação não pode ser desfeita.`}
                  confirmLabel="Excluir"
                  onConfirm={handleBulkDelete}
                />
              </>
            )}
            <XmlImportDialog
              endpoint="/api/admin/extoutfits/import"
              title="Importar extoutfits.xml"
              description={
                <>
                  Envie o <code>data/XML/extoutfits.xml</code> do servidor. As looktypes de wings e
                  auras são buscadas no cadastro de looktypes (tipo Outfit) pelo número e criadas
                  automaticamente quando não existirem.
                </>
              }
              replaceLabel="Substituir registros já cadastrados (mesmo tipo e id)"
              itemLabel="registro(s)"
              formatSuccess={(result) =>
                `${result.imported} registro(s) importado(s)` +
                (result.createdLooktypes ? `, ${result.createdLooktypes} looktype(s) criada(s)` : "") +
                (result.skipped ? `, ${result.skipped} ignorado(s)` : "") +
                "."
              }
              onImported={() => mutate()}
            />
            <MultiFileUploadDialog
              endpoint="/api/admin/extoutfits/shaders/upload"
              triggerLabel="Enviar shaders (.frag)"
              title="Enviar arquivos de shader"
              description={
                <>
                  Selecione os arquivos de <code>cliente/data/shaders</code>. Cada arquivo é casado
                  com o <code>shadername</code> pelo nome: <code>nome.frag</code> /{" "}
                  <code>nome_fragment.frag</code> = fragment, <code>nome_vertex.frag</code> = vertex.
                  Os arquivos base (<code>outfit_default_*</code>, <code>map_*</code>) são ignorados.
                </>
              }
              accept=".frag,.vert,.glsl"
              option={{ name: "createMissing", label: "Criar registro de shader para arquivos sem correspondência" }}
              formatResult={(result) => {
                const list = (key: string) => (result[key] as string[] | undefined) ?? [];
                return {
                  summary: `${list("matched").length} shader(s) atualizado(s), ${list("created").length} criado(s).`,
                  details: [
                    list("unmatched").length ? `Sem registro: ${list("unmatched").join(", ")}` : "",
                    list("ignored").length ? `Ignorados: ${list("ignored").join(", ")}` : "",
                    list("tooLarge").length ? `Maiores que 256KB: ${list("tooLarge").join(", ")}` : "",
                  ].filter(Boolean),
                };
              }}
              onUploaded={() => mutate()}
            />
            <MultiFileUploadDialog
              endpoint="/api/admin/extoutfits/images/bulk"
              triggerLabel="Enviar imagens de barras"
              title="Enviar imagens de health/mana bars"
              description={
                <>
                  Selecione os PNGs de <code>cliente/data/images/bars</code>. Cada arquivo vira a imagem
                  de todos os registros cujo <code>image</code> termina no mesmo nome (ex.:{" "}
                  <code>Akatsuki.png</code> → <code>/images/bars/Akatsuki</code>).
                </>
              }
              accept=".png,.gif"
              formatResult={(result) => {
                const unmatched = (result.unmatched as string[] | undefined) ?? [];
                const invalid = (result.invalid as string[] | undefined) ?? [];
                return {
                  summary: `${result.matchedFiles} arquivo(s) aplicados em ${result.updatedRecords} registro(s).`,
                  details: [
                    unmatched.length ? `Sem registro: ${unmatched.join(", ")}` : "",
                    invalid.length ? `Inválidos/grandes demais: ${invalid.join(", ")}` : "",
                  ].filter(Boolean),
                };
              }}
              onUploaded={() => mutate()}
            />
            <ExtOutfitPreviewButton />
            <GeneratedCodeDialog
              title={`Gerar extoutfits.xml (${scopeLabel})`}
              description="Copie o conteúdo ou baixe o arquivo para data/XML/extoutfits.xml. O pacote .zip traz o XML e os arquivos de cada registro (.frag, imagens das barras, texturas) na estrutura do servidor/cliente."
              load={loadXml}
              actions={
                <Button
                  type="button"
                  nativeButton={false}
                  render={
                    <a
                      href={`/api/admin/extoutfits/bundle${selectedCount > 0 ? `?ids=${[...selection.selectedIds].join(",")}` : ""}`}
                      download="extoutfits_bundle.zip"
                    />
                  }
                >
                  <FileArchive className="size-4" />
                  Baixar pacote .zip ({scopeLabel})
                </Button>
              }
              trigger={
                <Button variant="outline">
                  <FileCode className="size-4" />
                  Gerar XML ({scopeLabel})
                </Button>
              }
            />
            <Button nativeButton={false} render={<Link href="/admin/extoutfits/new" />}>
              <Plus className="size-4" />
              Novo registro
            </Button>
          </>
        }
      />
    </div>
  );
}
