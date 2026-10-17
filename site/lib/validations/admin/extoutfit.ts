import { z } from "zod";

/** Tags do `extoutfits.xml`, na ordem em que aparecem no arquivo. */
export const EXTOUTFIT_KINDS = ["wings", "auras", "shaders", "healthbars", "manabars"] as const;
export type ExtOutfitKind = (typeof EXTOUTFIT_KINDS)[number];

export const EXTOUTFIT_KIND_LABELS: Record<ExtOutfitKind, string> = {
  wings: "Wings",
  auras: "Auras",
  shaders: "Shaders",
  healthbars: "Health bars",
  manabars: "Mana bars",
};

/** Qual atributo identifica a aparência de cada tag (mesmos `required` do
 * `server/data/lib/extoutfit_parser.lua`). */
export function extOutfitValueField(kind: ExtOutfitKind): "looktype" | "shadername" | "image" {
  if (kind === "wings" || kind === "auras") return "looktype";
  if (kind === "shaders") return "shadername";
  return "image";
}

export const extOutfitSchema = z
  .object({
    kind: z.enum(EXTOUTFIT_KINDS),
    xmlId: z.number().int().min(1, "Informe o id"),
    name: z.string().trim().min(1, "Informe um nome").max(100),
    /** looktypes.id — obrigatório em wings/auras (valor do XML); nos demais tipos é só a sprite
     * de preview (opcional). 0 = vazio. */
    looktypeId: z.number().int().min(0),
    shaderName: z.string().trim().max(100),
    image: z.string().trim().max(255),
    posx: z.number().int().nullable(),
    posy: z.number().int().nullable(),
  })
  .superRefine((data, ctx) => {
    const field = extOutfitValueField(data.kind);
    if (field === "looktype" && data.looktypeId <= 0) {
      ctx.addIssue({ code: "custom", path: ["looktypeId"], message: "Selecione a looktype." });
    }
    if (field === "shadername" && !data.shaderName) {
      ctx.addIssue({ code: "custom", path: ["shaderName"], message: "Informe o nome do shader." });
    }
    if (field === "image" && !data.image) {
      ctx.addIssue({ code: "custom", path: ["image"], message: "Informe o caminho da imagem." });
    }
  });

export type ExtOutfitInput = z.infer<typeof extOutfitSchema>;

export const defaultExtOutfitValues: ExtOutfitInput = {
  kind: "wings",
  xmlId: 0,
  name: "",
  looktypeId: 0,
  shaderName: "",
  image: "",
  posx: null,
  posy: null,
};
