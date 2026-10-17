"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  BAN_TYPES,
  DEFAULT_IP_MASK,
  PLAYER_BAN_PARAMS,
  VIOLATION_ACTIONS,
  banSchema,
  ipToUint32,
  uint32ToIp,
  type BanInput,
} from "@/lib/validations/admin/ban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { EntitySearchCombobox } from "@/components/shared/entity-search-combobox";
import type { Ban } from "@/lib/generated/prisma/client";

type BanFormDialogProps = {
  trigger: React.ReactNode;
  ban?: Ban;
  onSaved: () => void;
};

function defaultParamForType(type: number): number {
  return type === 1 ? DEFAULT_IP_MASK : 0;
}

export function BanFormDialog({ trigger, ban, onSaved }: BanFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultValues: BanInput = {
    type: ban?.type ?? 3,
    value: ban?.value ?? 0,
    param: ban?.param ?? defaultParamForType(ban?.type ?? 3),
    action: ban?.action ?? 0,
    reason: ban?.reason ?? 0,
    comment: ban?.comment ?? "",
    statement: ban?.statement ?? "",
    active: ban?.active ?? true,
    expires: ban?.expires ?? 0,
  };

  const form = useForm<BanInput>({
    resolver: zodResolver(banSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ban]);

  const type = useWatch({ control: form.control, name: "type" });
  const value = useWatch({ control: form.control, name: "value" });

  async function onSubmit(values: BanInput) {
    setIsSubmitting(true);

    const url = ban ? `/api/admin/bans/${ban.id}` : "/api/admin/bans";
    const method = ban ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar o banimento.");
      return;
    }

    toast.success(ban ? "Banimento atualizado." : "Banimento criado.");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ban ? "Editar banimento" : "Novo banimento"}</DialogTitle>
          <DialogDescription>
            O alvo (&quot;Valor&quot;) e o campo &quot;Param&quot; mudam de sentido conforme o tipo — refletem
            exatamente o que o servidor (<code>ioban.cpp</code>) checa para considerar o banimento válido.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => {
                      if (!value) return;
                      const nextType = Number(value);
                      field.onChange(nextType);
                      form.setValue("value", 0);
                      form.setValue("param", defaultParamForType(nextType));
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue>
                          {(v: string) => BAN_TYPES.find((t) => String(t.value) === v)?.label ?? v}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BAN_TYPES.map((banType) => (
                        <SelectItem key={banType.value} value={String(banType.value)} className="cursor-pointer">
                          {banType.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {type === 1 ? (
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="192.168.0.1"
                        defaultValue={field.value ? uint32ToIp(field.value) : ""}
                        onBlur={(event) => {
                          const parsed = ipToUint32(event.target.value);
                          if (parsed != null) field.onChange(parsed);
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Valor salvo (uint32): {value || 0}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : type === 2 || type === 5 ? (
              <FormItem>
                <FormLabel>{type === 2 ? "Personagem" : "Personagem (autor da mensagem)"}</FormLabel>
                <EntitySearchCombobox<{ id: number; name: string }>
                  endpoint="/api/admin/players"
                  value={value || null}
                  formatOption={(player) => `#${player.id} — ${player.name}`}
                  placeholder="Buscar personagem..."
                  onSelect={(player) => form.setValue("value", player?.id ?? 0)}
                />
                <p className="text-xs text-muted-foreground">Guid salvo: {value || 0}</p>
              </FormItem>
            ) : (
              <FormItem>
                <FormLabel>Conta</FormLabel>
                <EntitySearchCombobox<{ id: number; name: string }>
                  endpoint="/api/admin/accounts"
                  value={value || null}
                  formatOption={(account) => `#${account.id} — ${account.name}`}
                  placeholder="Buscar conta..."
                  onSelect={(account) => form.setValue("value", account?.id ?? 0)}
                />
                <p className="text-xs text-muted-foreground">Id salvo: {value || 0}</p>
              </FormItem>
            )}

            {type === 1 ? (
              <FormField
                control={form.control}
                name="param"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máscara de rede (param)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {DEFAULT_IP_MASK} = só o IP exato. Nunca deixe 0 — bane a rede inteira.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : type === 2 ? (
              <FormField
                control={form.control}
                name="param"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de bloqueio (param)</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(value) => value && field.onChange(Number(value))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue>
                            {(v: string) => PLAYER_BAN_PARAMS.find((p) => String(p.value) === v)?.label ?? v}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PLAYER_BAN_PARAMS.map((param) => (
                          <SelectItem key={param.value} value={String(param.value)} className="cursor-pointer">
                            {param.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Obrigatório — o servidor só reconhece o banimento se isto bater exatamente.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="param"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Player relacionado (param, opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Guid do player que originou — 0 = nenhum.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ação (categoria da violação)</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => value && field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue>
                          {(v: string) => VIOLATION_ACTIONS.find((a) => String(a.value) === v)?.label ?? v}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VIOLATION_ACTIONS.map((action) => (
                        <SelectItem key={action.value} value={String(action.value)} className="cursor-pointer">
                          {action.label}
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
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo (reason id)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expires"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expira em (unix, 0 = permanente)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentário</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {type === 5 && (
              <FormField
                control={form.control}
                name="statement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem denunciada (statement)</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Ativo</FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
