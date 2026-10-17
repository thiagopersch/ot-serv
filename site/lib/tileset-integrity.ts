import { prisma } from "@/lib/prisma";
import {
  categoryTypeForKind,
  DOODAD_KINDS,
  TERRAIN_KINDS,
  type TilesetCategoryKind,
  type TilesetCategoryType,
} from "@/lib/validations/admin/tileset";
import { hasDuplicateName } from "@/lib/unique-name";

/** Erro de integridade de domínio (nome duplicado, exclusão bloqueada por vínculos,
 * etc.) — rotas de API capturam isso e traduzem para o `status` HTTP indicado. */
export class TilesetIntegrityError extends Error {
  status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.name = "TilesetIntegrityError";
    this.status = status;
  }
}

export async function assertUniqueTilesetName(name: string, excludeId?: number): Promise<void> {
  const existingNames = await prisma.tileset.findMany({ select: { id: true, name: true } });
  if (hasDuplicateName(existingNames, name, excludeId)) {
    throw new TilesetIntegrityError(`Já existe um tileset chamado "${name}".`);
  }
}

/** Bloqueia a exclusão de um Tileset se ele ainda tiver categorias, a menos que
 * `moveCategoriesTo` aponte para outro tileset válido para onde elas serão movidas. */
export async function assertTilesetDeletable(tilesetId: number, moveCategoriesTo?: number): Promise<void> {
  const categoryCount = await prisma.tilesetCategory.count({ where: { tilesetId } });
  if (categoryCount === 0) return;

  if (moveCategoriesTo == null) {
    throw new TilesetIntegrityError(
      `Este tileset tem ${categoryCount} categoria(s) vinculada(s). Mova-as para outro tileset antes de excluir (parâmetro moveCategoriesTo).`
    );
  }

  if (moveCategoriesTo === tilesetId) {
    throw new TilesetIntegrityError("moveCategoriesTo não pode ser o próprio tileset sendo excluído.", 400);
  }

  const target = await prisma.tileset.findUnique({ where: { id: moveCategoriesTo }, select: { id: true } });
  if (!target) {
    throw new TilesetIntegrityError(`Tileset de destino (moveCategoriesTo=${moveCategoriesTo}) não encontrado.`, 404);
  }
}

/** Move todas as categorias de um tileset para outro (usado antes de excluir o de origem). */
export async function reassignTilesetCategories(fromTilesetId: number, toTilesetId: number): Promise<void> {
  await prisma.tilesetCategory.updateMany({
    where: { tilesetId: fromTilesetId },
    data: { tilesetId: toTilesetId },
  });
}

/** Bloqueia a exclusão de uma Categoria se ela ainda tiver brushes (Ground/WallBrush/
 * DoodadBrush) ou `TilesetItemEntry` vinculados, a menos que `moveEntriesTo` aponte
 * para outra categoria de `type` compatível para onde tudo será movido. */
export async function assertCategoryDeletable(categoryId: number, moveEntriesTo?: number): Promise<void> {
  const [groundCount, wallCount, doodadCount, itemEntryCount] = await Promise.all([
    prisma.ground.count({ where: { tilesetCategoryId: categoryId } }),
    prisma.wallBrush.count({ where: { tilesetCategoryId: categoryId } }),
    prisma.doodadBrush.count({ where: { tilesetCategoryId: categoryId } }),
    prisma.tilesetItemEntry.count({ where: { categoryId } }),
  ]);
  const total = groundCount + wallCount + doodadCount + itemEntryCount;
  if (total === 0) return;

  if (moveEntriesTo == null) {
    throw new TilesetIntegrityError(
      `Esta categoria tem ${total} brush(es)/item(ns) vinculado(s). Mova-os para outra categoria antes de excluir (parâmetro moveEntriesTo).`
    );
  }

  if (moveEntriesTo === categoryId) {
    throw new TilesetIntegrityError("moveEntriesTo não pode ser a própria categoria sendo excluída.", 400);
  }

  const source = await prisma.tilesetCategory.findUnique({ where: { id: categoryId }, select: { type: true } });
  const target = await prisma.tilesetCategory.findUnique({ where: { id: moveEntriesTo }, select: { id: true, type: true } });
  if (!target) {
    throw new TilesetIntegrityError(`Categoria de destino (moveEntriesTo=${moveEntriesTo}) não encontrada.`, 404);
  }
  if (source && source.type !== target.type) {
    throw new TilesetIntegrityError(
      `A categoria de destino é do tipo ${target.type}, mas a de origem é ${source.type} — mova para uma categoria do mesmo tipo.`,
      400
    );
  }
}

/** Move todos os brushes e entradas de item de uma categoria para outra (usado antes
 * de excluir a de origem). */
export async function reassignCategoryEntries(fromCategoryId: number, toCategoryId: number): Promise<void> {
  await Promise.all([
    prisma.ground.updateMany({ where: { tilesetCategoryId: fromCategoryId }, data: { tilesetCategoryId: toCategoryId } }),
    prisma.wallBrush.updateMany({ where: { tilesetCategoryId: fromCategoryId }, data: { tilesetCategoryId: toCategoryId } }),
    prisma.doodadBrush.updateMany({ where: { tilesetCategoryId: fromCategoryId }, data: { tilesetCategoryId: toCategoryId } }),
    prisma.tilesetItemEntry.updateMany({ where: { categoryId: fromCategoryId }, data: { categoryId: toCategoryId } }),
  ]);
}

/** Garante que `type` bate com `kind` e que o kind é compatível com o brush type que
 * a rota está tentando vincular (Ground/WallBrush -> TERRAIN*, DoodadBrush -> qualquer
 * kind BRUSH — o RME já mistura brushes de doodads.xml dentro de tags `terrain`/
 * `terrain_and_raw`, ex.: a tileset "City Carpets" do arquivo de referência). */
export function assertCategoryKindMatchesBrushKind(kind: TilesetCategoryKind, brushKind: "terrain" | "doodad"): void {
  if (categoryTypeForKind(kind) !== "BRUSH") {
    throw new TilesetIntegrityError(`A categoria selecionada não é do tipo Brush (kind=${kind}).`, 400);
  }
  const allowed = brushKind === "terrain" ? TERRAIN_KINDS : [...TERRAIN_KINDS, ...DOODAD_KINDS];
  if (!allowed.includes(kind)) {
    throw new TilesetIntegrityError(
      `Categoria incompatível: brushes de ${brushKind === "terrain" ? "Ground/Wall" : "Doodad"} exigem kind ${allowed.join(" ou ")}.`,
      400
    );
  }
}

/** Valida (buscando no banco) que `categoryId` existe e é uma categoria BRUSH
 * compatível com o tipo de brush (`terrain` para Ground/Wall, `doodad` para Doodad —
 * este último aceita qualquer categoria BRUSH, terrain ou doodad). `null`/`undefined`
 * é sempre aceito (brush fica sem categoria). */
export async function assertCategoryForBrush(categoryId: number | null | undefined, brushKind: "terrain" | "doodad"): Promise<void> {
  if (categoryId == null) return;

  const category = await prisma.tilesetCategory.findUnique({ where: { id: categoryId }, select: { kind: true } });
  if (!category) {
    throw new TilesetIntegrityError(`Categoria de tileset (id=${categoryId}) não encontrada.`, 404);
  }

  assertCategoryKindMatchesBrushKind(category.kind as TilesetCategoryKind, brushKind);
}

export type ResolvedBrushRef =
  | { found: true; kind: "ground" | "wall" | "doodad"; id: number }
  | { found: false };

/** Resolve `<brush name="x">` importado de `tilesets.xml` contra Ground/WallBrush/
 * DoodadBrush, por nome exato. Nomes de brush são um namespace global único no RME —
 * um `terrain`/`terrain_and_raw` pode referenciar um brush registrado como
 * `type="carpet"` em `doodads.xml` (ex.: a tileset "City Carpets" do arquivo de
 * referência faz isso) — então a busca tenta primeiro a tabela "natural" do `kind` e
 * cai para as outras duas como fallback, em vez de restringir por kind. */
export async function resolveBrushName(name: string, categoryType: TilesetCategoryType, kind: TilesetCategoryKind): Promise<ResolvedBrushRef> {
  if (categoryType !== "BRUSH") return { found: false };

  const order: ("ground" | "wall" | "doodad")[] = TERRAIN_KINDS.includes(kind)
    ? ["ground", "wall", "doodad"]
    : ["doodad", "ground", "wall"];

  for (const brushKind of order) {
    if (brushKind === "ground") {
      const ground = await prisma.ground.findFirst({ where: { name }, select: { id: true } });
      if (ground) return { found: true, kind: "ground", id: ground.id };
    } else if (brushKind === "wall") {
      const wall = await prisma.wallBrush.findFirst({ where: { name }, select: { id: true } });
      if (wall) return { found: true, kind: "wall", id: wall.id };
    } else {
      const doodad = await prisma.doodadBrush.findFirst({ where: { name }, select: { id: true } });
      if (doodad) return { found: true, kind: "doodad", id: doodad.id };
    }
  }

  return { found: false };
}
