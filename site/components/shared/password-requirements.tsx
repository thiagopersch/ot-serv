"use client";

import { Check, X } from "lucide-react";

import { passwordRules } from "@/lib/validations/password";
import { cn } from "@/lib/utils";

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="mt-1 grid gap-1 sm:grid-cols-2">
      {passwordRules.map((rule) => {
        const met = rule.test(password);

        return (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              met ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
            )}
          >
            {met ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
