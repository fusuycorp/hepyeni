import { describe, expect, it } from "bun:test";
import { en } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

describe("Recommender Filtering & i18n Parity", () => {
  it("enforces full translation parity for recommender filter keys", () => {
    const filterKeys = [
      "filterByRecommender",
      "allRecommenders",
      "myRecommendations",
      "recommenderLabel",
      "noRecommendationsFilter",
      "clearFilters",
    ] as const;

    for (const key of filterKeys) {
      expect(en.groups[key]).toBeDefined();
      expect(en.groups[key].length).toBeGreaterThan(0);
      expect(tr.groups[key]).toBeDefined();
      expect(tr.groups[key].length).toBeGreaterThan(0);
    }
  });

  it("filters titles correctly by recommender and media type", () => {
    const mockTitles = [
      { id: "1", title: "Dune", mediaType: "book", addedBy: "user_a" },
      { id: "2", title: "The Matrix", mediaType: "movie", addedBy: "user_a" },
      { id: "3", title: "Abbey Road", mediaType: "music", addedBy: "user_b" },
      { id: "4", title: "Huberman Lab", mediaType: "podcast", addedBy: "user_c" },
    ];

    const currentUserId = "user_a";

    const filterTitles = (mediaType: string, recommender: string) => {
      return mockTitles.filter((item) => {
        const matchesType = mediaType === "all" ? true : item.mediaType === mediaType;
        const matchesRecommender =
          recommender === "all"
            ? true
            : recommender === "me"
            ? item.addedBy === currentUserId
            : item.addedBy === recommender;
        return matchesType && matchesRecommender;
      });
    };

    // All titles
    expect(filterTitles("all", "all")).toHaveLength(4);

    // My recommendations (user_a)
    const myRecs = filterTitles("all", "me");
    expect(myRecs).toHaveLength(2);
    expect(myRecs.every((i) => i.addedBy === "user_a")).toBe(true);

    // Filter by specific recommender user_b
    const userBRecs = filterTitles("all", "user_b");
    expect(userBRecs).toHaveLength(1);
    expect(userBRecs[0].title).toBe("Abbey Road");

    // Combined filter: user_a + book
    const userABook = filterTitles("book", "user_a");
    expect(userABook).toHaveLength(1);
    expect(userABook[0].title).toBe("Dune");

    // Combined filter with 0 results: user_a + music
    const userAMusic = filterTitles("music", "user_a");
    expect(userAMusic).toHaveLength(0);
  });
});
