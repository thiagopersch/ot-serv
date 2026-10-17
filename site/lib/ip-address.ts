/** "192.168.0.1" -> uint32, mesma representação binária que `inet_addr()` grava nos
 * campos de IP do OTServer (`bans.value` quando `type` = IP, `players.lastip`, etc.) —
 * primeiro octeto = byte menos significativo (ordem de rede lida como inteiro numa CPU
 * little-endian; ex.: 127.0.0.1 -> 16777343, o valor clássico de bans de localhost em
 * servidores OT antigos). Retorna `null` se o texto não for um IPv4 válido. */
export function ipToUint32(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;

  const bytes = parts.map((part) => Number(part));
  if (bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) return null;

  return (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
}

/** Inverso de `ipToUint32` — uint32 armazenado no banco -> "192.168.0.1". */
export function uint32ToIp(value: number): string {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff].join(".");
}
