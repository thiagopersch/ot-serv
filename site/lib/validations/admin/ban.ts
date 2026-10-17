import { z } from "zod";

export { ipToUint32, uint32ToIp } from "@/lib/ip-address";

/** `Ban_t` do OTServer (`src/source/ioban.h`) — o que `type` significa e, por
 * consequência, o que `value`/`param` guardam em cada linha de `bans`. */
export const BAN_TYPES = [
  { value: 1, label: "IP" },
  { value: 2, label: "Personagem" },
  { value: 3, label: "Conta" },
  { value: 4, label: "Notação" },
  { value: 5, label: "Denúncia de chat (Statement)" },
] as const;
export type BanTypeValue = (typeof BAN_TYPES)[number]["value"];

/** `PlayerBan_t` do OTServer — é isso que `param` precisa guardar quando `type` =
 * Personagem (2): `ioban.cpp::isPlayerBanished` filtra por `param = <esse valor>`, então
 * sem preencher corretamente o banimento nunca bate em nenhuma checagem do servidor. */
export const PLAYER_BAN_PARAMS = [
  { value: 1, label: "Denúncia (Report)" },
  { value: 2, label: "Bloqueio de nome (Lock)" },
  { value: 3, label: "Banimento (Banishment)" },
] as const;

/** `ViolationAction_t` do OTServer — só os valores voltados para registro manual do
 * admin (os demais, comentados como "internal use" no header, são gerenciados pelo
 * próprio servidor: deleção de char, namelock, etc.). */
export const VIOLATION_ACTIONS = [
  { value: 0, label: "Notação (Notation)" },
  { value: 1, label: "Denúncia de nome (Name report)" },
  { value: 2, label: "Banimento (Banishment)" },
  { value: 3, label: "Denúncia + banimento (Ban report)" },
  { value: 4, label: "Banimento final (Ban final)" },
  { value: 5, label: "Denúncia + banimento final" },
  { value: 6, label: "Denúncia de chat (Statement)" },
] as const;

/** Máscara padrão de `param` num ban de IP — `0xFFFFFFFF` casa só o IP exato. A
 * checagem do servidor é `(ip & mask & param) == (value & param & mask)`: com
 * `param = 0` isso vira `0 == 0` e bane literalmente todo mundo, então nunca deixe
 * vazio para `type` = IP. */
export const DEFAULT_IP_MASK = 0xffffffff;

export const banSchema = z.object({
  type: z.number().int().min(1).max(5),
  value: z.number().int(),
  /** Sentido depende de `type`: máscara de rede (IP), `PlayerBan_t` (Personagem),
   * player relacionado (Conta/Notação/Denúncia, opcional — 0 = nenhum). */
  param: z.number().int(),
  /** `ViolationAction_t` — categoriza a violação (mostrado no relatório do jogador). */
  action: z.number().int(),
  reason: z.number().int(),
  comment: z.string().max(1000),
  statement: z.string().max(255),
  active: z.boolean(),
  expires: z.number().int(),
});

export type BanInput = z.infer<typeof banSchema>;
