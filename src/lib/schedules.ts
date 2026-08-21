import type {
  MilestoneCommentsResponse,
  UsersResponse,
} from "@/types/pocketbase-types";
import { pickReviewerUser, type ReviewerUser } from "@/lib/group-titles";

export interface MilestoneCommentItem {
  id: string;
  milestone: string;
  user: string;
  group: string;
  content?: string;
  isSpoiler?: boolean;
  createdAt: string;
  isLocked?: boolean;
  author?: ReviewerUser;
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
      author: pickReviewerUser(c.expand?.user),
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
    author: pickReviewerUser(c.expand?.user),
  }));

  return {
    comments: fullComments,
    isLocked: false,
    lockedCount: 0,
    hasCheckedIn: true,
  };
}
