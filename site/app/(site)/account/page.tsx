import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AccountDashboard } from "@/components/shared/account-dashboard";

export const metadata: Metadata = {
  title: "Minha conta",
};

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/account");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <AccountDashboard />
    </div>
  );
}
