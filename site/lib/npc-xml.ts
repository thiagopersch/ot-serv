import { NPC_DEFAULT_MESSAGE_KEYS, type NpcDefaultMessagesInput, type NpcInput } from "@/lib/validations/admin/npc";

/** 1 crystal coin = 10000 gold coin — mesma conversão usada em data/lib/autoloot_lib.lua. */
const GOLD_PER_CRYSTAL = 10000;

const DEFAULT_GREET = "Hello, |PLAYERNAME|! Say {trade} to see my wares.";

/** `message_x` -> `MESSAGE_X` (constante esperada por `npcHandler:setMessage`). */
function messageKeyToConstant(key: string): string {
  return `MESSAGE_${key.slice("message_".length).toUpperCase()}`;
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildShopList(items: NpcInput["shopItems"], direction: "buy" | "sell"): string {
  const lines = items
    .filter((item) => item.direction === direction && item.itemId != null && item.valueCrystal > 0)
    .map((item) => `${item.name},${item.itemId},${Math.round(item.valueCrystal * GOLD_PER_CRYSTAL)}`);

  return lines.join(";\n               ");
}

/** Nome do arquivo `.lua` referenciado pelo atributo `script=` do XML (e gravado em disco por
 * `writeNpcFiles`). Com `scriptId` vinculado, usa o nome real do `LuaScript` selecionado no
 * combobox (`linkedScriptName`) — não o nome do NPC — pra que o atributo reflita exatamente o
 * arquivo escolhido pelo admin. Sem `scriptId`: Loja usa o `default.lua` de estoque do servidor;
 * Quest/Outro usa um `.lua` autogerado com o nome do próprio NPC (`ownScriptFile`). Exportada
 * pra ser reaproveitada por `lib/npc-generator.ts` (mesma regra pro caminho físico do arquivo). */
export function resolveScriptFile(
  npc: Pick<NpcInput, "type" | "scriptId">,
  linkedScriptName: string | null | undefined,
  ownScriptFile: string,
): string {
  if (npc.scriptId) return linkedScriptName ?? ownScriptFile;
  return npc.type === "shop" ? "default.lua" : ownScriptFile;
}

/** Montagem pura do XML (sem I/O) — usada tanto na pré-visualização client-side (`NpcForm`)
 * quanto na gravação real dos arquivos (`lib/npc-generator.ts`).
 * @param looktypeNumber Número da sprite no Object Builder (`Looktype.looktypeNumber`) — não
 * confundir com `npc.lookTypeId`, que é o id do registro no cadastro de looktypes. O jogo/client
 * lê `type=` como esse número, então usar o id do registro faria o NPC aparecer com o outfit
 * errado (mesmo padrão de `looktypeNumber` em `monster-xml.ts`/`monsterToXml`). */
export function buildNpcXml(
  npc: NpcInput,
  looktypeNumber: number | null = null,
  linkedScriptName: string | null = null,
): string {
  const name = xmlEscape(npc.name);
  const lookType = looktypeNumber ?? 0;
  const isShop = npc.type === "shop";
  const messages = npc.defaultMessages ?? {};
  /** Confirmado direto no motor (`server/src/source/npc.cpp` + `NpcSystem.parseParameters` em
   * `server/data/npc/lib/npcsystem/main.lua`): `<parameter key="message_x">` não é exclusivo do
   * módulo de loja — todo `.lua` que chama `NpcSystem.parseParameters(npcHandler)` (gerado ou
   * customizado) lê essas chaves do XML incondicionalmente, independente de `module_shop`. Por
   * isso o bloco de mensagens sai igual pra Loja e Quest/Outro; só os parâmetros de loja em si
   * (`module_shop`/`shop_buyable`/`shop_sellable`) continuam exclusivos do tipo "shop". */
  const greet = xmlEscape(messages.message_greet || (isShop ? DEFAULT_GREET : "Hello, |PLAYERNAME|!"));
  const extraMessageParams = NPC_DEFAULT_MESSAGE_KEYS.filter((entry) => entry.key !== "message_greet")
    .filter((entry) => messages[entry.key])
    .map((entry) => `\n      <parameter key="${entry.key}" value="${xmlEscape(messages[entry.key])}" />`)
    .join("");
  /** Loja sem script vinculado usa o `default.lua` de estoque do servidor (módulo de loja
   * nativo); com `scriptId`, referencia o `.lua` do script vinculado — nesse caso o script do
   * admin é responsável por chamar `NpcSystem.parseParameters(npcHandler)` (e, se for loja,
   * adicionar o `ShopModule`) pra manter tudo funcionando. */
  const scriptFile = resolveScriptFile(npc, linkedScriptName, `${name}.lua`);

  const shopParams = isShop
    ? (() => {
        const buyable = buildShopList(npc.shopItems, "buy");
        const sellable = buildShopList(npc.shopItems, "sell");
        return `\n      <parameter key="module_shop" value="1" />${buyable ? `\n      <parameter key="shop_buyable" value="\n               ${buyable}" />` : ""}${sellable ? `\n      <parameter key="shop_sellable" value="\n               ${sellable}" />` : ""}`;
      })()
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<npc name="${name}" script="${scriptFile}" walkinterval="${npc.walkinterval}" floorchange="0">
   <health now="100" max="100" />
   <look type="${lookType}" head="${npc.lookHead}" body="${npc.lookBody}" legs="${npc.lookLegs}" feet="${npc.lookFeet}" addons="${npc.lookAddons}" />
   <parameters>${shopParams}
      <parameter key="message_greet" value="${greet}" />${extraMessageParams}
   </parameters>
</npc>
`;
}

/** NPC precisa de um `.lua` próprio gravado em disco — mesma condição usada por `writeNpcFiles`
 * (`lib/npc-generator.ts`) e pelo painel de pré-visualização do script em `NpcForm`: todo NPC
 * não-Loja tem um `.lua` (vinculado ou autogerado), e uma Loja só tem quando vincula um script
 * customizado (sem isso, usa o `default.lua` de estoque do servidor, sem arquivo próprio). */
export function needsOwnScript(npc: Pick<NpcInput, "type" | "scriptId">): boolean {
  return npc.type !== "shop" || npc.scriptId != null;
}

/** Conteúdo do `.lua` que será gravado em `data/npc/scripts/` — mesma regra usada por
 * `writeNpcFiles` (`lib/npc-generator.ts`), extraída aqui pra ser reaproveitada também no
 * preview client-side (`NpcForm`) sem duplicar a lógica. Com `scriptId` vinculado, o conteúdo do
 * script escolhido é usado *verbatim* — nesse caso as "Mensagens padrão" (`defaultMessages`) e
 * "Falas ambiente" (`customMessages`) configuradas no formulário não têm efeito nenhum, já que
 * `buildDefaultNpcScript`/`buildNpcScriptWithMessages` nem chegam a ser chamadas. */
export function resolveScriptContent(
  npc: Pick<NpcInput, "type" | "scriptId" | "customMessages" | "defaultMessages">,
  linkedScriptContent: string | null | undefined,
): string {
  if (npc.scriptId) return linkedScriptContent ?? "";
  if (npc.type === "shop") return "";
  return npc.customMessages.length > 0
    ? buildNpcScriptWithMessages(npc.customMessages, npc.defaultMessages)
    : buildDefaultNpcScript(npc.defaultMessages);
}

function luaStringLiteral(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Linhas `npcHandler:setMessage(MESSAGE_X, "...")` pras mensagens de categoria "general"
 * (as únicas que fazem sentido fora do módulo de loja nativo) — greet/farewell sempre saem
 * (com fallback quando não customizados), as demais só quando o admin preencheu um valor. */
function buildSetMessageLines(defaultMessages: NpcDefaultMessagesInput): string {
  const greet = defaultMessages.message_greet || "Hello, |PLAYERNAME|!";
  const farewell = defaultMessages.message_farewell || "Farewell!";

  const extraLines = NPC_DEFAULT_MESSAGE_KEYS.filter((entry) => entry.category === "general")
    .filter((entry) => entry.key !== "message_greet" && entry.key !== "message_farewell")
    .filter((entry) => defaultMessages[entry.key])
    .map(
      (entry) =>
        `npcHandler:setMessage(${messageKeyToConstant(entry.key)}, ${luaStringLiteral(defaultMessages[entry.key])})`,
    );

  return [
    `npcHandler:setMessage(MESSAGE_GREET, ${luaStringLiteral(greet)})`,
    `npcHandler:setMessage(MESSAGE_FAREWELL, ${luaStringLiteral(farewell)})`,
    ...extraLines,
  ].join("\n");
}

/** Script padrão (sem falas ambiente) — usado quando o NPC não tem Script Lua próprio
 * vinculado (`scriptId`) nem falas ambiente configuradas. */
export function buildDefaultNpcScript(defaultMessages: NpcDefaultMessagesInput = {}): string {
  return `local npcHandler = NpcHandler:new()
NpcSystem.parseParameters(npcHandler)

function onCreatureAppear(cid) npcHandler:onCreatureAppear(cid) end
function onCreatureDisappear(cid) npcHandler:onCreatureDisappear(cid) end
function onCreatureSay(cid, type, msg) npcHandler:onCreatureSay(cid, type, msg) end
function onThink() npcHandler:onThink() end

${buildSetMessageLines(defaultMessages)}
npcHandler:addModule(FocusModule:new())
`;
}

/** Script padrão com falas ambiente (`selfSay`, sem exigir um alvo/conversa) — cada mensagem
 * tem seu próprio cooldown (`intervalMs`) e chance (%) de ser dita quando o cooldown vence.
 * Usado só quando o NPC não tem um Script Lua próprio vinculado (`scriptId`). */
export function buildNpcScriptWithMessages(
  messages: { text: string; intervalMs: number; chance: number }[],
  defaultMessages: NpcDefaultMessagesInput = {},
): string {
  if (messages.length === 0) return buildDefaultNpcScript(defaultMessages);

  const entries = messages
    .map(
      (message) =>
        `\t{ text = ${luaStringLiteral(message.text)}, intervalSec = ${Math.max(1, Math.round(message.intervalMs / 1000))}, chance = ${message.chance}, nextAt = 0 },`
    )
    .join("\n");

  return `local npcHandler = NpcHandler:new()
NpcSystem.parseParameters(npcHandler)

function onCreatureAppear(cid) npcHandler:onCreatureAppear(cid) end
function onCreatureDisappear(cid) npcHandler:onCreatureDisappear(cid) end
function onCreatureSay(cid, type, msg) npcHandler:onCreatureSay(cid, type, msg) end

-- Falas ambiente configuradas no admin (portal) — independem de conversa/foco.
local ambientMessages = {
${entries}
}

function onThink()
	npcHandler:onThink()

	local now = os.time()
	for _, message in ipairs(ambientMessages) do
		if now >= message.nextAt then
			message.nextAt = now + message.intervalSec
			if math.random(1, 100) <= message.chance then
				selfSay(message.text)
			end
		end
	end
end

${buildSetMessageLines(defaultMessages)}
npcHandler:addModule(FocusModule:new())
`;
}
