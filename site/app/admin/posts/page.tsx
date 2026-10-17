"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";

import { fetcher } from "@/lib/fetcher";
import type { Post } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/pagination";
import { POST_PAGES, defaultPostContent } from "@/lib/validations/admin/post";
import { useServerTable } from "@/hooks/use-server-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActionsMenu, DeleteRowMenuItem } from "@/components/shared/row-actions-menu";
import { EntityThumb } from "@/components/shared/entity-thumb";
import type { EntityImageInfo } from "@/components/shared/use-entity-images";

type PostRow = Post & { image: EntityImageInfo | null };

const PAGE_LABELS = Object.fromEntries(POST_PAGES.map((p) => [p.value, p.label]));

export default function AdminPostsPage() {
  const router = useRouter();
  const table = useServerTable();
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading, isValidating, mutate } = useSWR<PaginatedResult<PostRow>>(
    `/api/admin/posts?${table.buildQueryParams().toString()}`,
    fetcher
  );

  async function handleCreate() {
    setIsCreating(true);
    const response = await fetch("/api/admin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Novo post",
        slug: `novo-post-${Date.now()}`,
        page: "home",
        excerpt: null,
        content: defaultPostContent,
        published: false,
      }),
    });
    setIsCreating(false);

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      toast.error(errData?.error ?? "Não foi possível criar o post.");
      return;
    }

    const responseData = await response.json();
    router.push(`/admin/posts/${responseData.post.id}`);
  }

  async function handleDelete(id: number) {
    const response = await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Não foi possível remover o post.");
      return;
    }

    toast.success("Post removido.");
    mutate();
  }

  const columns: ColumnDef<PostRow>[] = [
    {
      id: "image",
      header: "Imagem",
      cell: ({ row }) => (
        <EntityThumb entityType="post" id={row.original.id} name={row.original.title} image={row.original.image} />
      ),
    },
    { accessorKey: "title", header: "Título" },
    { accessorKey: "slug", header: "Slug" },
    {
      accessorKey: "page",
      header: "Página",
      cell: ({ row }) => PAGE_LABELS[row.original.page] ?? row.original.page,
    },
    {
      accessorKey: "published",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.published ? "default" : "secondary"}>
          {row.original.published ? "Publicado" : "Rascunho"}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Criado em",
      cell: ({ row }) => dayjs(row.original.createdAt).format("DD/MM/YYYY HH:mm"),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem render={<a href={`/admin/posts/${row.original.id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DeleteRowMenuItem
            title="Remover post"
            description="Esta ação não pode ser desfeita."
            confirmLabel="Remover"
            onConfirm={() => handleDelete(row.original.id)}
          />
        </RowActionsMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Posts</h1>
          <p className="text-muted-foreground">Conteúdo exibido nas páginas públicas do site.</p>
        </div>
        <Button onClick={handleCreate} disabled={isCreating}>
          <Plus className="size-4" />
          Novo post
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isFiltering={!isLoading && isValidating}
        searchPlaceholder="Buscar por título..."
        searchValue={table.searchInput}
        onSearchChange={table.handleSearchChange}
        manualPagination
        pageIndex={table.pageIndex}
        pageSize={table.pageSize}
        pageCount={data?.pageCount ?? 1}
        totalCount={data?.total}
        onPageChange={table.setPageIndex}
        onPageSizeChange={table.setPageSize}
      />
    </div>
  );
}
