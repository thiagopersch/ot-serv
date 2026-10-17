import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sha1 } from "@/lib/crypto";
import { resetPasswordSchema } from "@/lib/validations/reset-password";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const body = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "Link de recuperação inválido ou expirado." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.account.update({
      where: { id: resetToken.accountId },
      data: { password: sha1(parsed.data.password) },
    }),
    prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
