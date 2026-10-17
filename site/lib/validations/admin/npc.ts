import { z } from "zod";

export const NPC_TYPES = ["shop", "quest", "misc"] as const;
export type NpcType = (typeof NPC_TYPES)[number];

export const NPC_SHOP_DIRECTIONS = ["buy", "sell"] as const;
export type NpcShopDirection = (typeof NPC_SHOP_DIRECTIONS)[number];

export const npcShopItemSchema = z.object({
  /** `null` enquanto o admin ainda não escolheu compra/venda — só depois disso os campos de
   * item/valor aparecem no formulário (linha incompleta é descartada ao salvar). */
  direction: z.enum(NPC_SHOP_DIRECTIONS).nullable(),
  itemId: z.number().int().positive().nullable(),
  name: z.string(),
  valueCrystal: z.number().min(0),
});

export const npcCustomMessageSchema = z.object({
  text: z.string().min(1, "Informe a mensagem").max(255),
  /** Intervalo mínimo entre tentativas de falar essa mensagem. */
  intervalMs: z.number().int().min(1000),
  /** Chance (%) de falar a mensagem a cada intervalo decorrido. */
  chance: z.number().int().min(1).max(100),
});

/** Mensagens padrão nativas do XML (`<parameter key="message_x" value="..." />`, lidas por
 * `NpcSystem.parseParameters` em `data/npc/lib/npcsystem/main.lua`) — mostradas independente do
 * Tipo do NPC, mas só as de categoria "general" viram `npcHandler:setMessage(...)` no script
 * gerado pra NPCs quest/misc (as de categoria "shop" só fazem sentido no módulo de loja nativo,
 * que só existe pra NPCs do tipo Loja). */
export const NPC_DEFAULT_MESSAGE_KEYS = [
  {
    key: "message_greet",
    label: "Saudação (greet)",
    category: "general",
    description: "Dita quando o jogador inicia conversa com o NPC (ex.: diz \"hi\") — abre o foco de diálogo.",
  },
  {
    key: "message_farewell",
    label: "Despedida (farewell)",
    category: "general",
    description: "Dita quando o jogador se despede (\"bye\") ou a conversa é encerrada normalmente.",
  },
  {
    key: "message_decline",
    label: "Recusa (decline)",
    category: "general",
    description: "Dita quando o jogador responde \"no\" a uma pergunta feita pelo NPC.",
  },
  {
    key: "message_walkaway",
    label: "Jogador se afastou (walkaway)",
    category: "general",
    description: "Dita quando o jogador se afasta da área de alcance do NPC no meio da conversa, encerrando o foco.",
  },
  {
    key: "message_idletimeout",
    label: "Tempo ocioso (idletimeout)",
    category: "general",
    description: "Dita quando o jogador fica muito tempo sem responder durante a conversa — o NPC encerra o foco por inatividade.",
  },
  {
    key: "message_alreadyfocused",
    label: "Já em conversa (alreadyfocused)",
    category: "general",
    description: "Dita para outro jogador que tenta falar com o NPC enquanto ele já está em conversa com alguém.",
  },
  {
    key: "message_placedinqueue",
    label: "Colocado na fila (placedinqueue)",
    category: "general",
    description: "Dita quando o jogador é colocado numa fila de espera para falar com o NPC (vários jogadores tentando interagir ao mesmo tempo).",
  },
  {
    key: "message_sendtrade",
    label: "Abrir negociação (sendtrade)",
    category: "shop",
    description: "Dita ao abrir a janela de compra/venda (módulo de loja nativo).",
  },
  {
    key: "message_noshop",
    label: "Sem itens à venda (noshop)",
    category: "shop",
    description: "Dita quando o jogador tenta abrir a loja, mas o NPC não tem nenhum item configurado para comprar/vender.",
  },
  {
    key: "message_oncloseshop",
    label: "Fechar loja (oncloseshop)",
    category: "shop",
    description: "Dita quando o jogador fecha a janela de loja.",
  },
  {
    key: "message_onbuy",
    label: "Ao comprar (onbuy)",
    category: "shop",
    description: "Dita quando o jogador seleciona um item para comprar, antes de confirmar.",
  },
  {
    key: "message_onsell",
    label: "Ao vender (onsell)",
    category: "shop",
    description: "Dita quando o jogador seleciona um item para vender, antes de confirmar.",
  },
  {
    key: "message_missingmoney",
    label: "Dinheiro insuficiente (missingmoney)",
    category: "shop",
    description: "Dita quando o jogador tenta comprar mas não tem dinheiro suficiente para concluir a compra.",
  },
  {
    key: "message_needmoney",
    label: "Precisa de dinheiro (needmoney)",
    category: "shop",
    description: "Aviso alternativo de que o jogador precisa de mais dinheiro para a compra (variante do módulo de loja nativo).",
  },
  {
    key: "message_missingitem",
    label: "Item insuficiente (missingitem)",
    category: "shop",
    description: "Dita quando o jogador tenta vender um item que ele não possui na quantidade informada.",
  },
  {
    key: "message_needitem",
    label: "Precisa do item (needitem)",
    category: "shop",
    description: "Aviso alternativo de que falta o item para concluir a venda (variante do módulo de loja nativo).",
  },
  {
    key: "message_needmorespace",
    label: "Precisa de mais espaço (needmorespace)",
    category: "shop",
    description: "Dita quando o jogador não tem espaço/capacidade suficiente no inventário para receber o item comprado.",
  },
  {
    key: "message_needspace",
    label: "Precisa de espaço (needspace)",
    category: "shop",
    description: "Aviso alternativo de espaço insuficiente no inventário (variante do módulo de loja nativo).",
  },
  {
    key: "message_buy",
    label: "Confirmar compra (buy)",
    category: "shop",
    description: "Mensagem de confirmação dita ao concluir uma compra (geralmente cita o item e o valor pago).",
  },
  {
    key: "message_sell",
    label: "Confirmar venda (sell)",
    category: "shop",
    description: "Mensagem de confirmação dita ao concluir uma venda (geralmente cita o item e o valor recebido).",
  },
  {
    key: "message_bought",
    label: "Compra concluída (bought)",
    category: "shop",
    description: "Dita logo após a compra ser efetivada com sucesso.",
  },
  {
    key: "message_sold",
    label: "Venda concluída (sold)",
    category: "shop",
    description: "Dita logo após a venda ser efetivada com sucesso.",
  },
] as const;
export type NpcDefaultMessageKey = (typeof NPC_DEFAULT_MESSAGE_KEYS)[number]["key"];

export const npcDefaultMessagesSchema = z.record(z.string(), z.string());
export type NpcDefaultMessagesInput = z.infer<typeof npcDefaultMessagesSchema>;

export const npcSchema = z.object({
  name: z
    .string()
    .min(1, "Informe o nome")
    .max(255)
    .refine((value) => !/\d/.test(value), { message: "O nome não pode conter números" }),
  lookTypeId: z.number().int().positive(),
  type: z.enum(NPC_TYPES),
  town: z.string().max(100),
  posX: z.number().int(),
  posY: z.number().int(),
  posZ: z.number().int(),
  direction: z.number().int().min(0).max(3),
  walkinterval: z.number().int().min(0),
  lookHead: z.number().int().min(0).max(132),
  lookBody: z.number().int().min(0).max(132),
  lookLegs: z.number().int().min(0).max(132),
  lookFeet: z.number().int().min(0).max(132),
  lookAddons: z.number().int().min(0).max(3),
  shopItems: z.array(npcShopItemSchema),
  /** Script Lua vinculado (cadastro de Script Lua, categoria "npc") — ignorado para "shop". */
  scriptId: z.number().int().nullable(),
  /** Categoria organizacional (cadastro de `NpcCategory`) — puramente do admin, não existe no
   * XML nativo do OTServer. */
  categoryId: z.number().int().nullable(),
  /** Falas ambiente geradas no script padrão — ignoradas quando `scriptId` está vinculado
   * (o script do admin tem prioridade e não é sobrescrito). */
  customMessages: z.array(npcCustomMessageSchema),
  /** Mensagens padrão do XML nativo (ver `NPC_DEFAULT_MESSAGE_KEYS`) — chave só entra no
   * XML/script gerado quando o valor não é vazio. */
  defaultMessages: npcDefaultMessagesSchema,
  published: z.boolean(),
}).superRefine((data, ctx) => {
  // Mesmo item não pode aparecer 2x na mesma direção (buy/sell) — categorias diferentes podem
  // repetir o mesmo item (ex.: comprar E vender a mesma poção). Rede de segurança: a UI
  // (`NpcShopItemListField`) já impede escolher um item repetido ao selecionar.
  const seen = new Map<string, number>();
  data.shopItems.forEach((item, index) => {
    if (!item.direction || !item.itemId) return;
    const key = `${item.direction}:${item.itemId}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: ["shopItems", index, "itemId"],
        message: `Este item já está cadastrado em ${item.direction === "buy" ? "Compra" : "Venda"}.`,
      });
    } else {
      seen.set(key, index);
    }
  });
});

/** Mapeia uma linha do banco (`prisma.npc.findUnique`/reconciliada por `reconcileNpcFromDisk`)
 * pro formato de formulário — usado pela página de edição pra montar `initialValues`. */
export function toNpcInput(npc: {
  name: string;
  lookTypeId: number;
  type: string;
  town: string;
  posX: number;
  posY: number;
  posZ: number;
  direction: number;
  walkinterval: number;
  lookHead: number;
  lookBody: number;
  lookLegs: number;
  lookFeet: number;
  lookAddons: number;
  shopItems: unknown;
  scriptId: number | null;
  categoryId: number | null;
  customMessages: unknown;
  defaultMessages: unknown;
  published: boolean;
}): NpcInput {
  return {
    name: npc.name,
    lookTypeId: npc.lookTypeId,
    type: npc.type as NpcInput["type"],
    town: npc.town,
    posX: npc.posX,
    posY: npc.posY,
    posZ: npc.posZ,
    direction: npc.direction,
    walkinterval: npc.walkinterval,
    lookHead: npc.lookHead,
    lookBody: npc.lookBody,
    lookLegs: npc.lookLegs,
    lookFeet: npc.lookFeet,
    lookAddons: npc.lookAddons,
    shopItems: normalizeShopItems(npc.shopItems),
    scriptId: npc.scriptId,
    categoryId: npc.categoryId,
    customMessages: normalizeCustomMessages(npc.customMessages),
    defaultMessages: normalizeDefaultMessages(npc.defaultMessages),
    published: npc.published,
  };
}

export type NpcInput = z.infer<typeof npcSchema>;
export type NpcShopItemInput = z.infer<typeof npcShopItemSchema>;
export type NpcCustomMessageInput = z.infer<typeof npcCustomMessageSchema>;

/** Converte o formato legado (`buyPriceCrystal`/`sellPriceCrystal` na mesma linha) pro novo
 * formato (uma linha por direção) — preserva dados de NPCs salvos antes dessa mudança. */
export function normalizeShopItems(raw: unknown): NpcShopItemInput[] {
  const rows = Array.isArray(raw) ? raw : [];
  const result: NpcShopItemInput[] = [];

  for (const row of rows as Record<string, unknown>[]) {
    if (row.direction === "buy" || row.direction === "sell") {
      result.push({
        direction: row.direction,
        itemId: typeof row.itemId === "number" ? row.itemId : null,
        name: typeof row.name === "string" ? row.name : "",
        valueCrystal: typeof row.valueCrystal === "number" ? row.valueCrystal : 0,
      });
      continue;
    }

    const itemId = typeof row.itemId === "number" ? row.itemId : null;
    const name = typeof row.name === "string" ? row.name : "";
    const buyPrice = typeof row.buyPriceCrystal === "number" ? row.buyPriceCrystal : 0;
    const sellPrice = typeof row.sellPriceCrystal === "number" ? row.sellPriceCrystal : 0;

    if (buyPrice > 0) result.push({ direction: "buy", itemId, name, valueCrystal: buyPrice });
    if (sellPrice > 0) result.push({ direction: "sell", itemId, name, valueCrystal: sellPrice });
  }

  return result;
}

/** Normaliza o JSON salvo (`Npc.defaultMessages`) pro formato do formulário — tolera `null`
 * (NPCs criados antes desse campo existir) e descarta chaves desconhecidas/malformadas. */
export function normalizeDefaultMessages(raw: unknown): NpcDefaultMessagesInput {
  if (raw == null || typeof raw !== "object") return {};

  const validKeys = new Set<string>(NPC_DEFAULT_MESSAGE_KEYS.map((entry) => entry.key));
  const result: NpcDefaultMessagesInput = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (validKeys.has(key) && typeof value === "string" && value.length > 0) {
      result[key] = value;
    }
  }

  return result;
}

/** Normaliza o JSON salvo (`Npc.customMessages`) pro formato do formulário — tolera `null`
 * (NPCs criados antes desse campo existir) e linhas malformadas. */
export function normalizeCustomMessages(raw: unknown): NpcCustomMessageInput[] {
  const rows = Array.isArray(raw) ? raw : [];
  const result: NpcCustomMessageInput[] = [];

  for (const row of rows as Record<string, unknown>[]) {
    if (typeof row.text !== "string" || !row.text) continue;
    result.push({
      text: row.text,
      intervalMs: typeof row.intervalMs === "number" ? row.intervalMs : 30000,
      chance: typeof row.chance === "number" ? row.chance : 100,
    });
  }

  return result;
}
