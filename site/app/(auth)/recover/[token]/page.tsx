import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/shared/reset-password-form";

export const metadata: Metadata = {
  title: "Redefinir senha",
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <ResetPasswordForm token={token} />;
}
