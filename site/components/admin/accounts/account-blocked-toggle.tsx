"use client";

import { useState } from "react";
import { toast } from "sonner";

type AccountBlockedToggleRow = {
  id: number;
  name: string;
  email: string;
  groupId: number;
  blocked: boolean;
  premdays: number;
  warnings: number;
};

/** Checkbox de bloqueio direto na listagem — evita abrir o CRUD só para bloquear uma
 * conta. O endpoint de edição exige o payload inteiro (`accountUpdateSchema`), então
 * reenvia os campos já visíveis na linha com `blocked` invertido. */
export function AccountBlockedToggle({
  account,
  onToggled,
}: {
  account: AccountBlockedToggleRow;
  onToggled: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleChange(checked: boolean) {
    setIsSubmitting(true);

    const response = await fetch(`/api/admin/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: account.name,
        email: account.email,
        groupId: account.groupId,
        premdays: account.premdays,
        warnings: account.warnings,
        blocked: checked,
        password: "",
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      toast.error("Não foi possível atualizar o bloqueio.");
      return;
    }

    toast.success(checked ? "Conta bloqueada." : "Conta desbloqueada.");
    onToggled();
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap" title="Bloquear conta">
      <input
        type="checkbox"
        className="size-4 cursor-pointer"
        checked={account.blocked}
        disabled={isSubmitting}
        onChange={(event) => handleChange(event.target.checked)}
      />
    </label>
  );
}
