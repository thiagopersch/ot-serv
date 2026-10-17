/**
 * Decodificador mínimo de APNG (PNG animado) para canvas — o `drawImage` de um `<img>` APNG só
 * desenha o primeiro frame, então o preview composto (`OutfitCompositePreview`) usa isto para
 * animar as barras/imagens enviadas (`cliente/data/images/bars` tem vários APNGs).
 *
 * Cada frame (`fcTL` + `IDAT`/`fdAT`) é remontado como um PNG estático, decodificado pelo browser
 * e composto respeitando `dispose_op`/`blend_op` da especificação APNG.
 */

export type AnimatedFrame = { canvas: HTMLCanvasElement; delayMs: number };
export type AnimatedImage = { width: number; height: number; frames: AnimatedFrame[]; totalMs: number };

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

type Chunk = { type: string; data: Uint8Array };

function readChunks(bytes: Uint8Array): Chunk[] | null {
  if (bytes.length < 8 || !PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Chunk[] = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

type RawFrame = {
  width: number;
  height: number;
  x: number;
  y: number;
  delayMs: number;
  dispose: number;
  blend: number;
  data: Uint8Array[];
};

/** `null` quando o arquivo não é um APNG (PNG estático ou outro formato). */
export async function decodeApng(buffer: ArrayBuffer): Promise<AnimatedImage | null> {
  const chunks = readChunks(new Uint8Array(buffer));
  if (!chunks || !chunks.some((chunk) => chunk.type === "acTL")) return null;

  const ihdr = chunks.find((chunk) => chunk.type === "IHDR");
  if (!ihdr) return null;
  const ihdrView = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);
  const width = ihdrView.getUint32(0);
  const height = ihdrView.getUint32(4);

  // Chunks auxiliares antes do primeiro IDAT (PLTE, tRNS, gAMA...) valem para todos os frames.
  const headerChunks: Chunk[] = [];
  const frames: RawFrame[] = [];
  let current: RawFrame | null = null;
  let seenIdat = false;

  for (const chunk of chunks) {
    switch (chunk.type) {
      case "fcTL": {
        const view = new DataView(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength);
        const delayNum = view.getUint16(20);
        const delayDen = view.getUint16(22) || 100;
        current = {
          width: view.getUint32(4),
          height: view.getUint32(8),
          x: view.getUint32(12),
          y: view.getUint32(16),
          delayMs: Math.max(20, Math.round((delayNum / delayDen) * 1000)),
          dispose: chunk.data[24],
          blend: chunk.data[25],
          data: [],
        };
        frames.push(current);
        break;
      }
      case "IDAT":
        seenIdat = true;
        // IDAT sem fcTL antes = imagem padrão fora da animação.
        current?.data.push(chunk.data);
        break;
      case "fdAT":
        current?.data.push(chunk.data.subarray(4));
        break;
      case "IHDR":
      case "acTL":
      case "IEND":
        break;
      default:
        if (!seenIdat) headerChunks.push(chunk);
    }
  }

  const decoded = await Promise.all(
    frames.map(async (frame) => {
      if (frame.data.length === 0) return null;
      const header = new Uint8Array(ihdr.data);
      const view = new DataView(header.buffer);
      view.setUint32(0, frame.width);
      view.setUint32(4, frame.height);
      const parts = [
        PNG_SIGNATURE,
        makeChunk("IHDR", header),
        ...headerChunks.map((chunk) => makeChunk(chunk.type, chunk.data)),
        ...frame.data.map((data) => makeChunk("IDAT", data)),
        makeChunk("IEND", new Uint8Array(0)),
      ];
      return createImageBitmap(new Blob(parts as BlobPart[], { type: "image/png" }));
    }),
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const result: AnimatedFrame[] = [];

  frames.forEach((frame, index) => {
    const bitmap = decoded[index];
    if (!bitmap) return;
    const previous = frame.dispose === 2 ? ctx.getImageData(0, 0, width, height) : null;

    if (frame.blend === 0) ctx.clearRect(frame.x, frame.y, frame.width, frame.height);
    ctx.drawImage(bitmap, frame.x, frame.y);

    const snapshot = document.createElement("canvas");
    snapshot.width = width;
    snapshot.height = height;
    snapshot.getContext("2d")!.drawImage(canvas, 0, 0);
    result.push({ canvas: snapshot, delayMs: frame.delayMs });

    if (frame.dispose === 1 || (frame.dispose === 2 && index === 0)) {
      ctx.clearRect(frame.x, frame.y, frame.width, frame.height);
    } else if (previous) {
      ctx.putImageData(previous, 0, 0);
    }
    bitmap.close();
  });

  if (result.length === 0) return null;
  return { width, height, frames: result, totalMs: result.reduce((sum, frame) => sum + frame.delayMs, 0) };
}

/** Frame da animação no instante `ms` (loop infinito). */
export function animatedFrameAt(image: AnimatedImage, ms: number): HTMLCanvasElement {
  let t = ms % image.totalMs;
  for (const frame of image.frames) {
    if (t < frame.delayMs) return frame.canvas;
    t -= frame.delayMs;
  }
  return image.frames[0].canvas;
}
