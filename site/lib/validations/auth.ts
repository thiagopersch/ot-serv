import { z } from "zod";

import { passwordSchema } from "@/lib/validations/password";

// Mesmas regras do registro — por decisão explícita, contas antigas fora desses
// padrões (ex.: senha sem maiúscula/especial) não conseguem logar até trocarem a senha.
export const loginSchema = z.object({
  name: z
    .string()
    .min(6, "A conta deve ter ao menos 6 caracteres")
    .max(32, "A conta deve ter no máximo 32 caracteres"),
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(6, "A conta deve ter ao menos 6 caracteres")
      .max(32, "A conta deve ter no máximo 32 caracteres")
      .regex(/^[a-zA-Z0-9_]+$/, "Use apenas letras, números e underline"),
    email: z
      .email("E-mail inválido")
      .max(150, "O e-mail deve ter no máximo 150 caracteres"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const recoverSchema = z.object({
  email: z.email("E-mail inválido"),
});

export type RecoverInput = z.infer<typeof recoverSchema>;
