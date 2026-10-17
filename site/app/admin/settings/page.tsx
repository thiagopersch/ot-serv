import type { Metadata } from "next";

import { SkillCapsForm } from "@/components/admin/settings/skill-caps-form";

export const metadata: Metadata = {
  title: "Configurações",
};

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground">Parâmetros administráveis do portal (tabela `server_config`).</p>
      </div>
      <SkillCapsForm />
    </div>
  );
}
