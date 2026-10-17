import type { Metadata } from "next";

import { RegisterForm } from "@/components/shared/register-form";

export const metadata: Metadata = {
  title: "Cadastro",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
