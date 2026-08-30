/**
 * Generated via pocketbase-typegen against a live instance running
 * pb_migrations/, with one manual simplification: TitlesRecord/Response
 * dropped the auto-generated `Tmetadata` generic (typegen adds one per
 * `json` field) in favor of a fixed `Record<string, unknown> | null` type,
 * so every collection here consistently takes a single `Texpand` generic —
 * matching how this app actually uses these types everywhere.
 *
 * Regenerate with:
 *   bunx pocketbase-typegen --url $PB_URL --email $PB_SUPERUSER_EMAIL --password $PB_SUPERUSER_PASSWORD --out src/types/pocketbase-types.ts
 * and reapply the metadata-generic simplification above if it drifts.
 */

import type PocketBase from "pocketbase";
import type { RecordService } from "pocketbase";
import type { MoodType, PaceType } from "@/lib/moods";

export type { MoodType, PaceType };

export const Collections = {
  Authorigins: "_authOrigins",
  Externalauths: "_externalAuths",
  Mfas: "_mfas",
  Otps: "_otps",
  Superusers: "_superusers",
  Comments: "comments",
  GroupMembers: "group_members",
  Groups: "groups",
  Reviews: "reviews",
  Titles: "titles",
  Users: "users",
  Votes: "votes",
  UserMediaProgress: "user_media_progress",
  GroupSchedules: "group_schedules",
  ScheduleMilestones: "schedule_milestones",
  MilestoneCheckins: "milestone_checkins",
  MilestoneComments: "milestone_comments",
  ShelfQuotes: "shelf_quotes",
  LlmUsage: "llm_usage",
} as const;
export type Collections = (typeof Collections)[keyof typeof Collections];

// Alias types for improved usability
export type IsoDateString = string;
export type IsoAutoDateString = string & { readonly autodate: unique symbol };
export type RecordIdString = string;
export type FileNameString = string & { readonly filename: unique symbol };

type ExpandType<T> = unknown extends T
  ? T extends unknown
    ? { expand?: unknown }
    : { expand: T }
  : { expand: T };

// System fields
export type BaseSystemFields<T = unknown> = {
  id: RecordIdString;
  collectionId: string;
  collectionName: Collections;
} & ExpandType<T>;

export type AuthSystemFields<T = unknown> = {
  email: string;
  emailVisibility: boolean;
  verified: boolean;
} & BaseSystemFields<T>;

export type CommentsRecord = {
  content: string;
  createdAt: IsoAutoDateString;
  group: RecordIdString;
  id: string;
  parentId?: RecordIdString;
  title: RecordIdString;
  user: RecordIdString;
};

export const GroupMembersRoleOptions = {
  owner: "owner",
  member: "member",
} as const;
export type GroupMembersRoleOptions =
  (typeof GroupMembersRoleOptions)[keyof typeof GroupMembersRoleOptions];
export type GroupMembersRecord = {
  group: RecordIdString;
  id: string;
  joinedAt: IsoAutoDateString;
  role: GroupMembersRoleOptions;
  user: RecordIdString;
};

export interface GroupGuestSettings {
  visibility: {
    backlog: boolean;
    finished: boolean;
    reviews: boolean;
    comments: boolean;
  };
  permissions: {
    canVote: boolean;
    canComment: boolean;
    canReview: boolean;
    canPropose: boolean;
  };
}

export type GroupsRecord = {
  createdAt: IsoAutoDateString;
  createdBy: RecordIdString;
  guestSettings?: GroupGuestSettings | null;
  id: string;
  inviteCode: string;
  isBlindPickEnabled?: boolean;
  isPublic?: boolean;
  name: string;
};

export type ReviewsRecord = {
  createdAt: IsoAutoDateString;
  id: string;
  rating: number;
  reviewText?: string;
  title: RecordIdString;
  user: RecordIdString;
};

export const TitlesMediaTypeOptions = {
  book: "book",
  movie: "movie",
  tv: "tv",
  music: "music",
  podcast: "podcast",
} as const;
export type TitlesMediaTypeOptions =
  (typeof TitlesMediaTypeOptions)[keyof typeof TitlesMediaTypeOptions];

export const TitlesStatusOptions = {
  proposed: "proposed",
  consumed: "consumed",
} as const;
export type TitlesStatusOptions =
  (typeof TitlesStatusOptions)[keyof typeof TitlesStatusOptions];
export type TitlesRecord = {
  addedBy: RecordIdString;
  consumedAt?: IsoDateString;
  coverUrl?: string;
  createdAt: IsoAutoDateString;
  creator?: string;
  externalId: string;
  externalSource: string;
  group: RecordIdString;
  id: string;
  mediaType: TitlesMediaTypeOptions;
  metadata?: Record<string, unknown> | null;
  status: TitlesStatusOptions;
  title: string;
};

export type UsersRecord = {
  avatarUrl?: string;
  bannedAt?: IsoDateString;
  created: IsoAutoDateString;
  email: string;
  emailVisibility?: boolean;
  id: string;
  isAdmin?: boolean;
  name?: string;
  updated: IsoAutoDateString;
  verified?: boolean;
};

export const VotesValueOptions = {
  up: "up",
  down: "down",
} as const;
export type VotesValueOptions =
  (typeof VotesValueOptions)[keyof typeof VotesValueOptions];
export type VotesRecord = {
  createdAt: IsoAutoDateString;
  id: string;
  title: RecordIdString;
  user: RecordIdString;
  value: VotesValueOptions;
};

export const UserMediaProgressStatusOptions = {
  in_progress: "in_progress",
  completed: "completed",
  plan_to_consume: "plan_to_consume",
  on_hold: "on_hold",
  dropped: "dropped",
} as const;
export type UserMediaProgressStatusOptions =
  (typeof UserMediaProgressStatusOptions)[keyof typeof UserMediaProgressStatusOptions];

export const UserMediaProgressUnitOptions = {
  pages: "pages",
  chapters: "chapters",
  episodes: "episodes",
  percent: "percent",
  minutes: "minutes",
} as const;
export type UserMediaProgressUnitOptions =
  (typeof UserMediaProgressUnitOptions)[keyof typeof UserMediaProgressUnitOptions];

export type UserMediaProgressRecord = {
  user: RecordIdString;
  groupTitle?: RecordIdString;
  mediaType: TitlesMediaTypeOptions;
  externalSource?: string;
  externalId?: string;
  title: string;
  creator?: string;
  coverUrl?: string;
  status: UserMediaProgressStatusOptions;
  progressCurrent?: number;
  progressTotal?: number;
  progressUnit?: UserMediaProgressUnitOptions;
  currentLabel?: string;
  notes?: string;
  rating?: number;
  moods?: MoodType[] | null;
  pace?: PaceType | null;
  isSharedWithCircles?: boolean;
  startedAt?: IsoDateString;
  completedAt?: IsoDateString;
  createdAt: IsoAutoDateString;
  updatedAt: IsoAutoDateString;
};

export const GroupSchedulesStatusOptions = {
  active: "active",
  completed: "completed",
  archived: "archived",
} as const;
export type GroupSchedulesStatusOptions =
  (typeof GroupSchedulesStatusOptions)[keyof typeof GroupSchedulesStatusOptions];

export type GroupSchedulesRecord = {
  group: RecordIdString;
  title?: RecordIdString;
  name: string;
  description?: string;
  startDate?: IsoDateString;
  targetDate?: IsoDateString;
  status: GroupSchedulesStatusOptions;
  createdBy: RecordIdString;
  createdAt: IsoAutoDateString;
};

export type ScheduleMilestonesRecord = {
  schedule: RecordIdString;
  title: string;
  targetDate?: IsoDateString;
  targetUnit?: string;
  orderIndex: number;
  createdAt: IsoAutoDateString;
};

export type MilestoneCheckinsRecord = {
  milestone: RecordIdString;
  user: RecordIdString;
  completedAt: IsoAutoDateString;
};

export type MilestoneCommentsRecord = {
  milestone: RecordIdString;
  user: RecordIdString;
  group: RecordIdString;
  content: string;
  isSpoiler?: boolean;
  createdAt: IsoAutoDateString;
};

export type ShelfQuotesRecord = {
  user: RecordIdString;
  progressItem?: RecordIdString;
  mediaType?: string;
  titleName: string;
  quoteText: string;
  attribution?: string;
  tags?: string[] | null;
  isSharedWithCircles?: string[] | null;
  createdAt: IsoAutoDateString;
};

export type LlmUsageKindOptions = "request" | "input";

export type LlmUsageRecord = {
  user: RecordIdString;
  window: string;
  kind: LlmUsageKindOptions;
  requestId: string;
  createdAt: IsoAutoDateString;
};

// Response types include system fields and match responses from the PocketBase API
export type CommentsResponse<Texpand = unknown> =
  Required<CommentsRecord> & BaseSystemFields<Texpand>;
export type GroupMembersResponse<Texpand = unknown> =
  Required<GroupMembersRecord> & BaseSystemFields<Texpand>;
export type GroupsResponse<Texpand = unknown> = Required<GroupsRecord> &
  BaseSystemFields<Texpand>;
export type ReviewsResponse<Texpand = unknown> = Required<ReviewsRecord> &
  BaseSystemFields<Texpand>;
export type TitlesResponse<Texpand = unknown> = Required<TitlesRecord> &
  BaseSystemFields<Texpand>;
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> &
  AuthSystemFields<Texpand>;
export type VotesResponse<Texpand = unknown> = Required<VotesRecord> &
  BaseSystemFields<Texpand>;
export type UserMediaProgressResponse<Texpand = unknown> =
  Required<UserMediaProgressRecord> & BaseSystemFields<Texpand>;
export type GroupSchedulesResponse<Texpand = unknown> =
  Required<GroupSchedulesRecord> & BaseSystemFields<Texpand>;
export type ScheduleMilestonesResponse<Texpand = unknown> =
  Required<ScheduleMilestonesRecord> & BaseSystemFields<Texpand>;
export type MilestoneCheckinsResponse<Texpand = unknown> =
  Required<MilestoneCheckinsRecord> & BaseSystemFields<Texpand>;
export type MilestoneCommentsResponse<Texpand = unknown> =
  Required<MilestoneCommentsRecord> & BaseSystemFields<Texpand>;
export type ShelfQuotesResponse<Texpand = unknown> =
  Required<ShelfQuotesRecord> & BaseSystemFields<Texpand>;
export type LlmUsageResponse<Texpand = unknown> =
  Required<LlmUsageRecord> & BaseSystemFields<Texpand>;

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
  comments: CommentsRecord;
  group_members: GroupMembersRecord;
  groups: GroupsRecord;
  reviews: ReviewsRecord;
  titles: TitlesRecord;
  users: UsersRecord;
  votes: VotesRecord;
  user_media_progress: UserMediaProgressRecord;
  group_schedules: GroupSchedulesRecord;
  schedule_milestones: ScheduleMilestonesRecord;
  milestone_checkins: MilestoneCheckinsRecord;
  milestone_comments: MilestoneCommentsRecord;
  shelf_quotes: ShelfQuotesRecord;
  llm_usage: LlmUsageRecord;
};

export type CollectionResponses = {
  comments: CommentsResponse;
  group_members: GroupMembersResponse;
  groups: GroupsResponse;
  reviews: ReviewsResponse;
  titles: TitlesResponse;
  users: UsersResponse;
  votes: VotesResponse;
  user_media_progress: UserMediaProgressResponse;
  group_schedules: GroupSchedulesResponse;
  schedule_milestones: ScheduleMilestonesResponse;
  milestone_checkins: MilestoneCheckinsResponse;
  milestone_comments: MilestoneCommentsResponse;
  shelf_quotes: ShelfQuotesResponse;
  llm_usage: LlmUsageResponse;
};

// Type for usage with a type-asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions
export type TypedPocketBase = {
  collection<T extends keyof CollectionResponses>(
    idOrName: T,
  ): RecordService<CollectionResponses[T]>;
} & PocketBase;
