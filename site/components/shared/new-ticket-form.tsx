"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { JSONContent } from "@tiptap/react";
import { toast } from "sonner";

import {
  TICKET_CATEGORIES,
  createTicketSchema,
  type CreateTicketInput,
} from "@/lib/validations/ticket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RichTextEditor } from "@/components/shared/rich-text-editor";

const EMPTY_MESSAGE_CONTENT: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export function NewTicketForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [messageContent, setMessageContent] = useState<JSONContent>(EMPTY_MESSAGE_CONTENT);

  const form = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { subject: "", category: "Outro", message: "" },
  });

  async function onSubmit(values: CreateTicketInput) {
    setIsSubmitting(true);

    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      setIsSubmitting(false);
      toast.error("Não foi possível abrir o ticket.");
      return;
    }

    const data = await response.json();
    const [firstMessage] = data.ticket.messages;

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      await fetch(`/api/tickets/${data.ticket.id}/messages/${firstMessage.id}/media`, {
        method: "POST",
        body: formData,
      });
    }

    setIsSubmitting(false);
    toast.success("Ticket aberto com sucesso.");
    router.push(`/support/tickets/${data.ticket.id}`);
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Abrir ticket</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assunto</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TICKET_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
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
              name="message"
              render={() => (
                <FormItem>
                  <FormLabel>Mensagem</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      postId={null}
                      content={messageContent}
                      onChange={(content) => {
                        setMessageContent(content);
                        form.setValue("message", JSON.stringify(content), { shouldValidate: true });
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="ticket-attachments">
                Anexos (imagens ou vídeos, opcional)
              </label>
              <input
                id="ticket-attachments"
                type="file"
                multiple
                accept="image/png,image/gif,image/jpeg,image/webp,video/mp4,video/webm"
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
            <Button type="submit" disabled={isSubmitting} className="mt-2">
              {isSubmitting ? "Enviando..." : "Abrir ticket"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
