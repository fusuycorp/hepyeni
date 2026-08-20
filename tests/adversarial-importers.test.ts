import { describe, expect, it } from "bun:test";
import {
  detectImportSource,
  getField,
  normalizeHeaderKey,
  parseCsv,
  parseCsvToTable,
  parseGoodreadsCsv,
  parseImportFile,
  parseLetterboxdCsv,
  parseSafeDate,
  parseStoryGraphCsv,
} from "@/lib/importers";

describe("Adversarial Fuzzing: Importers, Parsers & Data Portability", () => {
  // =========================================================================
  // 1. parseCsv & parseCsvToTable (RFC-4180 Fuzzing & Malformed Streams)
  // =========================================================================
  describe("parseCsv & parseCsvToTable", () => {
    it("handles 0-byte input, whitespace-only, and null/undefined without crashing", () => {
      expect(parseCsv("")).toEqual([]);
      expect(parseCsv("   \t\r\n\v\f   ")).toEqual([]);
      expect(parseCsv(null as unknown as string)).toEqual([]);
      expect(parseCsv(undefined as unknown as string)).toEqual([]);
      expect(parseCsv(12345 as unknown as string)).toEqual([]);
      expect(parseCsv({} as unknown as string)).toEqual([]);

      expect(parseCsvToTable("")).toEqual({ headers: [], normalizedHeaders: [], rows: [] });
      expect(parseCsvToTable("   \n\r\n  ")).toEqual({ headers: [], normalizedHeaders: [], rows: [] });
    });

    it("handles embedded null bytes and control characters cleanly", () => {
      const csvWithNulls = "Title\0Name,Author\0Creator\n\"Book\0One\",\"Arthur\0Clarke\"";
      const result = parseCsv(csvWithNulls);
      expect(result.length).toBe(2);
      expect(result[1][0]).toBe("Book\0One");
      expect(result[1][1]).toBe("Arthur\0Clarke");

      const table = parseCsvToTable(csvWithNulls);
      expect(table.rows.length).toBe(1);
    });

    it("handles unclosed quotes at EOF gracefully without infinite loop or throw", () => {
      const unclosedCsv = 'Title,Author,Notes\n"Dune","Frank Herbert","This is an unclosed quote that ends abruptly';
      const result = parseCsv(unclosedCsv);
      expect(result.length).toBe(2);
      expect(result[1][0]).toBe("Dune");
      expect(result[1][1]).toBe("Frank Herbert");
      expect(result[1][2]).toBe("This is an unclosed quote that ends abruptly");
    });

    it("handles extreme consecutive quotes sequence without crashing", () => {
      const multiQuotesCsv = 'Title,Author\n"""""""Deep Quotes""""""","Author""Name"""';
      const result = parseCsv(multiQuotesCsv);
      expect(result.length).toBe(2);
      expect(result[0]).toEqual(["Title", "Author"]);
      expect(result[1].length).toBe(2);
      expect(typeof result[1][0]).toBe("string");
    });

    it("handles multiline quoted fields with mixed CRLF, LF, CR linebreaks and trailing garbage", () => {
      const complexCsv =
        "Title,Author,Review\r\n" +
        '"Dune","Frank\rHerbert","Line 1\nLine 2\r\nLine 3 with ""escaped"" quotes"\r' +
        '"Neuromancer","William Gibson","Cyberpunk classic"\n' +
        ",,\r\n" + // empty row
        "   \r\n"; // whitespace row

      const result = parseCsv(complexCsv);
      expect(result.length).toBe(3); // Headers + Dune + Neuromancer (empty rows discarded)
      expect(result[1][0]).toBe("Dune");
      expect(result[1][2]).toBe('Line 1\nLine 2\r\nLine 3 with "escaped" quotes');
      expect(result[2][0]).toBe("Neuromancer");
    });

    it("parses CSV with 1,000 columns per row efficiently", () => {
      const colCount = 1000;
      const headers = Array.from({ length: colCount }, (_, i) => `Col_${i}`).join(",");
      const row1 = Array.from({ length: colCount }, (_, i) => `Val_${i}`).join(",");
      const largeCsv = `${headers}\n${row1}`;

      const grid = parseCsv(largeCsv);
      expect(grid.length).toBe(2);
      expect(grid[0].length).toBe(colCount);
      expect(grid[1].length).toBe(colCount);

      const table = parseCsvToTable(largeCsv);
      expect(table.headers.length).toBe(colCount);
      expect(table.rows.length).toBe(1);
      expect(table.rows[0]["col0"]).toBe("Val_0");
      expect(table.rows[0]["col999"]).toBe("Val_999");
    });

    it("handles duplicate, missing, and special character headers in parseCsvToTable", () => {
      const dupCsv = "Title,Title,Author,#Tag,123\nBook 1,Book 2,Frank Herbert,Sci-Fi,42";
      const table = parseCsvToTable(dupCsv);
      expect(table.headers).toEqual(["Title", "Title", "Author", "#Tag", "123"]);
      expect(table.rows.length).toBe(1);
      // Normalized headers map to stripped alphanumeric keys
      expect(table.rows[0]["author"]).toBe("Frank Herbert");
      expect(table.rows[0]["tag"]).toBe("Sci-Fi");
      expect(table.rows[0]["123"]).toBe("42");
    });

    it("handles non-English text across Turkish, Japanese, Arabic, and Cyrillic", () => {
      const i18nCsv =
        "Title,Author,Language\n" +
        "İnce Memed,Yaşar Kemal,Türkçe\n" +
        "千と千尋の神隠し,宮崎 駿,Japanese\n" +
        "ألف ليلة وليلة,مجهول,Arabic\n" +
        "Война и мир,Лев Толстой,Russian";

      const table = parseCsvToTable(i18nCsv);
      expect(table.rows.length).toBe(4);
      expect(table.rows[0]["title"]).toBe("İnce Memed");
      expect(table.rows[1]["title"]).toBe("千と千尋の神隠し");
      expect(table.rows[2]["title"]).toBe("ألف ليلة وليلة");
      expect(table.rows[3]["title"]).toBe("Война и мир");
    });

    it("supports custom delimiters (; , | \t)", () => {
      const semicolonCsv = "Title;Author;Year\nDune;Frank Herbert;1965";
      const result = parseCsv(semicolonCsv, ";");
      expect(result).toEqual([
        ["Title", "Author", "Year"],
        ["Dune", "Frank Herbert", "1965"],
      ]);

      const pipeCsv = "Title|Author\nMatrix|Wachowskis";
      const pipeResult = parseCsv(pipeCsv, "|");
      expect(pipeResult).toEqual([
        ["Title", "Author"],
        ["Matrix", "Wachowskis"],
      ]);
    });

    it("handles type confusion on normalizeHeaderKey and getField", () => {
      expect(normalizeHeaderKey(null as unknown as string)).toBe("");
      expect(normalizeHeaderKey(undefined as unknown as string)).toBe("");
      expect(normalizeHeaderKey(12345 as unknown as string)).toBe("");
      expect(normalizeHeaderKey("  --Title #123__!!  ")).toBe("title123");

      expect(getField(null as unknown as Record<string, string>, "title")).toBeUndefined();
      expect(getField({ title: "Valid Title" }, "Title", "title")).toBe("Valid Title");
      expect(getField({ myrating: "5" }, "My Rating", "rating")).toBe("5");
    });
  });

  // =========================================================================
  // 2. parseSafeDate (Adversarial Date Parsing)
  // =========================================================================
  describe("parseSafeDate", () => {
    it("parses valid dates, slash dates, dot dates, and year-only strings", () => {
      expect(parseSafeDate("2024-05-15")).toBe("2024-05-15T00:00:00.000Z");
      expect(parseSafeDate("2024/05/15")).toBe("2024-05-15T00:00:00.000Z");
      expect(parseSafeDate("2024.05.15")).toBe("2024-05-15T00:00:00.000Z");
      expect(parseSafeDate("2024")).toBe("2024-01-01T00:00:00.000Z");
    });

    it("rejects corrupt dates, impossible dates, SQLi, and non-date strings", () => {
      expect(parseSafeDate("0000-00-00")).toBeUndefined();
      expect(parseSafeDate("9999-99-99")).toBeUndefined();
      expect(parseSafeDate("invalid-date")).toBeUndefined();
      expect(parseSafeDate("not a date")).toBeUndefined();
      expect(parseSafeDate("'; DROP TABLE--")).toBeUndefined();
      expect(parseSafeDate("<script>alert(1)</script>")).toBeUndefined();
      expect(parseSafeDate("")).toBeUndefined();
      expect(parseSafeDate("   ")).toBeUndefined();
      expect(parseSafeDate(null)).toBeUndefined();
      expect(parseSafeDate(undefined)).toBeUndefined();
      expect(parseSafeDate(12345 as unknown as string)).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. detectImportSource (Source Signature Fuzzing)
  // =========================================================================
  describe("detectImportSource", () => {
    it("detects Goodreads CSV format from headers", () => {
      const goodreadsCsv = "Book Id,Title,Author,Exclusive Shelf,My Rating\n123,Dune,Herbert,read,5";
      expect(detectImportSource(goodreadsCsv).source).toBe("goodreads");

      const goodreadsAlt = "Title,Author,Exclusive Shelf,My Rating\nDune,Herbert,read,5";
      expect(detectImportSource(goodreadsAlt).source).toBe("goodreads");
    });

    it("detects Letterboxd CSV format from headers and filenames", () => {
      const letterboxdHeaders = "Letterboxd URI,Name,Year,Watched Date\nhttp://letterboxd.com/film/dune,Dune,2021,2024-01-01";
      expect(detectImportSource(letterboxdHeaders).source).toBe("letterboxd");

      const genericCsv = "Name,Year\nDune,2021";
      expect(detectImportSource(genericCsv, "diary.csv").source).toBe("letterboxd");
      expect(detectImportSource(genericCsv, "watchlist.csv").source).toBe("letterboxd");
      expect(detectImportSource(genericCsv, "my_letterboxd_export.csv").source).toBe("letterboxd");
    });

    it("detects StoryGraph CSV format from headers and filenames", () => {
      const storyGraphHeaders = "Title,Authors,Read Status,Star Rating\nDune,Frank Herbert,read,5.0";
      expect(detectImportSource(storyGraphHeaders).source).toBe("storygraph");

      const storyGraphAlt = "Title,Authors,Last Date Read\nDune,Frank Herbert,2024-01-01";
      expect(detectImportSource(storyGraphAlt).source).toBe("storygraph");

      const genericCsv = "Title,Authors\nDune,Frank Herbert";
      expect(detectImportSource(genericCsv, "storygraph_export.csv").source).toBe("storygraph");
    });

    it("detects HepYeni JSON format and recovers from corrupt JSON", () => {
      const validArrayJson = JSON.stringify([{ title: "Dune", mediaType: "book" }]);
      expect(detectImportSource(validArrayJson).source).toBe("hepyeni_json");

      const validItemsJson = JSON.stringify({ items: [{ title: "Dune" }] });
      expect(detectImportSource(validItemsJson).source).toBe("hepyeni_json");

      // Corrupt / Non-matching JSON falls back to CSV gracefully
      expect(detectImportSource("{ invalid json").source).toBe("generic_csv");
      expect(detectImportSource('{"user": "alice"}').source).toBe("generic_csv");
      expect(detectImportSource("12345").source).toBe("generic_csv");
      expect(detectImportSource("null").source).toBe("generic_csv");
      expect(detectImportSource("true").source).toBe("generic_csv");
    });

    it("falls back to generic_csv for unknown headers or empty content", () => {
      expect(detectImportSource("").source).toBe("generic_csv");
      expect(detectImportSource("Some Random Header,Another\nVal1,Val2").source).toBe("generic_csv");
      expect(detectImportSource(null as unknown as string).source).toBe("generic_csv");
    });
  });

  // =========================================================================
  // 4. parseGoodreadsCsv (Adversarial Data & Fault Tolerance)
  // =========================================================================
  describe("parseGoodreadsCsv", () => {
    it("parses standard Goodreads export with multiple authors and notes", () => {
      const csv =
        "Book Id,Title,Author,Additional Authors,Exclusive Shelf,My Rating,Number of Pages,Date Read,Date Added,Private Notes,My Review\n" +
        '1001,"Dune","Frank Herbert","Brian Herbert","read","5","600","2024/01/15","2023/12/01","Private note here","Epic masterpiece"';

      const items = parseGoodreadsCsv(csv);
      expect(items.length).toBe(1);
      expect(items[0].title).toBe("Dune");
      expect(items[0].creator).toBe("Frank Herbert, Brian Herbert");
      expect(items[0].mediaType).toBe("book");
      expect(items[0].status).toBe("completed");
      expect(items[0].rating).toBe(5);
      expect(items[0].progressTotal).toBe(600);
      expect(items[0].progressCurrent).toBe(600);
      expect(items[0].notes).toContain("Private note here");
      expect(items[0].notes).toContain("Epic masterpiece");
      expect(items[0].externalSource).toBe("goodreads");
      expect(items[0].externalId).toBe("1001");
    });

    it("handles extreme, corrupted ratings, page counts, and invalid shelf values", () => {
      const corruptCsv =
        "Book Id,Title,Author,Exclusive Shelf,My Rating,Number of Pages,Date Read\n" +
        '1,"Negative Rating","Author 1","currently-reading","-5","-200","invalid"\n' +
        '2,"Overflown Rating","Author 2","to-read","1000","0","0000-00-00"\n' +
        '3,"Text Rating","Author 3","unknown_shelf","five","NaN","9999-99-99"\n' +
        '4,"Empty Title Row","Author 4","read","3","300","2024-01-01"';

      const items = parseGoodreadsCsv(corruptCsv);
      expect(items.length).toBe(4);

      // Row 1: negative rating & pages rejected
      expect(items[0].rating).toBeUndefined();
      expect(items[0].progressTotal).toBeUndefined();
      expect(items[0].status).toBe("in_progress");
      expect(items[0].dateFinished).toBeUndefined();

      // Row 2: overflown rating & 0 pages rejected
      expect(items[1].rating).toBeUndefined();
      expect(items[1].progressTotal).toBeUndefined();
      expect(items[1].status).toBe("plan_to_consume");

      // Row 3: text rating rejected, unknown shelf falls back to plan_to_consume
      expect(items[2].rating).toBeUndefined();
      expect(items[2].status).toBe("plan_to_consume");

      // Row 4: valid rating & pages
      expect(items[3].rating).toBe(3);
      expect(items[3].progressTotal).toBe(300);
      expect(items[3].progressCurrent).toBe(300);
    });

    it("skips rows with empty titles", () => {
      const csv =
        "Book Id,Title,Author,Exclusive Shelf\n" +
        '1,"","Frank Herbert","read"\n' +
        '2,"   ","Frank Herbert","read"\n' +
        '3,"Valid Book","Frank Herbert","read"';

      const items = parseGoodreadsCsv(csv);
      expect(items.length).toBe(1);
      expect(items[0].title).toBe("Valid Book");
    });
  });

  // =========================================================================
  // 5. parseLetterboxdCsv (Adversarial Data & Filename Watchlist Routing)
  // =========================================================================
  describe("parseLetterboxdCsv", () => {
    it("parses Letterboxd diary entries with 0.5-5.0 scale conversion", () => {
      const diaryCsv =
        "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n" +
        "2024-01-02,Blade Runner 2049,2017,https://boxd.it/123,4.5,,cyberpunk,2024-01-01\n" +
        "2024-01-03,The Room,2003,https://boxd.it/456,0.5,,,2024-01-02";

      const items = parseLetterboxdCsv(diaryCsv, "diary.csv");
      expect(items.length).toBe(2);

      expect(items[0].title).toBe("Blade Runner 2049");
      expect(items[0].creator).toBe("(2017)");
      expect(items[0].mediaType).toBe("movie");
      expect(items[0].status).toBe("completed");
      expect(items[0].rating).toBe(5); // 4.5 rounded to 5
      expect(items[0].externalSource).toBe("letterboxd");
      expect(items[0].externalId).toBe("https://boxd.it/123");

      expect(items[1].rating).toBe(1); // 0.5 rounded to 1
    });

    it("respects watchlist status unless watchedDate or rating is present", () => {
      const watchlistCsv =
        "Date,Name,Year,Letterboxd URI\n" +
        "2024-01-01,Dune: Part Two,2024,https://boxd.it/789\n" +
        "2024-01-02,Oppenheimer,2023,https://boxd.it/000";

      const items = parseLetterboxdCsv(watchlistCsv, "watchlist.csv");
      expect(items.length).toBe(2);
      expect(items[0].status).toBe("plan_to_consume");
      expect(items[1].status).toBe("plan_to_consume");
    });

    it("handles corrupt ratings (1000, -5, 'five', 'N/A') in Letterboxd", () => {
      const corruptCsv =
        "Name,Year,Rating\n" +
        "Film 1,2020,-5\n" +
        "Film 2,2021,1000\n" +
        "Film 3,2022,five\n" +
        "Film 4,2023,N/A\n" +
        "Film 5,2024,3.0";

      const items = parseLetterboxdCsv(corruptCsv);
      expect(items.length).toBe(5);
      expect(items[0].rating).toBeUndefined();
      expect(items[1].rating).toBeUndefined();
      expect(items[2].rating).toBeUndefined();
      expect(items[3].rating).toBeUndefined();
      expect(items[4].rating).toBe(3);
    });
  });

  // =========================================================================
  // 6. parseStoryGraphCsv (Adversarial Data & Status Normalization)
  // =========================================================================
  describe("parseStoryGraphCsv", () => {
    it("maps all StoryGraph read statuses correctly to HepYeni progress states", () => {
      const sgCsv =
        "Title,Authors,Read Status,Star Rating,Number of Pages\n" +
        "Book Read,Author 1,read,4.5,350\n" +
        "Book In Progress,Author 2,currently-reading,3.0,400\n" +
        "Book Plan,Author 3,to-read,,250\n" +
        "Book Dropped,Author 4,did-not-finish,1.0,100\n" +
        "Book DNF,Author 5,dnf,1.0,150\n" +
        "Book On Hold,Author 6,on-hold,2.0,200\n" +
        "Book Paused,Author 7,paused,2.0,200\n" +
        "Book Unknown,Author 8,flying,,500";

      const items = parseStoryGraphCsv(sgCsv);
      expect(items.length).toBe(8);
      expect(items[0].status).toBe("completed");
      expect(items[0].rating).toBe(5); // 4.5 rounded to 5
      expect(items[0].progressCurrent).toBe(350);

      expect(items[1].status).toBe("in_progress");
      expect(items[2].status).toBe("plan_to_consume");
      expect(items[3].status).toBe("dropped");
      expect(items[4].status).toBe("dropped");
      expect(items[5].status).toBe("on_hold");
      expect(items[6].status).toBe("on_hold");
      expect(items[7].status).toBe("plan_to_consume"); // unknown falls back
    });

    it("handles corrupt page counts, negative numbers, and invalid ratings", () => {
      const corruptSgCsv =
        "Title,Authors,Read Status,Star Rating,Number of Pages\n" +
        "Corrupt Pages,Author,-read,1000,-99\n" +
        "NaN Pages,Author,read,NaN,lots";

      const items = parseStoryGraphCsv(corruptSgCsv);
      expect(items.length).toBe(2);
      expect(items[0].progressTotal).toBeUndefined();
      expect(items[0].rating).toBeUndefined();
      expect(items[1].progressTotal).toBeUndefined();
      expect(items[1].rating).toBeUndefined();
    });
  });

  // =========================================================================
  // 7. parseImportFile & JSON Fuzzing (Integrated Import Pipeline)
  // =========================================================================
  describe("parseImportFile & Corrupted JSON", () => {
    it("returns error for empty or whitespace-only import file", () => {
      expect(parseImportFile("").errors).toContain(
        "The selected file is empty or could not be parsed."
      );
      expect(parseImportFile("   \r\n\t  ").errors).toContain(
        "The selected file is empty or could not be parsed."
      );
      expect(parseImportFile(null as unknown as string).errors).toContain(
        "The selected file is empty or could not be parsed."
      );
    });

    it("parses valid HepYeni JSON export array and items wrapper", () => {
      const arrayJson = JSON.stringify([
        {
          title: "Dune",
          creator: "Frank Herbert",
          mediaType: "book",
          status: "completed",
          rating: 5,
          progressCurrent: 600,
          progressTotal: 600,
          progressUnit: "pages",
          startedAt: "2024-01-01",
          completedAt: "2024-01-15",
          notes: "Classic",
        },
      ]);

      const res = parseImportFile(arrayJson);
      expect(res.source).toBe("hepyeni_json");
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe("Dune");
      expect(res.items[0].rating).toBe(5);

      const wrappedJson = JSON.stringify({
        items: [
          {
            title: "Foundation",
            creator: "Isaac Asimov",
            mediaType: "book",
            status: "plan_to_consume",
          },
        ],
      });

      const resWrapped = parseImportFile(wrappedJson);
      expect(resWrapped.source).toBe("hepyeni_json");
      expect(resWrapped.items.length).toBe(1);
      expect(resWrapped.items[0].title).toBe("Foundation");
    });

    it("handles corrupted JSON roots (primitives, missing fields, prototype pollution)", () => {
      // JSON array containing primitives and nulls
      const mixedJson = JSON.stringify([
        12345,
        "string primitive",
        true,
        null,
        [],
        { no_title: true },
        { title: "   " },
        { title: "Real Book", mediaType: "book", rating: 4 },
      ]);

      const res = parseImportFile(mixedJson);
      expect(res.source).toBe("hepyeni_json");
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe("Real Book");
      expect(res.items[0].rating).toBe(4);

      // JSON with prototype pollution payload
      const protoJson = JSON.stringify([
        {
          __proto__: { polluted: true },
          title: "Proto Clean",
          mediaType: "book",
        },
      ]);
      const resProto = parseImportFile(protoJson);
      expect(resProto.items.length).toBe(1);
      expect(resProto.items[0].title).toBe("Proto Clean");
      expect((Object.prototype as Record<string, unknown>)["polluted"]).toBeUndefined();
    });

    it("gracefully recovers from completely malformed files without thrown exceptions", () => {
      const corruptPayloads = [
        "{{{{ malformed json [[[",
        '{"items": [ {"title": "incomplete',
        "Title,Author\n\"unclosed quote without end",
        "\x00\x00\x00\x00\x00\x00\x00\x00",
      ];

      for (const payload of corruptPayloads) {
        expect(() => {
          const res = parseImportFile(payload);
          expect(res).toBeDefined();
          expect(Array.isArray(res.items)).toBe(true);
          expect(Array.isArray(res.errors)).toBe(true);
        }).not.toThrow();
      }
    });

    it("parses Generic CSV with fallback detection", () => {
      const genericCsv =
        "Title,Creator,Media Type,Status,Rating,Current,Total,Unit,Notes\n" +
        "Inception,Christopher Nolan,movie,completed,5,148,148,minutes,Mind-bending\n" +
        "Dark,Baran bo Odar,tv,in_progress,5,2,3,episodes,German sci-fi";

      const res = parseImportFile(genericCsv);
      expect(res.source).toBe("generic_csv");
      expect(res.items.length).toBe(2);
      expect(res.items[0].title).toBe("Inception");
      expect(res.items[0].mediaType).toBe("movie");
      expect(res.items[0].progressUnit).toBe("minutes");
      expect(res.items[1].title).toBe("Dark");
      expect(res.items[1].mediaType).toBe("tv");
      expect(res.items[1].status).toBe("in_progress");
      expect(res.items[1].progressCurrent).toBe(2);
      expect(res.items[1].progressTotal).toBe(3);
    });
  });
});
