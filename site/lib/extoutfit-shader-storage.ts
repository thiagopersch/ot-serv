import path from "node:path";

/** Textura extra `u_Tex1` de um shader do extoutfits (ex.: `/images/shaders/rainbow.png` do
 * `outfit_rainbow`) — `public/storage/extoutfit-shader-tex/{id}.{ext}`, mesmo esquema de
 * `lib/entity-image.ts`. */
export function shaderTex1StoragePath(extOutfitId: number, extension: string): string {
  return path.join(process.cwd(), "public", "storage", "extoutfit-shader-tex", `${extOutfitId}.${extension}`);
}

export function shaderTex1Url(extOutfitId: number, extension: string, updatedAt: Date): string {
  return `/storage/extoutfit-shader-tex/${extOutfitId}.${extension}?v=${updatedAt.getTime()}`;
}

export const MAX_SHADER_BYTES = 256 * 1024;

/** Arquivos-base do cliente que não pertencem a um shader do extoutfits. */
const IGNORED_SHADER_FILES = /^(outfit_default_(fragment|vertex)|map_.*)$/i;

/** Interpreta o nome de um arquivo de shader do cliente (`cliente/data/shaders`), seguindo
 * `cliente/modules/game_shaders/shaders.lua`: `<nome>.frag` e `<nome>_fragment.frag` são o
 * fragment do shader `<nome>`; `<nome>_vertex.frag` é o vertex. `null` = arquivo base ignorado. */
export function parseShaderFileName(fileName: string): { shaderName: string; part: "fragment" | "vertex" } | null {
  const stem = fileName.replace(/^.*[\\/]/, "").replace(/\.(frag|vert|glsl|fs|vs)$/i, "");
  if (!stem || IGNORED_SHADER_FILES.test(stem)) return null;

  const vertex = stem.match(/^(.+)_vertex$/i);
  if (vertex) return { shaderName: vertex[1], part: "vertex" };

  const fragment = stem.match(/^(.+)_fragment$/i);
  return { shaderName: fragment ? fragment[1] : stem, part: "fragment" };
}
