"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { recoverSchema, type RecoverInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function RecoverForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RecoverInput>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: RecoverInput) {
    setIsSubmitting(true);

    const response = await fetch("/api/accounts/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      toast.error("Não foi possível processar a solicitação.");
      return;
    }

    toast.success("Se o e-mail existir, enviaremos as instruções de recuperação.");
    form.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar conta</CardTitle>
        <CardDescription>
          Informe o e-mail cadastrado para receber o link de redefinição de senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting} className="mt-2">
              {isSubmitting ? "Enviando..." : "Enviar instruções"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
