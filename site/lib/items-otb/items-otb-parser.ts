/**
 * Parser do formato binário `items.otb` do OTServer/Open Tibia (árvore de nós "OTB") — usado
 * pelo engine C++ como fonte de verdade do mapeamento server_id (`id` do item) -> client_id
 * (sprite real no cliente). Layout e algoritmo de escaping extraídos diretamente de
 * `server/src/source/fileloader.cpp`/`.h` (parsing genérico da árvore de nós) e
 * `server/src/source/items.cpp` (`Items::loadFromOtb`) + `server/src/source/itemloader.h`
 * (enums `rootattrib_`/`itemattrib_t` e o struct `VERSIONINFO`).
 *
 * Layout de bytes:
 * - 4 bytes de versão de arquivo (LE), deve ser `0`.
 * - nó raiz a partir do offset 4: `NODE_START(0xFE), type(1), <props>, NODE_END(0xFF)`.
 *   Props da raiz = `flags:u32 + attr:u8(ROOT_ATTR_VERSION=0x01) + length:u16 + VERSIONINFO` —
 *   não precisamos validar a versão de cliente aqui, só usamos o primeiro `NODE_START`
 *   encontrado dentro das props da raiz como o início da cadeia de nós-filho (um por item).
 * - cada nó-filho é `NODE_START, type(1)=itemgroup_t (ignorado), <props>, NODE_END`, com props
 *   = `flags:u32 (ignorado)` + laço de atributos TLV (`attr:u8, length:u16, value`) até esgotar
 *   os bytes. Só nos interessam `ITEM_ATTR_SERVERID=0x10` e `ITEM_ATTR_CLIENTID=0x11`
 *   (ambos `uint16 LE`) — qualquer outro atributo é pulado via `length`.
 *
 * Escaping: dentro das props de um nó, um byte `ESCAPE_CHAR=0xFD` marca que o *próximo* byte é
 * dado literal (mesmo que seja 0xFE/0xFF/0xFD) e não deve ser interpretado como marcador
 * estrutural — mesma regra usada por `FileLoader::getProps`/`parseNode` no C++.
 *
 * Decisão de design: escaneamento linear (não uma árvore genérica recursiva como o `FileLoader`
 * C++, que é reaproveitado ali para outros formatos) — a árvore real do items.otb tem só 2
 * níveis (raiz + itens), então um scanner de um passo só é mais simples de auditar quanto à
 * correção do escaping, que é a parte de maior risco de bug silencioso. Ainda assim, um nível de
 * aninhamento inesperado dentro de um nó de item (não deve ocorrer em arquivo real) é pulado
 * defensivamente em vez de corromper o parsing.
 *
 * Quirk preservado do C++ (`items.cpp` `Items::loadFromOtb`): valores de server id na faixa
 * `20000 < serverId < 20100` sofrem `-= 20000`. O preenchimento de gaps com itens "dummy"
 * (`lastId`) do C++ é intencionalmente **omitido** — irrelevante para extrair só os pares
 * server_id/client_id reais do arquivo.
 */

const NODE_START = 0xfe;
const NODE_END = 0xff;
const ESCAPE_CHAR = 0xfd;

const ITEM_ATTR_SERVERID = 0x10;
const ITEM_ATTR_CLIENTID = 0x11;

export class OtbParseError extends Error {}

export type OtbItemEntry = { serverId: number; clientId: number };

class OtbCursor {
  constructor(
    private readonly buffer: Buffer,
    public position = 0
  ) {}

  u8(): number {
    return this.buffer[this.position++];
  }

  u16(): number {
    const value = this.buffer.readUInt16LE(this.position);
    this.position += 2;
    return value;
  }

  u32(): number {
    const value = this.buffer.readUInt32LE(this.position);
    this.position += 4;
    return value;
  }
}

/**
 * Lê um nó de item a partir do byte `NODE_START` em `start`, retornando suas props já
 * des-escapadas e a posição logo após o `NODE_END` de fechamento desse mesmo nó. Um
 * `NODE_START` inesperado encontrado dentro das props (nunca deve ocorrer em um nó de item real)
 * é tratado como um bloco aninhado a ser pulado por inteiro, em vez de interpretado como
 * conteúdo — mantém o parser resiliente sem precisar de uma árvore genérica.
 */
function readItemNode(buffer: Buffer, start: number): { props: Buffer; next: number } {
  if (buffer[start] !== NODE_START) {
    throw new OtbParseError("Arquivo items.otb inválido: nó de item malformado.");
  }

  let cursor = start + 2; // pula NODE_START + type byte (itemgroup_t, não usado aqui)
  const propsBytes: number[] = [];

  while (true) {
    if (cursor >= buffer.length) {
      throw new OtbParseError("Arquivo items.otb truncado (nó de item sem terminador).");
    }

    const byte = buffer[cursor];

    if (byte === ESCAPE_CHAR) {
      cursor += 1;
      if (cursor >= buffer.length) {
        throw new OtbParseError("Arquivo items.otb truncado (escape no final do arquivo).");
      }
      propsBytes.push(buffer[cursor]);
      cursor += 1;
      continue;
    }

    if (byte === NODE_START) {
      const nested = readItemNode(buffer, cursor);
      cursor = nested.next;
      continue;
    }

    if (byte === NODE_END) {
      return { props: Buffer.from(propsBytes), next: cursor + 1 };
    }

    propsBytes.push(byte);
    cursor += 1;
  }
}

/**
 * Varre as props da raiz (a partir do seu byte de `type`, em `rootTypeStart`) só até encontrar o
 * primeiro `NODE_START` não-escapado — esse ponto é onde a cadeia de nós-filho (um por item)
 * começa. O conteúdo das props da raiz (flags + `VERSIONINFO`) é descartado; só precisamos de
 * onde os itens começam.
 */
function findFirstChildStart(buffer: Buffer, rootTypeStart: number): number | null {
  let cursor = rootTypeStart + 1; // pula o byte de type da raiz

  while (cursor < buffer.length) {
    const byte = buffer[cursor];

    if (byte === ESCAPE_CHAR) {
      cursor += 2;
      continue;
    }

    if (byte === NODE_START) return cursor;
    if (byte === NODE_END) return null; // raiz sem nenhum item — arquivo vazio, mas não é erro

    cursor += 1;
  }

  throw new OtbParseError("Arquivo items.otb truncado (nó raiz sem terminador).");
}

/** Extrai `{serverId, clientId}` das props (já des-escapadas) de um nó de item — `null` quando
 * o nó não carrega os dois atributos (não deve ocorrer em um arquivo real). */
function parseItemAttributes(props: Buffer): OtbItemEntry | null {
  if (props.length < 4) return null;

  const cursor = new OtbCursor(props);
  cursor.u32(); // flags do item — irrelevante para o mapeamento server_id/client_id

  let serverId: number | null = null;
  let clientId: number | null = null;

  while (cursor.position < props.length) {
    const attr = cursor.u8();
    if (cursor.position + 2 > props.length) break; // length truncado — para sem falhar

    const length = cursor.u16();
    if (cursor.position + length > props.length) break; // valor truncado — para sem falhar

    if (attr === ITEM_ATTR_SERVERID && length === 2) {
      let value = cursor.u16();
      if (value > 20000 && value < 20100) value -= 20000;
      serverId = value;
    } else if (attr === ITEM_ATTR_CLIENTID && length === 2) {
      clientId = cursor.u16();
    } else {
      cursor.position += length;
    }
  }

  if (serverId == null || clientId == null) return null;
  return { serverId, clientId };
}

/** Lê um `items.otb` completo e retorna os pares server_id/client_id encontrados (só entradas
 * com os dois atributos presentes). Nunca lança para "arquivo sem itens" — só para bytes que não
 * batem com o formato esperado (versão, marcadores de nó ausentes/truncados). */
export function parseItemsOtb(buffer: Buffer): OtbItemEntry[] {
  if (buffer.length < 6) {
    throw new OtbParseError("Arquivo items.otb inválido: tamanho insuficiente.");
  }

  const version = buffer.readUInt32LE(0);
  if (version !== 0) {
    throw new OtbParseError("Arquivo items.otb inválido: versão de arquivo inesperada.");
  }

  if (buffer[4] !== NODE_START) {
    throw new OtbParseError("Arquivo items.otb inválido: nó raiz não encontrado.");
  }

  const childrenStart = findFirstChildStart(buffer, 5);
  if (childrenStart == null) return [];

  const entries: OtbItemEntry[] = [];
  let cursor = childrenStart;

  while (cursor < buffer.length) {
    if (buffer[cursor] === NODE_END) break; // fecha o nó raiz — fim da lista de itens

    if (buffer[cursor] !== NODE_START) {
      throw new OtbParseError("Arquivo items.otb inválido: estrutura de nós inesperada.");
    }

    const node = readItemNode(buffer, cursor);
    const entry = parseItemAttributes(node.props);
    if (entry) entries.push(entry);
    cursor = node.next;
  }

  return entries;
}
