import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 32;
export const PASSWORD_SPECIAL_CHARS = "!@#$%&*";

export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

/**
 * Única fonte de verdade das regras de senha — usada tanto pelo schema Zod
 * (validação real) quanto pelo checklist visual do formulário (feedback ao digitar).
 */
export const passwordRules: PasswordRule[] = [
  {
    id: "minLength",
    label: `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "maxLength",
    label: `Máximo de ${PASSWORD_MAX_LENGTH} caracteres`,
    test: (value) => value.length > 0 && value.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: "uppercase",
    label: "1 letra maiúscula",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "lowercase",
    label: "1 letra minúscula",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "number",
    label: "1 número",
    test: (value) => /[0-9]/.test(value),
  },
  {
    id: "special",
    label: `1 caractere especial (${PASSWORD_SPECIAL_CHARS})`,
    test: (value) => /[!@#$%&*]/.test(value),
  },
];

export function isPasswordValid(value: string): boolean {
  return passwordRules.every((rule) => rule.test(value));
}

export const passwordSchema = z.string().superRefine((value, ctx) => {
  for (const rule of passwordRules) {
    if (!rule.test(value)) {
      ctx.addIssue({ code: "custom", message: `A senha precisa ter ${rule.label.toLowerCase()}` });
    }
  }
});
