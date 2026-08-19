import type { MediaType } from "@/lib/media-types";
import type { NormalizedSearchResult } from "@/lib/providers/types";
import type { ExtractedCandidate } from "./validate";

export interface CandidateDraft {
  raw: ExtractedCandidate;
  matches: NormalizedSearchResult[];
}

export interface UserGroupOption {
  id: string;
  name: string;
}

export interface ExtractResult {
  candidates: CandidateDraft[];
  userGroups: UserGroupOption[];
  dropped: number;
}

export interface ProposeEntry {
  mediaType: MediaType;
  match?: NormalizedSearchResult;
  custom?: { title: string; creator?: string };
}

export interface ProposeResult {
  addedCount: number;
  skippedCount: number;
}