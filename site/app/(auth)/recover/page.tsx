import type { Metadata } from "next";

import { RecoverForm } from "@/components/shared/recover-form";

export const metadata: Metadata = {
  title: "Recuperar conta",
};

export default function RecoverPage() {
  return <RecoverForm />;
}
