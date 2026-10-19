/**
 * Port em TypeScript do xBRZ 1.8 (só o scaler 2x em modo ARGB) — mesmo algoritmo usado pelo HD
 * Mode do cliente (`cliente/src/framework/graphics/xbrz/xbrz.cpp`, chamado por
 * `Image::scaleXbrz`), pra que as sprites do site fiquem idênticas às do jogo.
 *
 * xBRZ: Copyright (C) Zenju — distribuído sob GNU GPL-3 (https://www.gnu.org/licenses/gpl-3.0).
 *
 * Diferenças em relação ao C++: sem multithread por faixas, e a distância de cor é calculada
 * direto em vez da tabela de 64 MB do `distYCbCrBuffered` — mas com a mesma quantização (diff/2)
 * da tabela, pra dar exatamente o mesmo resultado do modo `ColorFormat::ARGB` do cliente.
 */

const SCALE = 2;

/** Mesmos valores padrão de `xbrz_config.h`. */
const CFG = {
  equalColorTolerance: 30,
  centerDirectionBias: 4,
  dominantDirectionThreshold: 3.6,
  steepDirectionThreshold: 2.2,
};

const BLEND_NONE = 0;
const BLEND_NORMAL = 1;
const BLEND_DOMINANT = 2;

const alpha = (pix: number) => (pix >>> 24) & 0xff;
const red = (pix: number) => (pix >>> 16) & 0xff;
const green = (pix: number) => (pix >>> 8) & 0xff;
const blue = (pix: number) => pix & 0xff;
const makePixel = (a: number, r: number, g: number, b: number) => ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;

const K_B = 0.0593; // ITU-R BT.2020
const K_R = 0.2627;
const K_G = 1 - K_B - K_R;
const SCALE_B = 0.5 / (1 - K_B);
const SCALE_R = 0.5 / (1 - K_R);

/** `distYCbCrBuffered`: a tabela do C++ guarda cada diff truncado pra diff/2 e reexpandido ×2. */
function distYCbCr(pix1: number, pix2: number): number {
  const rDiff = Math.trunc((red(pix1) - red(pix2)) / 2) * 2;
  const gDiff = Math.trunc((green(pix1) - green(pix2)) / 2) * 2;
  const bDiff = Math.trunc((blue(pix1) - blue(pix2)) / 2) * 2;

  const y = K_R * rDiff + K_G * gDiff + K_B * bDiff;
  const cB = SCALE_B * (bDiff - y);
  const cR = SCALE_R * (rDiff - y);
  return Math.fround(Math.sqrt(y * y + cB * cB + cR * cR));
}

/** `ColorDistanceARGB::dist`. */
function dist(pix1: number, pix2: number): number {
  const a1 = alpha(pix1) / 255;
  const a2 = alpha(pix2) / 255;
  const d = distYCbCr(pix1, pix2);
  return a1 < a2 ? a1 * d + 255 * (a2 - a1) : a2 * d + 255 * (a1 - a2);
}

const eq = (pix1: number, pix2: number) => dist(pix1, pix2) < CFG.equalColorTolerance;

/** `gradientARGB<M, N>`: cor intermediária entre duas cores com alfa (sem alpha blending). */
function gradientARGB(m: number, n: number, pixFront: number, pixBack: number): number {
  const weightFront = alpha(pixFront) * m;
  const weightBack = alpha(pixBack) * (n - m);
  const weightSum = weightFront + weightBack;
  if (weightSum === 0) return 0;

  const calc = (front: number, back: number) => Math.floor((front * weightFront + back * weightBack) / weightSum);
  return makePixel(
    Math.floor(weightSum / n),
    calc(red(pixFront), red(pixBack)),
    calc(green(pixFront), green(pixBack)),
    calc(blue(pixFront), blue(pixBack)),
  );
}

/** Kernel 4x4 do pré-processamento (posição F = pixel atual):
 * A B C D / E F G H / I J K L / M N O P */
type Kernel4 = {
  a: number; b: number; c: number; d: number;
  e: number; f: number; g: number; h: number;
  i: number; j: number; k: number; l: number;
  m: number; n: number; o: number; p: number;
};

type BlendResult = { f: number; g: number; j: number; k: number };

/** `preProcessCorners`: direção de blend nos 4 cantos entre F, G, J, K. */
function preProcessCorners(ker: Kernel4): BlendResult {
  const result: BlendResult = { f: BLEND_NONE, g: BLEND_NONE, j: BLEND_NONE, k: BLEND_NONE };

  if ((ker.f === ker.g && ker.j === ker.k) || (ker.f === ker.j && ker.g === ker.k)) return result;

  const jg =
    dist(ker.i, ker.f) + dist(ker.f, ker.c) + dist(ker.n, ker.k) + dist(ker.k, ker.h) +
    CFG.centerDirectionBias * dist(ker.j, ker.g);
  const fk =
    dist(ker.e, ker.j) + dist(ker.j, ker.o) + dist(ker.b, ker.g) + dist(ker.g, ker.l) +
    CFG.centerDirectionBias * dist(ker.f, ker.k);

  if (jg < fk) {
    const dominant = CFG.dominantDirectionThreshold * jg < fk;
    if (ker.f !== ker.g && ker.f !== ker.j) result.f = dominant ? BLEND_DOMINANT : BLEND_NORMAL;
    if (ker.k !== ker.j && ker.k !== ker.g) result.k = dominant ? BLEND_DOMINANT : BLEND_NORMAL;
  } else if (fk < jg) {
    const dominant = CFG.dominantDirectionThreshold * fk < jg;
    if (ker.j !== ker.f && ker.j !== ker.k) result.j = dominant ? BLEND_DOMINANT : BLEND_NORMAL;
    if (ker.g !== ker.f && ker.g !== ker.k) result.g = dominant ? BLEND_DOMINANT : BLEND_NORMAL;
  }
  return result;
}

// Blend info compactado num byte: TopL bits 0-1, TopR 2-3, BottomR 4-5, BottomL 6-7.
const getTopR = (b: number) => (b >> 2) & 0x3;
const getBottomR = (b: number) => (b >> 4) & 0x3;
const getBottomL = (b: number) => (b >> 6) & 0x3;
const addTopR = (b: number, bt: number) => b | (bt << 2);
const addBottomR = (b: number, bt: number) => b | (bt << 4);
const addBottomL = (b: number, bt: number) => b | (bt << 6);

function rotateBlendInfo(b: number, rot: number): number {
  switch (rot) {
    case 1: return ((b << 2) | (b >> 6)) & 0xff;
    case 2: return ((b << 4) | (b >> 4)) & 0xff;
    case 3: return ((b << 6) | (b >> 2)) & 0xff;
    default: return b;
  }
}

/** Kernel 3x3 (a..i em ordem de linha) lido com rotação — mesmos `DEF_GETTER` do C++.
 * Cada linha diz, pra a,b,...,i rotacionados, qual índice do kernel original usar. */
const ROT_GETTERS: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8], // ROT_0
  [6, 3, 0, 7, 4, 1, 8, 5, 2], // ROT_90:  a←g b←d c←a d←h e←e f←b g←i h←f i←c
  [8, 7, 6, 5, 4, 3, 2, 1, 0], // ROT_180
  [2, 5, 8, 1, 4, 7, 0, 3, 6], // ROT_270: a←c b←f c←i d←b e←e f←h g←a h←d i←g
];

/** `MatrixRotation<rot, I, J, N>` → offset (linha, coluna) no bloco de saída. */
const OUTPUT_ROTATION: [number, number][][][] = (() => {
  const table: [number, number][][][] = [];
  for (let rot = 0; rot < 4; rot++) {
    const rows: [number, number][][] = [];
    for (let i = 0; i < SCALE; i++) {
      const cols: [number, number][] = [];
      for (let j = 0; j < SCALE; j++) {
        let iOld = i;
        let jOld = j;
        for (let r = 0; r < rot; r++) {
          const nextI = SCALE - 1 - jOld;
          jOld = iOld;
          iOld = nextI;
        }
        cols.push([iOld, jOld]);
      }
      rows.push(cols);
    }
    table.push(rows);
  }
  return table;
})();

/** `blendPixel` + `Scaler2x::blendLine*`/`blendCorner` para uma rotação. */
function blendPixel(
  ker3: number[],
  trg: Uint32Array,
  outIndex: number,
  trgWidth: number,
  blendInfo: number,
  rot: number,
) {
  const getters = ROT_GETTERS[rot];
  const b = ker3[getters[1]];
  const c = ker3[getters[2]];
  const d = ker3[getters[3]];
  const e = ker3[getters[4]];
  const f = ker3[getters[5]];
  const g = ker3[getters[6]];
  const h = ker3[getters[7]];
  const i = ker3[getters[8]];

  const blend = rotateBlendInfo(blendInfo, rot);
  if (getBottomR(blend) < BLEND_NORMAL) return;

  const doLineBlend = (() => {
    if (getBottomR(blend) >= BLEND_DOMINANT) return true;
    // Sem segundo blend numa rotação adjacente (pixels isolados, "olhos do mario").
    if (getTopR(blend) !== BLEND_NONE && !eq(e, g)) return false;
    if (getBottomL(blend) !== BLEND_NONE && !eq(e, c)) return false;
    // Sem blend completo em formatos de L: só o canto.
    if (!eq(e, i) && eq(g, h) && eq(h, i) && eq(i, f) && eq(f, c)) return false;
    return true;
  })();

  const px = dist(e, f) <= dist(e, h) ? f : h;

  const rotation = OUTPUT_ROTATION[rot];
  const alphaGrad = (row: number, col: number, m: number, n: number) => {
    const [iOld, jOld] = rotation[row][col];
    const idx = outIndex + jOld + iOld * trgWidth;
    trg[idx] = gradientARGB(m, n, px, trg[idx]);
  };

  if (doLineBlend) {
    const fg = dist(f, g);
    const hc = dist(h, c);
    const haveShallowLine = CFG.steepDirectionThreshold * fg <= hc && e !== g && d !== g;
    const haveSteepLine = CFG.steepDirectionThreshold * hc <= fg && e !== c && b !== c;

    if (haveShallowLine) {
      if (haveSteepLine) {
        alphaGrad(1, 0, 1, 4);
        alphaGrad(0, 1, 1, 4);
        alphaGrad(1, 1, 5, 6);
      } else {
        alphaGrad(SCALE - 1, 0, 1, 4);
        alphaGrad(SCALE - 1, 1, 3, 4);
      }
    } else if (haveSteepLine) {
      alphaGrad(0, SCALE - 1, 1, 4);
      alphaGrad(1, SCALE - 1, 3, 4);
    } else {
      alphaGrad(1, 1, 1, 2);
    }
  } else {
    alphaGrad(1, 1, 21, 100); // canto arredondado: 1 - pi/4
  }
}

/** `OobReaderTransparent`: fora da imagem é pixel transparente (0). */
function readDhlp(ker: Kernel4, src: Uint32Array, width: number, height: number, y: number, x: number) {
  const x2 = x + 2;
  if (x2 >= 0 && x2 < width) {
    ker.d = y - 1 >= 0 && y - 1 < height ? src[(y - 1) * width + x2] : 0;
    ker.h = y >= 0 && y < height ? src[y * width + x2] : 0;
    ker.l = y + 1 >= 0 && y + 1 < height ? src[(y + 1) * width + x2] : 0;
    ker.p = y + 2 >= 0 && y + 2 < height ? src[(y + 2) * width + x2] : 0;
  } else {
    ker.d = 0;
    ker.h = 0;
    ker.l = 0;
    ker.p = 0;
  }
}

/** Monta o kernel em x = -1 (mesmo "hack" de leitura do C++). */
function initKernel(src: Uint32Array, width: number, height: number, y: number): Kernel4 {
  const ker: Kernel4 = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0, h: 0, i: 0, j: 0, k: 0, l: 0, m: 0, n: 0, o: 0, p: 0 };
  readDhlp(ker, src, width, height, y, -4);
  ker.a = ker.d; ker.e = ker.h; ker.i = ker.l; ker.m = ker.p;
  readDhlp(ker, src, width, height, y, -3);
  ker.b = ker.d; ker.f = ker.h; ker.j = ker.l; ker.n = ker.p;
  readDhlp(ker, src, width, height, y, -2);
  ker.c = ker.d; ker.g = ker.h; ker.k = ker.l; ker.o = ker.p;
  readDhlp(ker, src, width, height, y, -1);
  return ker;
}

function shiftKernel(ker: Kernel4) {
  ker.a = ker.b; ker.e = ker.f; ker.i = ker.j; ker.m = ker.n;
  ker.b = ker.c; ker.f = ker.g; ker.j = ker.k; ker.n = ker.o;
  ker.c = ker.d; ker.g = ker.h; ker.k = ker.l; ker.o = ker.p;
}

/** `scaleImage<Scaler2x<ColorGradientARGB>, ColorDistanceARGB, OobReaderTransparent>` com pixels
 * 0xAARRGGBB. */
function scaleArgb(src: Uint32Array, width: number, height: number): Uint32Array {
  const trgWidth = width * SCALE;
  const trg = new Uint32Array(trgWidth * height * SCALE);
  if (width <= 0 || height <= 0) return trg;

  const preProcBuf = new Uint8Array(width);

  // Primeira linha: cantos superiores esquerdo/direito.
  {
    const ker = initKernel(src, width, height, -1);
    preProcBuf[0] = preProcessCorners(ker).k;
    for (let x = 0; x < width; x++) {
      shiftKernel(ker);
      readDhlp(ker, src, width, height, -1, x);
      const res = preProcessCorners(ker);
      preProcBuf[x] = addTopR(preProcBuf[x], res.j);
      if (x + 1 < width) preProcBuf[x + 1] = res.k;
    }
  }

  const ker3 = new Array<number>(9);

  for (let y = 0; y < height; y++) {
    let outIndex = SCALE * y * trgWidth;
    const ker = initKernel(src, width, height, y);

    let blendXy1: number;
    {
      const res = preProcessCorners(ker);
      blendXy1 = res.k;
      preProcBuf[0] = addBottomL(preProcBuf[0], res.g);
    }

    for (let x = 0; x < width; x++, outIndex += SCALE) {
      shiftKernel(ker);
      readDhlp(ker, src, width, height, y, x);

      let blendXy = preProcBuf[x];
      {
        const res = preProcessCorners(ker);
        blendXy = addBottomR(blendXy, res.f);
        blendXy1 = addTopR(blendXy1, res.j);
        preProcBuf[x] = blendXy1;
        if (x + 1 < width) {
          blendXy1 = res.k;
          preProcBuf[x + 1] = addBottomL(preProcBuf[x + 1], res.g);
        }
      }

      // fillBlock com a cor do pixel atual.
      for (let row = 0; row < SCALE; row++) {
        trg.fill(ker.f, outIndex + row * trgWidth, outIndex + row * trgWidth + SCALE);
      }

      if (blendXy !== 0) {
        ker3[0] = ker.a; ker3[1] = ker.b; ker3[2] = ker.c;
        ker3[3] = ker.e; ker3[4] = ker.f; ker3[5] = ker.g;
        ker3[6] = ker.i; ker3[7] = ker.j; ker3[8] = ker.k;
        for (let rot = 0; rot < 4; rot++) blendPixel(ker3, trg, outIndex, trgWidth, blendXy, rot);
      }
    }
  }

  return trg;
}

export const XBRZ_SCALE = SCALE;

/** Amplia uma imagem RGBA (4 bytes por pixel) 2x com xBRZ — mesma conversão RGBA⇄ARGB do
 * `Image::scaleXbrz` do cliente. Retorna RGBA com `width*2` × `height*2`. */
export function xbrzScale2x(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const count = width * height;
  const src = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    src[i] = makePixel(rgba[p + 3], rgba[p], rgba[p + 1], rgba[p + 2]);
  }

  const dst = scaleArgb(src, width, height);
  const out = new Uint8Array(dst.length * 4);
  for (let i = 0; i < dst.length; i++) {
    const c = dst[i];
    out[i * 4] = red(c);
    out[i * 4 + 1] = green(c);
    out[i * 4 + 2] = blue(c);
    out[i * 4 + 3] = alpha(c);
  }
  return out;
}
