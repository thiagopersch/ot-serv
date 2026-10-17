import { z } from "zod";

export const CHARACTER_SEXES = [1, 2] as const;

// players.description é VARCHAR(255) no banco — não dá pra permitir mais que isso.
export const characterCommentSchema = z.object({
  description: z.string().max(255, "Máximo de 255 caracteres"),
});

export type CharacterCommentInput = z.infer<typeof characterCommentSchema>;

export const createCharacterSchema = z.object({
  name: z
    .string()
    .min(3, "Informe o nome do personagem")
    .max(35, "Máximo de 35 caracteres")
    .regex(
      /^[A-Za-z]+( [A-Za-z]+)*$/,
      "Use apenas letras (A-Z), sem números, caracteres especiais ou pontuação"
    ),
  sex: z.union([z.literal(1), z.literal(2)], { message: "Selecione o sexo do personagem" }),
  vocationId: z.number().int().min(1, "Selecione a vocação"),
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
