"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { defaultOutfitValues, outfitSchema, type OutfitInput } from "@/lib/validations/admin/outfit";
import { outfitToXml } from "@/lib/outfit-xml";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { NumberField } from "@/components/shared/number-field";
import { ItemSearchField } from "@/components/shared/item-search-field";
import { XmlPreviewCard } from "@/components/shared/xml-preview-card";
import { OutfitLooktypeSearchField } from "@/components/shared/outfit-looktype-search-field";

type OutfitFormProps = {
  /** Presente na edição — id original (a rota PATCH usa ele, mesmo que o campo id mude). */
  outfitId?: number;
  initialValues?: OutfitInput;
  /** `looktypeNumber` das looktypes iniciais, para o preview do XML. */
  initialLooktypeNumbers?: { male: number | null; female: number | null };
  extraAttributes?: Record<string, string> | null;
};

export function OutfitForm({ outfitId, initialValues, initialLooktypeNumbers, extraAttributes }: OutfitFormProps) {
  const router = useRouter();
  const isEditing = outfitId !== undefined;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maleNumber, setMaleNumber] = useState<number | null>(initialLooktypeNumbers?.male ?? null);
  const [femaleNumber, setFemaleNumber] = useState<number | null>(initialLooktypeNumbers?.female ?? null);
  const [sameLooktype, setSameLooktype] = useState(
    !initialValues || initialValues.maleLooktypeId === initialValues.femaleLooktypeId,
  );

  const form = useForm<OutfitInput, unknown, OutfitInput>({
    resolver: zodResolver(outfitSchema),
    defaultValues: initialValues ?? defaultOutfitValues,
  });

  const values = useWatch({ control: form.control }) as OutfitInput;

  const previewXml = outfitToXml({
    ...values,
    storageId: values.storageId ?? "",
    storageValue: values.storageValue ?? "",
    maleLooktypeNumber: maleNumber,
    femaleLooktypeNumber: sameLooktype ? maleNumber : femaleNumber,
    extraAttributes,
  });

  async function onSubmit(submitted: OutfitInput) {
    setIsSubmitting(true);
    const payload = sameLooktype ? { ...submitted, femaleLooktypeId: submitted.maleLooktypeId } : submitted;

    const response = await fetch(isEditing ? `/api/admin/outfits/${outfitId}` : "/api/admin/outfits", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível salvar a outfit.");
      return;
    }

    toast.success(isEditing ? "Outfit atualizada." : "Outfit criada.");
    router.push("/admin/outfits");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]"
      >
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados da outfit</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <NumberField control={form.control} name="id" label="ID (outfits.xml)" disabled={isEditing} min={1} />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={100} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <NumberField control={form.control} name="type" label="Type" min={0} />
              <FormField
                control={form.control}
                name="premium"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 self-end pb-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer"
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Premium</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="storageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>storageId</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={20} placeholder="Vazio = sem storage" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="storageValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>storageValue (mínimo)</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={20} disabled={!values.storageId} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <OutfitLooktypeSearchField
                control={form.control}
                name="maleLooktypeId"
                label={sameLooktype ? "Looktype" : "Looktype masculina (gender 1)"}
                onLooktypeChange={(looktype) => {
                  setMaleNumber(looktype?.looktypeNumber ?? null);
                  if (sameLooktype) form.setValue("femaleLooktypeId", looktype?.id ?? 0);
                }}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer"
                  checked={sameLooktype}
                  onChange={(event) => {
                    setSameLooktype(event.target.checked);
                    if (event.target.checked) {
                      form.setValue("femaleLooktypeId", form.getValues("maleLooktypeId"));
                      setFemaleNumber(maleNumber);
                    }
                  }}
                />
                Mesma looktype para masculino e feminino
              </label>
              {!sameLooktype && (
                <OutfitLooktypeSearchField
                  control={form.control}
                  name="femaleLooktypeId"
                  label="Looktype feminina (gender 0)"
                  onLooktypeChange={(looktype) => setFemaleNumber(looktype?.looktypeNumber ?? null)}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Item que libera a outfit</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemSearchField
                control={form.control}
                name="unlockItemId"
                label="Item"
                tooltip="Ao usar o item o jogador recebe a outfit (script gerado em 'Script Lua dos itens' na listagem). Deixe vazio se a outfit não é liberada por item."
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              nativeButton={false}
              render={<Link href="/admin/outfits" />}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar outfit"}
            </Button>
          </div>
        </div>

        <XmlPreviewCard value={previewXml} />
      </form>
    </Form>
  );
}
