import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      groupId: number;
    } & DefaultSession["user"];
  }

  interface User {
    groupId: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    groupId?: number;
  }
}
