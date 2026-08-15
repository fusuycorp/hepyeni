import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type { UsersResponse } from "@/types/pocketbase-types";

export async function requireAdmin(userId: string): Promise<UsersResponse> {
  const pb = await getSuperuserClient();
  const user = await pb.collection("users").getOne<UsersResponse>(userId);
  if (!user.isAdmin) throw new Error("Admin access required");
  return user;
}
