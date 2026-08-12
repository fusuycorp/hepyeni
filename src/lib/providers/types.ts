import type { MediaType } from "@/lib/media-types";

export type NormalizedSearchResult = {
  externalId: string;
  externalSource: string;
  title: string;
  creator?: string;
  coverUrl?: string;
  metadata?: Record<string, unknown>;
};

export interface MediaProvider {
  mediaType: MediaType;
  search(query: string): Promise<NormalizedSearchResult[]>;
}
