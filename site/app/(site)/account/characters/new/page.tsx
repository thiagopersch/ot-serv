import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { NewCharacterForm } from "@/components/shared/new-character-form";

export const metadata: Metadata = {
  title: "Criar personagem",
};

export default async function NewCharacterPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/account/characters/new");
  }

  return (
    <div className="px-4 py-12">
      <NewCharacterForm />
    </div>
  );
}
