import type {
  MilestoneCommentsResponse,
  UsersResponse,
} from "@/types/pocketbase-types";

export interface MilestoneCommentItem {
  id: string;
  milestone: string;
  user: string;
  group: string;
  content?: string;
  isSpoiler?: boolean;
  createdAt: string;
  isLocked?: boolean;
  author?: {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
}

export interface MilestoneCommentsResult {
  comments: MilestoneCommentItem[];
  isLocked: boolean;
  lockedCount: number;
  hasCheckedIn: boolean;
}

export function filterMilestoneCommentsForViewer(
  records: MilestoneCommentsResponse<{ user?: UsersResponse }>[],
  hasCheckedIn: boolean,
): MilestoneCommentsResult {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return {
      comments: [],
      isLocked: !hasCheckedIn,
      lockedCount: 0,
      hasCheckedIn,
    };
  }

  if (!hasCheckedIn) {
    // Redact comment bodies to protect user from spoilers before checkin
    const redactedComments: MilestoneCommentItem[] = records.map((c) => ({
      id: c.id,
      milestone: c.milestone,
      user: c.user,
      group: c.group,
      isSpoiler: c.isSpoiler,
      createdAt: c.createdAt,
      isLocked: true,
      author: c.expand?.user
        ? {
            id: c.expand.user.id,
            name: c.expand.user.name,
            avatarUrl: c.expand.user.avatarUrl,
          }
        : undefined,
    }));

    return {
      comments: redactedComments,
      isLocked: true,
      lockedCount: records.length,
      hasCheckedIn: false,
    };
  }

  const fullComments: MilestoneCommentItem[] = records.map((c) => ({
    id: c.id,
    milestone: c.milestone,
    user: c.user,
    group: c.group,
    content: c.content,
    isSpoiler: c.isSpoiler,
    createdAt: c.createdAt,
    isLocked: false,
    author: c.expand?.user
      ? {
          id: c.expand.user.id,
          name: c.expand.user.name,
          
          avatarUrl: c.expand.user.avatarUrl,
        }
      : undefined,
  }));

  return {
    comments: fullComments,
    isLocked: false,
    lockedCount: 0,
    hasCheckedIn: true,
  };
}
