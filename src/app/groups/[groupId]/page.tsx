import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Settings, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AddTitleDialog } from "@/components/add-title-dialog";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { buttonVariants } from "@/components/ui/button";
import { GroupContentView } from "./group-content-view";
import { markConsumed } from "@/lib/actions/titles";
import { submitReview } from "@/lib/actions/reviews";
import { voteOnTitle } from "@/lib/actions/votes";
import { isNotFound } from "@/lib/pocketbase/errors";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type {
  GroupMembersResponse,
  GroupsResponse,
  ReviewsResponse,
  TitlesResponse,
  UsersResponse,
  VotesResponse,
} from "@/types/pocketbase-types";

type TitleExpand = {
  addedBy?: UsersResponse;
  votes_via_title?: VotesResponse[];
  reviews_via_title?: ReviewsResponse<{ user?: UsersResponse }>[];
};

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { groupId } = await params;
  const pb = await getSuperuserClient();

  let group: GroupsResponse;
  try {
    await pb
      .collection("group_members")
      .getFirstListItem(
        pb.filter("group = {:groupId} && user = {:userId}", {
          groupId,
          userId: session.id,
        }),
      );
    group = await pb.collection("groups").getOne<GroupsResponse>(groupId);
  } catch (err) {
    if (isNotFound(err)) notFound();
    throw err;
  }

  const [members, groupTitles, userRecord] = await Promise.all([
    pb
      .collection("group_members")
      .getFullList<GroupMembersResponse<{ user?: UsersResponse }>>({
        filter: pb.filter("group = {:groupId}", { groupId }),
        expand: "user",
      }),
    pb.collection("titles").getFullList<TitlesResponse<TitleExpand>>({
      filter: pb.filter("group = {:groupId}", { groupId }),
      expand: "addedBy,votes_via_title,reviews_via_title.user",
      sort: "-createdAt",
    }),
    pb.collection("users").getOne<UsersResponse>(session.id).catch(() => null),
  ]);

  const withScore = groupTitles.map((title) => {
    const votes = title.expand?.votes_via_title ?? [];
    const score = votes.reduce(
      (acc, v) => acc + (v.value === "up" ? 1 : -1),
      0,
    );
    const userVote = votes.find((v) => v.user === session.id)?.value;
    return { ...title, score, userVote };
  });

  const proposed = withScore
    .filter((t) => t.status === "proposed")
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const consumed = withScore.filter((t) => t.status === "consumed");

  const currentUser = {
    id: session.id,
    email: session.email,
    name: userRecord?.name,
    avatarUrl: userRecord?.avatarUrl,
    isAdmin: session.isAdmin,
  };

  async function handleVote(titleId: string, value: "up" | "down") {
    "use server";
    await voteOnTitle(titleId, groupId, value);
  }

  async function handleMarkConsumed(titleId: string) {
    "use server";
    await markConsumed(titleId, groupId);
  }

  async function handleSubmitReview(titleId: string, formData: FormData) {
    "use server";
    await submitReview(titleId, groupId, formData);
  }

  return (
    <AppShell
      user={currentUser}
      maxWidth="wide"
      backHref="/groups"
      backLabel="Tüm Gruplar"
      headerActions={
        <Link
          href={`/groups/${groupId}/settings`}
          className={buttonVariants({
            variant: "ghost",
            size: "icon-sm",
            className: "text-muted-foreground",
          })}
        >
          <Settings className="size-4" />
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Group Hero Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {group.name}
              </h1>
              <CopyInviteButton code={group.inviteCode} />
            </div>
            <p className="text-xs text-muted-foreground">
              {members.length} üye &middot; {proposed.length} sıradaki &middot; {consumed.length} tamamlanan
            </p>
          </div>

          <div className="flex items-center gap-2">
            <AddTitleDialog groupId={groupId} groupName={group.name} />

            <Link
              href={`/groups/${groupId}/settings`}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "gap-1.5 text-muted-foreground hover:text-foreground",
              })}
            >
              <Settings className="size-4" />
              <span className="hidden sm:inline">Ayarlar</span>
            </Link>
          </div>
        </div>

        {/* Group Content Tabs & List */}
        <GroupContentView
          group={group}
          members={members}
          proposed={proposed}
          consumed={consumed}
          currentUserId={session.id}
          onVote={handleVote}
          onMarkConsumed={handleMarkConsumed}
          onSubmitReview={handleSubmitReview}
        />

        {/* Floating Action Button (Bottom Right FAB) */}
        <div className="fixed bottom-20 sm:bottom-8 right-5 sm:right-8 z-40">
          <AddTitleDialog
            groupId={groupId}
            groupName={group.name}
            trigger={
              <button
                type="button"
                className="group flex items-center gap-2 px-4 py-3 sm:px-5 sm:py-3.5 rounded-full bg-primary text-primary-foreground font-semibold text-xs sm:text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring cursor-pointer"
                aria-label="Medya Öner"
              >
                <Plus className="size-4 sm:size-5 transition-transform group-hover:rotate-90" />
                <span>Medya Öner</span>
              </button>
            }
          />
        </div>
      </div>
    </AppShell>
  );
}
