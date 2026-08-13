import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}

// AdapterUser is declared in @auth/core/adapters — next-auth/adapters just
// re-exports its types, so augmenting that re-export wouldn't merge.
declare module "@auth/core/adapters" {
  interface AdapterUser {
    isAdmin: boolean;
    bannedAt: Date | null;
  }
}
