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

export type GroupsRecord = {
  createdAt: IsoAutoDateString;
  createdBy: RecordIdString;
  id: string;
  inviteCode: string;
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

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
  comments: CommentsRecord;
  group_members: GroupMembersRecord;
  groups: GroupsRecord;
  reviews: ReviewsRecord;
  titles: TitlesRecord;
  users: UsersRecord;
  votes: VotesRecord;
};

export type CollectionResponses = {
  comments: CommentsResponse;
  group_members: GroupMembersResponse;
  groups: GroupsResponse;
  reviews: ReviewsResponse;
  titles: TitlesResponse;
  users: UsersResponse;
  votes: VotesResponse;
};

// Type for usage with a type-asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions
export type TypedPocketBase = {
  collection<T extends keyof CollectionResponses>(
    idOrName: T,
  ): RecordService<CollectionResponses[T]>;
} & PocketBase;
