import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  uuid,
  jsonb,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import { MEDIA_TYPES } from "@/lib/media-types";

// --- Auth.js standard tables ---

export const users = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ],
);

// --- Product tables ---

export const groupRoleEnum = pgEnum("group_role", ["owner", "member"]);
export const mediaTypeEnum = pgEnum("media_type", MEDIA_TYPES);
export const titleStatusEnum = pgEnum("title_status", [
  "proposed",
  "consumed",
]);
export const voteValueEnum = pgEnum("vote_value", ["up", "down"]);

export const groups = pgTable("group", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").unique().notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const groupMembers = pgTable(
  "group_member",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: groupRoleEnum("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
  },
  (member) => [primaryKey({ columns: [member.groupId, member.userId] })],
);

export const titles = pgTable(
  "title",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    mediaType: mediaTypeEnum("media_type").notNull(),
    externalSource: text("external_source").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    creator: text("creator"),
    coverUrl: text("cover_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    status: titleStatusEnum("status").default("proposed").notNull(),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    consumedAt: timestamp("consumed_at", { mode: "date" }),
  },
  (title) => [
    // Prevents duplicate entries for the same external title within a
    // group — e.g. a client retrying `addTitle` after a spurious error.
    uniqueIndex("title_group_external_unique").on(
      title.groupId,
      title.externalSource,
      title.externalId,
    ),
  ],
);

export const votes = pgTable(
  "vote",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: voteValueEnum("value").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (vote) => [
    uniqueIndex("vote_title_user_unique").on(vote.titleId, vote.userId),
  ],
);

export const reviews = pgTable(
  "review",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    reviewText: text("review_text"),
    createdAt: timestamp("created_at", { mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (review) => [
    uniqueIndex("review_title_user_unique").on(review.titleId, review.userId),
  ],
);

// --- Relations (used for query-builder joins) ---

export const usersRelations = relations(users, ({ many }) => ({
  groupMemberships: many(groupMembers),
  titlesAdded: many(titles),
  votes: many(votes),
  reviews: many(reviews),
}));

export const groupsRelations = relations(groups, ({ many, one }) => ({
  members: many(groupMembers),
  titles: many(titles),
  creator: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const titlesRelations = relations(titles, ({ one, many }) => ({
  group: one(groups, {
    fields: [titles.groupId],
    references: [groups.id],
  }),
  addedByUser: one(users, {
    fields: [titles.addedBy],
    references: [users.id],
  }),
  votes: many(votes),
  reviews: many(reviews),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  title: one(titles, { fields: [votes.titleId], references: [titles.id] }),
  user: one(users, { fields: [votes.userId], references: [users.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  title: one(titles, { fields: [reviews.titleId], references: [titles.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
}));
