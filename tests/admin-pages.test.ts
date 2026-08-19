import { describe, expect, it } from "bun:test";
import {
  attachTitleTallies,
  buildIdListFilter,
  countByGroup,
  parsePageParam,
} from "@/lib/admin-groups";

describe("parsePageParam", () => {
  it("defaults missing/malformed input to page 1", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
  });

  it("never returns a page below 1", () => {
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-3")).toBe(1);
  });

  it("parses positive page numbers", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("25")).toBe(25);
  });
});

describe("buildIdListFilter", () => {
  it("returns an empty string for no ids", () => {
    expect(buildIdListFilter("group", [])).toBe("");
  });

  it("builds a single equality for one id", () => {
    expect(buildIdListFilter("group", ["abc123"])).toBe('group = "abc123"');
  });

  it("OR-chains ids so every id matches (PB has no `in` operator)", () => {
    expect(buildIdListFilter("group", ["a", "b", "c"])).toBe(
      'group = "a" || group = "b" || group = "c"',
    );
  });
});

describe("countByGroup", () => {
  it("returns an empty map for no rows", () => {
    expect(countByGroup([]).size).toBe(0);
  });

  it("tallies rows per group id", () => {
    const counts = countByGroup([
      { group: "g1" },
      { group: "g2" },
      { group: "g1" },
      { group: "g1" },
      { group: "g3" },
    ]);
    expect(counts.get("g1")).toBe(3);
    expect(counts.get("g2")).toBe(1);
    expect(counts.get("g3")).toBe(1);
    expect(counts.get("missing")).toBeUndefined();
  });
});

describe("attachTitleTallies", () => {
  it("attaches votes and reviews to their titles by id", () => {
    const titles = [{ id: "t1", title: "One" }, { id: "t2", title: "Two" }];
    const votes = [
      { title: "t2", value: "up" },
      { title: "t1", value: "down" },
    ];
    const reviews = [{ title: "t1", rating: 5, reviewText: "body" }];

    const out = attachTitleTallies(titles, votes, reviews);
    expect(out).toHaveLength(2);
    expect(out[0].expand.votes_via_title).toMatchObject([{ title: "t1", value: "down" }]);
    expect(out[0].expand.reviews_via_title).toMatchObject([{ title: "t1", rating: 5, reviewText: "body" }]);
    expect(out[1].expand.votes_via_title).toMatchObject([{ title: "t2", value: "up" }]);
    expect(out[1].expand.reviews_via_title).toEqual([]);
  });

  it("preserves title fields and existing expand entries", () => {
    const titles = [
      {
        id: "t1",
        status: "consumed",
        expand: { addedBy: { name: "Ada" } },
      },
    ];
    const out = attachTitleTallies(titles, [{ title: "t1", value: "up" }], []);
    expect(out[0]).toMatchObject({
      id: "t1",
      status: "consumed",
      expand: { addedBy: { name: "Ada" } },
    });
  });

  it("does not mutate its inputs", () => {
    const titles = [{ id: "t1" }];
    const votes = [{ title: "t1", value: "up" }];
    const reviews = [{ title: "t1", rating: 4 }];
    const out = attachTitleTallies(titles, votes, reviews);
    expect(titles[0]).toEqual({ id: "t1" });
    expect(votes[0]).toEqual({ title: "t1", value: "up" });
    expect(reviews[0]).toEqual({ title: "t1", rating: 4 });
    expect(out).not.toBe(titles);
    expect(out[0].expand.votes_via_title).not.toBe(votes);
  });
});