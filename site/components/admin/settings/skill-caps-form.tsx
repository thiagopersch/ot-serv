"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { skillCapsFormSchema, type SkillCapsFormInput } from "@/lib/validations/admin/skill-caps";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";

export function SkillCapsForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data, isLoading } = useSWR<SkillCapsFormInput>("/api/admin/skill-caps", fetcher);

  const form = useForm<SkillCapsFormInput>({
    resolver: zodResolver(skillCapsFormSchema),
    defaultValues: { dodgeCap: 1000, criticalCap: 1000 },
  });

  useEffect(() => {
    if (data) form.reset(data);
  }, [data, form]);

  async function onSubmit(values: SkillCapsFormInput) {
    setIsSubmitting(true);

    const response = await fetch("/api/admin/skill-caps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      toast.error("Não foi possível salvar.");
      return;
    }

    toast.success("Configurações salvas.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Caps de skill (perfil público)</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField control={form.control} name="dodgeCap" label="Cap de Dodge" disabled={isLoading} />
            <NumberField control={form.control} name="criticalCap" label="Cap de Critical" disabled={isLoading} />
          </div>
        </Form>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          type="button"
          disabled={isSubmitting || isLoading}
          onClick={form.handleSubmit(onSubmit)}
        >
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </CardFooter>
    </Card>
  );
}
