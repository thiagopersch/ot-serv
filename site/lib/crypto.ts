import { createHash, randomBytes } from "node:crypto";

/**
 * SHA-1 é usado apenas no campo `accounts.password` para manter compatibilidade
 * com a autenticação nativa do cliente/servidor OTServer. Não usar para novos
 * segredos (tokens, etc) — para esses, usar `randomToken`.
 */
export function sha1(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}
