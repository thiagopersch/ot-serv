import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { EditCharacterForm } from "@/components/shared/edit-character-form";

export const metadata: Metadata = {
  title: "Editar personagem",
};

export default async function EditCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    redirect(`/login?callbackUrl=/account/characters/${id}/edit`);
  }

  return (
    <div className="px-4 py-12">
      <EditCharacterForm characterId={Number(id)} />
    </div>
  );
}
