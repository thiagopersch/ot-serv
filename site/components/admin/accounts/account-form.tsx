"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { accountUpdateSchema, type AccountUpdateInput } from "@/lib/validations/admin/account";
import { ACCOUNT_GROUPS } from "@/lib/account-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/shared/number-field";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AccountFormProps = {
  accountId: number;
  initialValues: AccountUpdateInput;
};

export function AccountForm({ accountId, initialValues }: AccountFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const form = useForm<AccountUpdateInput>({
    resolver: zodResolver(accountUpdateSchema),
    defaultValues: initialValues,
  });

  async function onSubmit(values: AccountUpdateInput) {
    setIsSubmitting(true);

    const response = await fetch(`/api/admin/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar a conta.");
      return;
    }

    toast.success("Conta atualizada.");
    router.push("/admin/accounts");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar conta</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" maxLength={255} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {changingPassword ? (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Digite a nova senha"
                          maxLength={255}
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="self-start"
                        onClick={() => {
                          form.setValue("password", "");
                          setChangingPassword(false);
                        }}
                      >
                        Cancelar alteração de senha
                      </Button>
                    </FormItem>
                  )}
                />
              ) : (
                <FormItem>
                  <Label>Senha</Label>
                  <Button type="button" variant="outline" onClick={() => setChangingPassword(true)}>
                    Alterar senha
                  </Button>
                </FormItem>
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="off" maxLength={255} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <NumberField control={form.control} name="premdays" label="Dias premium" />
              <NumberField control={form.control} name="warnings" label="Warnings" />
              <FormField
                control={form.control}
                name="groupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grupo</FormLabel>
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) => {
                              const group = ACCOUNT_GROUPS.find((g) => String(g.id) === value);
                              return group ? `${group.id} — ${group.name}` : value;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACCOUNT_GROUPS.map((group) => (
                          <SelectItem key={group.id} value={String(group.id)}>
                            {group.id} — {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="blocked"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 self-end pb-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 font-normal">Conta bloqueada</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" nativeButton={false} render={<Link href="/admin/accounts" />}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
