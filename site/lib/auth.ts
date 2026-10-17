import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import { sha1 } from "@/lib/crypto";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        name: { label: "Conta", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const name = credentials?.name;
        const password = credentials?.password;

        if (typeof name !== "string" || typeof password !== "string") {
          return null;
        }

        const account = await prisma.account.findUnique({ where: { name } });

        if (!account || account.blocked) {
          return null;
        }

        if (account.password !== sha1(password)) {
          return null;
        }

        return {
          id: String(account.id),
          name: account.name,
          email: account.email || undefined,
          groupId: account.groupId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.groupId = (user as { groupId: number }).groupId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.groupId = token.groupId as number;
      }
      return session;
    },
  },
});

export { ADMIN_MIN_GROUP_ID, SITE_ADMIN_GROUP_ID, isAdmin, isSiteAdmin } from "@/lib/auth-constants";
