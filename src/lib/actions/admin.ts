"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { isNotFound } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { logDiagnostic } from "@/lib/errors";
import type { ActionResult } from "@/types/actions";
import type {
  ReviewsResponse,
  TitlesResponse,
} from "@/types/pocketbase-types";

async function requireCallerAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Please sign in first");
  await requireAdmin(session.id);
  return session.id;
}

export async function setUserAdmin(
  userId: string,
  isAdmin: boolean,
): Promise<ActionResult<void>> {
  try {
    const callerId = await requireCallerAdmin();
    if (userId === callerId) {
      return { success: false, error: "Kendi adminlik yetkinizi değiştiremezsiniz." };
    }

    const pb = await getSuperuserClient();
    await pb.collection("users").update(userId, { isAdmin: Boolean(isAdmin) });

    revalidatePath("/admin/users");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "setUserAdmin", userId });
    return { success: false, error: "Adminlik durumu güncellenemedi.", traceId: diag.traceId };
  }
}

export async function banUser(userId: string): Promise<ActionResult<void>> {
  try {
    const callerId = await requireCallerAdmin();
    if (userId === callerId) {
      return { success: false, error: "Kendinizi banlayamazsınız." };
    }

    const pb = await getSuperuserClient();
    await pb
      .collection("users")
      .update(userId, { bannedAt: new Date().toISOString() });

    revalidatePath("/admin/users");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "banUser", userId });
    return { success: false, error: "Kullanıcı engellenemedi.", traceId: diag.traceId };
  }
}

export async function unbanUser(userId: string): Promise<ActionResult<void>> {
  try {
    await requireCallerAdmin();

    const pb = await getSuperuserClient();
    await pb.collection("users").update(userId, { bannedAt: null });

    revalidatePath("/admin/users");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "unbanUser", userId });
    return { success: false, error: "Kullanıcı engeli kaldırılamadı.", traceId: diag.traceId };
  }
}

export async function adminDeleteGroup(groupId: string): Promise<ActionResult<void>> {
  try {
    await requireCallerAdmin();

    const pb = await getSuperuserClient();
    await pb.collection("groups").delete(groupId);

    revalidatePath("/admin/groups");
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "adminDeleteGroup", groupId });
    return { success: false, error: "Çember silinemedi.", traceId: diag.traceId };
  }
}

export async function adminDeleteTitle(
  titleId: string,
  groupId: string,
): Promise<ActionResult<void>> {
  try {
    await requireCallerAdmin();

    const pb = await getSuperuserClient();
    let title: TitlesResponse;
    try {
      title = await pb.collection("titles").getOne<TitlesResponse>(titleId);
    } catch (err) {
      if (isNotFound(err)) return { success: false, error: "Başlık bulunamadı." };
      throw err;
    }

    if (title.group !== groupId) {
      return { success: false, error: "Başlık bu çembere ait değil." };
    }

    await pb.collection("titles").delete(titleId);

    revalidatePath(`/admin/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "adminDeleteTitle", titleId, groupId });
    return { success: false, error: "Başlık silinemedi.", traceId: diag.traceId };
  }
}

export async function adminDeleteReview(
  reviewId: string,
  groupId: string,
): Promise<ActionResult<void>> {
  try {
    await requireCallerAdmin();

    const pb = await getSuperuserClient();

    let review: ReviewsResponse<{ title?: TitlesResponse }>;
    try {
      review = await pb
        .collection("reviews")
        .getOne<ReviewsResponse<{ title?: TitlesResponse }>>(reviewId, {
          expand: "title",
        });
    } catch (err) {
      if (isNotFound(err)) return { success: false, error: "İnceleme bulunamadı." };
      throw err;
    }

    if (review.expand?.title?.group !== groupId) {
      return { success: false, error: "İnceleme bu çembere ait değil." };
    }

    await pb.collection("reviews").delete(reviewId);

    revalidatePath(`/admin/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "adminDeleteReview", reviewId, groupId });
    return { success: false, error: "İnceleme silinemedi.", traceId: diag.traceId };
  }
}

export async function adminRemoveGroupMember(
  groupId: string,
  userId: string,
): Promise<ActionResult<void>> {
  try {
    await requireCallerAdmin();

    const pb = await getSuperuserClient();
    let member: { id: string };
    try {
      member = await pb
        .collection("group_members")
        .getFirstListItem(
          pb.filter("group = {:groupId} && user = {:userId}", {
            groupId,
            userId,
          }),
        );
    } catch (err) {
      if (isNotFound(err)) return { success: false, error: "Üye bulunamadı." };
      throw err;
    }

    await pb.collection("group_members").delete(member.id);

    revalidatePath(`/admin/groups/${groupId}`);
    return { success: true, data: undefined };
  } catch (err) {
    const diag = logDiagnostic(err, { action: "adminRemoveGroupMember", groupId, userId });
    return { success: false, error: "Üye gruptan çıkarılamadı.", traceId: diag.traceId };
  }
}
