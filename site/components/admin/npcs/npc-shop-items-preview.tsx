import { normalizeShopItems, type NpcShopDirection, type NpcShopItemInput } from "@/lib/validations/admin/npc";
import { EntityThumb } from "@/components/shared/entity-thumb";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MAX_VISIBLE = 5;

/** Preview em miniatura dos itens de compra/venda de um NPC, usado nas colunas "Compra"/"Venda"
 * da listagem — mostra até `MAX_VISIBLE` sprites e um badge "+N" pro restante. Normaliza via
 * `normalizeShopItems` porque a API de listagem retorna o JSON cru (inclui NPCs salvos no
 * formato legado, uma linha por item com buyPriceCrystal/sellPriceCrystal). */
export function NpcShopItemsPreview({
  items,
  direction,
}: {
  items: unknown;
  direction: NpcShopDirection;
}) {
  const filtered = normalizeShopItems(items).filter(
    (item): item is NpcShopItemInput => item.direction === direction && Boolean(item.itemId),
  );

  if (filtered.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const visible = filtered.slice(0, MAX_VISIBLE);
  const rest = filtered.slice(MAX_VISIBLE);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((item, index) => (
        <EntityThumb key={`${item.itemId}-${index}`} entityType="item" id={item.itemId as number} name={item.name} size="sm" />
      ))}
      {rest.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="flex size-6 shrink-0 cursor-default items-center justify-center rounded-sm border border-dashed border-border text-[11px] text-muted-foreground">
                  +{rest.length}
                </span>
              }
            />
            <TooltipContent className="max-h-[90vh] max-w-[320px] overflow-y-auto">
              <ul className="grid grid-cols-3 gap-2">
                {rest.map((item, index) => (
                  <li key={`${item.itemId}-${index}`} className="flex flex-col items-center gap-1 text-center">
                    <EntityThumb entityType="item" id={item.itemId as number} name={item.name} size="sm" zoomOnHover={false} />
                    <span className="line-clamp-2 text-[11px] leading-tight">{item.name || `Item #${item.itemId}`}</span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
