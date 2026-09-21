import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "CUSTOMER" | "ADMIN";
      sessionVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: "CUSTOMER" | "ADMIN";
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: "CUSTOMER" | "ADMIN";
    sessionVersion: number;
  }
}
