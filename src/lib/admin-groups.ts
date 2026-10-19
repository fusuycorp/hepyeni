import type { ReviewsResponse, UsersResponse, VotesResponse } from "@/types/pocketbase-types";

export function parsePageParam(value: string | undefined): number {
  return Math.max(1, Number(value) || 1);
}

const SAFE_FIELD_RE = /^[a-zA-Z0-9_.]{1,64}$/;
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function buildIdListFilter(
  field: string,
  ids: string[],
  pbFilter?: (raw: string, params?: Record<string, unknown>) => string,
): string {
  if (!SAFE_FIELD_RE.test(field)) {
    throw new Error(`Invalid filter field: ${field}`);
  }
  if (ids.length === 0) return "";
  return ids
    .map((id) => {
      if (typeof id !== "string" || !SAFE_ID_RE.test(id)) {
        throw new Error("Invalid record id in filter");
      }
      if (pbFilter) {
        return pbFilter(`${field} = {:id}`, { id });
      }
      return `${field} = ${JSON.stringify(id)}`;
    })
    .join(" || ");
}

export function countByGroup(rows: { group: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.group, (counts.get(row.group) ?? 0) + 1);
  }
  return counts;
}

export function groupByTitle<T extends { title: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.title);
    if (bucket) bucket.push(row);
    else grouped.set(row.title, [row]);
  }
  return grouped;
}

export interface AdminTitleTallies {
  votes_via_title: VotesResponse[];
  reviews_via_title: ReviewsResponse<{ user?: UsersResponse }>[];
}

export function attachTitleTallies<T extends { id: string; expand?: object }>(
  titles: T[],
  votes: { title: string; value?: string }[],
  reviews: { title: string }[],
): (T & { expand: AdminTitleTallies })[] {
  const votesByTitle = groupByTitle(votes);
  const reviewsByTitle = groupByTitle(reviews);
  return titles.map((title) => ({
    ...title,
    expand: {
      ...title.expand,
      votes_via_title: (votesByTitle.get(title.id) ?? []) as VotesResponse[],
      reviews_via_title: (reviewsByTitle.get(title.id) ??
        []) as ReviewsResponse<{ user?: UsersResponse }>[],
    },
  }));
}