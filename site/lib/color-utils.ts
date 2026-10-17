/** Converte HSL (h: 0-360, s/l: 0-100) pra hex `#rrggbb` — usado por `randomHexColor` porque
 * sortear direto em RGB tende a gerar tons acinzentados/lamacentos com frequência; fixando
 * saturação/luminosidade e variando só o matiz dá cores vivas e bem distribuídas. */
function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Cor hexadecimal aleatória, sorteando só o matiz (saturação/luminosidade fixas numa faixa que
 * garante cores vivas — nem escuras demais, nem claras demais). */
export function randomHexColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 65 + Math.random() * 10; // 65-75%
  const lightness = 45 + Math.random() * 10; // 45-55%
  return hslToHex(hue, saturation, lightness);
}

/** Igual a `randomHexColor`, mas tenta (poucas vezes) evitar bater exatamente numa cor já usada —
 * devolve a última tentativa mesmo se colidir (improvável dado o espaço de matizes/faixas). */
export function randomDistinctHexColor(excludeColors: string[] = []): string {
  const excluded = new Set(excludeColors.map((c) => c.toLowerCase()));
  let color = randomHexColor();
  for (let attempt = 0; attempt < 10 && excluded.has(color.toLowerCase()); attempt++) {
    color = randomHexColor();
  }
  return color;
}

/** Determina se o texto sobre uma cor de fundo deve ser claro ou escuro conforme o brilho da cor
 * (luminância relativa simplificada), pra manter contraste legível em qualquer cor — mesmo
 * cálculo antes duplicado em `components/shared/universe-badge.tsx`. */
export function textColorFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}
