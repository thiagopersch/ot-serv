/**
 * Leitor binário sequencial compartilhado pelos parsers de formatos do cliente Tibia (`.obd` em
 * `lib/obd/obd-parser.ts`, `.dat`/`.spr` em `lib/tibia-client/*`) — todos little-endian.
 */
export class ByteReader {
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

  i32(): number {
    const value = this.buffer.readInt32LE(this.position);
    this.position += 4;
    return value;
  }

  i8(): number {
    const value = this.buffer.readInt8(this.position);
    this.position += 1;
    return value;
  }

  bytes(length: number): Buffer {
    const value = this.buffer.subarray(this.position, this.position + length);
    this.position += length;
    return value;
  }

  get length(): number {
    return this.buffer.length;
  }

  /** Bytes ainda não consumidos — usado pelos parsers de `.dat`/`.spr` para detectar
   * desalinhamento de cursor (opcode/tamanho errado) antes de ler lixo como se fosse dado válido. */
  remaining(): number {
    return this.buffer.length - this.position;
  }
}
