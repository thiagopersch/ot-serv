import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sha1 } from "@/lib/crypto";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: z.treeifyError(parsed.error) },
      { status: 422 }
    );
  }

  const { name, email, password } = parsed.data;

  const [nameTaken, emailTaken] = await Promise.all([
    prisma.account.findUnique({ where: { name } }),
    prisma.account.findFirst({ where: { email } }),
  ]);

  if (nameTaken || emailTaken) {
    return NextResponse.json(
      {
        error: "Verifique os campos destacados.",
        fields: {
          ...(nameTaken ? { name: "Já existe uma conta com esse nome." } : {}),
          ...(emailTaken ? { email: "Já existe uma conta com esse e-mail." } : {}),
        },
      },
      { status: 409 }
    );
  }

  const account = await prisma.account.create({
    data: {
      name,
      email,
      password: sha1(password),
    },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ account }, { status: 201 });
}
