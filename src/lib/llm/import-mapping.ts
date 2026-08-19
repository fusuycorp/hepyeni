import type { NormalizedImportItem } from "@/lib/importers/types";
import type { CandidateDraft } from "./types";

export const USE_AS_IS = -1;

export function mapExtractedCandidateToShelfItem(
  candidate: CandidateDraft,
  matchIndex: number,
): NormalizedImportItem {
  const match = matchIndex >= 0 ? candidate.matches[matchIndex] : undefined;
  if (!match) {
    return {
      title: candidate.raw.title,
      creator: candidate.raw.creator,
      mediaType: candidate.raw.mediaType,
      status: "plan_to_consume",
      rating: candidate.raw.rating,
    };
  }

  return {
    title: match.title,
    creator: match.creator,
    mediaType: candidate.raw.mediaType,
    status: "plan_to_consume",
    rating: candidate.raw.rating,
    externalSource: match.externalSource,
    externalId: match.externalId,
    coverUrl: match.coverUrl,
  };
}
