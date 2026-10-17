import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { randomToken } from "@/lib/crypto";
import { recoverSchema } from "@/lib/validations/auth";
import { sendMail } from "@/lib/mailer";

const TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hora

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = recoverSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 422 });
  }

  const { email } = parsed.data;
  const account = await prisma.account.findFirst({ where: { email } });

  // Resposta genérica sempre, para não permitir enumeração de contas por e-mail.
  if (account) {
    const token = randomToken();

    await prisma.passwordResetToken.create({
      data: {
        accountId: account.id,
        token,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/recover/${token}`;

    await sendMail({
      to: account.email,
      subject: "Recuperação de conta — NDBO",
      html: `
        <p>Olá, ${account.name}.</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
        <p><a href="${resetUrl}">Clique aqui para escolher uma nova senha</a> (válido por 1 hora).</p>
        <p>Se você não solicitou isso, ignore este e-mail.</p>
      `,
    });
  }

  return NextResponse.json({
    message: "Se o e-mail existir, enviaremos as instruções de recuperação.",
  });
}
