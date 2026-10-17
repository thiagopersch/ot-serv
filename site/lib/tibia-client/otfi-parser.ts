/**
 * Parser mínimo do `Tibia.otfi` (config do OTClient que acompanha `Tibia.dat`/`Tibia.spr`) — só
 * extrai as duas flags que mudam a forma binária de `.dat`/`.spr`: `extended` (spriteCount/
 * spriteIds em `u32` em vez de `u16`) e `transparency` (pixels coloridos do `.spr` armazenados
 * como RGBA de 4 bytes, com alpha explícito, em vez de RGB de 3 bytes). Formato texto simples
 * (`chave: valor`, indentado, um por linha) — não precisamos de um parser genérico de INI/OTML,
 * só ler essas duas linhas em qualquer lugar do arquivo.
 *
 * Cliente sem `.otfi` (ou sem essas linhas): assume o padrão de um Tibia 8.6 "puro"
 * (`extended: false, transparency: false`) — ver `DEFAULT_TIBIA_CLIENT_FORMAT`.
 */
export type TibiaClientFormat = {
  extended: boolean;
  transparency: boolean;
};

export const DEFAULT_TIBIA_CLIENT_FORMAT: TibiaClientFormat = {
  extended: false,
  transparency: false,
};

function readBooleanFlag(text: string, key: string): boolean | null {
  const match = text.match(new RegExp(`^[ \\t]*${key}[ \\t]*:[ \\t]*(true|false)`, "im"));
  if (!match) return null;
  return match[1].toLowerCase() === "true";
}

export function parseOtfi(text: string): TibiaClientFormat {
  return {
    extended: readBooleanFlag(text, "extended") ?? DEFAULT_TIBIA_CLIENT_FORMAT.extended,
    transparency: readBooleanFlag(text, "transparency") ?? DEFAULT_TIBIA_CLIENT_FORMAT.transparency,
  };
}
