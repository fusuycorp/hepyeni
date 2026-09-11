import { pickReviewerUser, type PublicUser } from "@/lib/group-titles";
import { redactProposedTitles } from "@/lib/moods";
import type {
 GroupsResponse,
 TitlesResponse,
 UsersResponse,
} from "@/types/pocketbase-types";

export type ActivityTitleExpand = {
 group?: GroupsResponse;
 addedBy?: PublicUser;
};

export type ActivityTitle = TitlesResponse<ActivityTitleExpand>;

/**
 * Project a title for the activity feed.
 *
 * Closes two leaks on this surface, both by reusing the logic the circle page
 * already applies rather than re-deriving it:
 *  - Blind pick (ADR-012): `redactProposedTitles` strips proposer identity for
 *    non-owner/admin viewers. The feed previously skipped it, so it silently
 *    deanonymized every proposal in a blind-pick circle.
 *  - PII (R2): `pickReviewerUser` narrows the author expand to
 *    {id, name, avatarUrl}, so `email` never enters the RSC payload.
 *
 * Pure and exported so a test can assert the SHIPPED projection instead of a
 * local re-implementation that can silently drift from it.
 */
export function projectActivityTitle(
 title: TitlesResponse<{ group?: GroupsResponse; addedBy?: UsersResponse }>,
 options: { isOwnerOrAdmin: boolean },
): ActivityTitle {
 const group = title.expand?.group;
 const [redacted] = redactProposedTitles(
  [title],
  group?.isBlindPickEnabled,
  options.isOwnerOrAdmin,
 );
 // redactProposedTitles returns the item unchanged when no redaction applies,
 // but keep an explicit fallback so an unexpected empty result cannot drop the
 // row from the feed entirely.
 const source = redacted ?? title;
 const addedBy = pickReviewerUser(source.expand?.addedBy);

 return {
  ...source,
  expand: {
   ...source.expand,
   ...(group ? { group } : {}),
   // Omitted when redacted, which is what hides the proposer identity.
   ...(addedBy ? { addedBy } : {}),
  },
 };
}
