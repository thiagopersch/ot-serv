/** Arquivos de cliente associados a um registro do extoutfits (imagem da barra, `.frag` do shader,
 * ...), com o nome e o caminho que eles têm no cliente — usado pelo download por registro
 * (`/api/admin/extoutfits/[id]/file`), pelo pacote ZIP (`/api/admin/extoutfits/bundle`) e pelas
 * ações da listagem. Sem I/O aqui (importável no client); a leitura fica em
 * `lib/extoutfit-files-server.ts`. */

export type ExtOutfitFilePart = "image" | "fragment" | "vertex" | "tex1";

export type ExtOutfitFileRef = {
  part: ExtOutfitFilePart;
  /** Nome do arquivo no download. */
  fileName: string;
  /** Caminho dentro do pacote ZIP (estrutura do cliente). */
  clientPath: string;
  contentType: string;
};

export type ExtOutfitFileSource = {
  kind: string;
  xmlId: number;
  name: string;
  image: string | null;
  shaderName: string | null;
  shaderFileName: string | null;
  hasShaderSource: boolean;
  hasShaderVertex: boolean;
  shaderTex1Ext: string | null;
};

const IMAGE_CONTENT_TYPES: Record<string, string> = { png: "image/png", gif: "image/gif" };

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "_").trim() || "arquivo";
}

/** `imageExtension` = extensão da imagem enviada (`EntityImage`), `null` se não houver. */
export function listExtOutfitFiles(entry: ExtOutfitFileSource, imageExtension: string | null): ExtOutfitFileRef[] {
  const files: ExtOutfitFileRef[] = [];

  if (imageExtension) {
    const contentType = IMAGE_CONTENT_TYPES[imageExtension] ?? "application/octet-stream";
    if ((entry.kind === "healthbars" || entry.kind === "manabars") && entry.image) {
      // `/images/bars/Akatsuki` → cliente/data/images/bars/Akatsuki.png (mesmo arquivo enviado).
      const imagePath = entry.image.replace(/^\/+/, "").replace(/\.(png|gif)$/i, "");
      const stem = imagePath.split("/").pop() ?? `bar_${entry.xmlId}`;
      files.push({
        part: "image",
        fileName: `${safeName(stem)}.${imageExtension}`,
        clientPath: `cliente/data/${imagePath}.${imageExtension}`,
        contentType,
      });
    } else {
      const fileName = `${entry.kind}_${entry.xmlId}_${safeName(entry.name)}.${imageExtension}`;
      files.push({ part: "image", fileName, clientPath: `previews/${entry.kind}/${fileName}`, contentType });
    }
  }

  if (entry.kind === "shaders") {
    const baseName = safeName(entry.shaderName || `shader_${entry.xmlId}`);
    if (entry.hasShaderSource) {
      const fileName = safeName(entry.shaderFileName || `${baseName}.frag`);
      files.push({ part: "fragment", fileName, clientPath: `cliente/data/shaders/${fileName}`, contentType: "text/plain" });
    }
    if (entry.hasShaderVertex) {
      const fileName = `${baseName}_vertex.frag`;
      files.push({ part: "vertex", fileName, clientPath: `cliente/data/shaders/${fileName}`, contentType: "text/plain" });
    }
    if (entry.shaderTex1Ext) {
      const fileName = `${baseName}.${entry.shaderTex1Ext}`;
      files.push({
        part: "tex1",
        fileName,
        clientPath: `cliente/data/images/shaders/${fileName}`,
        contentType: IMAGE_CONTENT_TYPES[entry.shaderTex1Ext] ?? "application/octet-stream",
      });
    }
  }

  return files;
}
