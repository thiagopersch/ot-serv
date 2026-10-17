/**
 * Algoritmo de cor de outfit do Tibia (HSI: 19 matizes x 7 intensidades = 133 combinações),
 * portado de `Outfit::getColor` do OTClient (https://github.com/edubart/otclient,
 * `src/client/outfit.cpp`, licença MIT) — mesma fórmula usada pelo cliente oficial pra
 * converter o índice de cor (0-132, os valores de `head`/`body`/`legs`/`feet`) numa cor RGB.
 */

const HSI_H_STEPS = 19;
const HSI_SI_VALUES = 7;

const INTENSITY_BY_GROUP: Record<number, { s: number; i: number }> = {
  0: { s: 0.25, i: 1.0 },
  1: { s: 0.25, i: 0.75 },
  2: { s: 0.5, i: 0.75 },
  3: { s: 0.667, i: 0.75 },
  4: { s: 1.0, i: 1.0 },
  5: { s: 1.0, i: 0.75 },
  6: { s: 1.0, i: 0.5 },
};

export type Rgb = { r: number; g: number; b: number };

/** Retorna `null` quando a cor equivale a `Color::alpha` (totalmente transparente/sem tingir). */
export function getOutfitPaletteColor(colorIndex: number): Rgb | null {
  let color = colorIndex;
  if (color >= HSI_H_STEPS * HSI_SI_VALUES || color < 0) color = 0;

  let hue = 0;
  let saturation = 0;
  let intensity = 1;

  if (color % HSI_H_STEPS !== 0) {
    hue = ((color % HSI_H_STEPS) * 1.0) / 18.0;
    const group = INTENSITY_BY_GROUP[Math.floor(color / HSI_H_STEPS)];
    saturation = group?.s ?? 1;
    intensity = group?.i ?? 1;
  } else {
    hue = 0;
    saturation = 0;
    intensity = 1 - Math.floor(color / HSI_H_STEPS) / HSI_SI_VALUES;
  }

  if (intensity === 0) return null;

  if (saturation === 0) {
    const gray = Math.round(intensity * 255);
    return { r: gray, g: gray, b: gray };
  }

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 1.0 / 6.0) {
    red = intensity;
    blue = intensity * (1 - saturation);
    green = blue + (intensity - blue) * 6 * hue;
  } else if (hue < 2.0 / 6.0) {
    green = intensity;
    blue = intensity * (1 - saturation);
    red = green - (intensity - blue) * (6 * hue - 1);
  } else if (hue < 3.0 / 6.0) {
    green = intensity;
    red = intensity * (1 - saturation);
    blue = red + (intensity - red) * (6 * hue - 2);
  } else if (hue < 4.0 / 6.0) {
    blue = intensity;
    red = intensity * (1 - saturation);
    green = blue - (intensity - red) * (6 * hue - 3);
  } else if (hue < 5.0 / 6.0) {
    blue = intensity;
    green = intensity * (1 - saturation);
    red = green + (intensity - green) * (6 * hue - 4);
  } else {
    red = intensity;
    green = intensity * (1 - saturation);
    blue = red - (intensity - green) * (6 * hue - 5);
  }

  return { r: Math.round(red * 255), g: Math.round(green * 255), b: Math.round(blue * 255) };
}

/**
 * A sprite de máscara (2ª layer de um outfit colorível) usa exatamente 4 cores planas pra
 * demarcar as 4 regiões — mesmas constantes de `Color::red/green/blue/yellow` do OTClient
 * (`framework/util/color.cpp`). Um pixel fora dessas 4 cores (tipicamente transparente) não
 * pertence a nenhuma região colorível.
 */
export const OUTFIT_MASK_REGION_COLORS = {
  body: { r: 255, g: 0, b: 0 },
  legs: { r: 0, g: 255, b: 0 },
  feet: { r: 0, g: 0, b: 255 },
  head: { r: 255, g: 255, b: 0 },
} as const;

export type OutfitMaskRegion = keyof typeof OUTFIT_MASK_REGION_COLORS;
