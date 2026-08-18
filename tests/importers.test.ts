import { describe, expect, it } from "bun:test";
import {
  parseCsv,
  parseCsvToTable,
  detectImportSource,
  parseImportFile,
  parseGoodreadsCsv,
  parseLetterboxdCsv,
  parseStoryGraphCsv,
} from "@/lib/importers";

describe("Zero-Dependency CSV Parser", () => {
  it("parses basic CSV rows cleanly", () => {
    const csv = "Title,Author,Rating\nDune,Frank Herbert,5\nNeuromancer,William Gibson,4";
    const result = parseCsv(csv);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(["Title", "Author", "Rating"]);
    expect(result[1]).toEqual(["Dune", "Frank Herbert", "5"]);
    expect(result[2]).toEqual(["Neuromancer", "William Gibson", "4"]);
  });

  it("handles commas and quotes inside quoted fields", () => {
    const csv = 'Title,Notes\n"Dune, Part 1","He said, ""Masterpiece!"""\n"Foundation","Classic"';
    const result = parseCsv(csv);
    expect(result).toHaveLength(3);
    expect(result[1][0]).toBe("Dune, Part 1");
    expect(result[1][1]).toBe('He said, "Masterpiece!"');
  });

  it("handles multiline quoted fields with embedded newlines", () => {
    const csv = 'Title,Review\n"The Hobbit","Line 1\nLine 2\nLine 3"\n"1984","Great book"';
    const result = parseCsv(csv);
    expect(result).toHaveLength(3);
    expect(result[1][0]).toBe("The Hobbit");
    expect(result[1][1]).toBe("Line 1\nLine 2\nLine 3");
    expect(result[2][0]).toBe("1984");
  });

  it("strips UTF-8 BOM automatically", () => {
    const csvWithBom = "\uFEFFTitle,Author\nSolaris,Stanislaw Lem";
    const result = parseCsv(csvWithBom);
    expect(result[0][0]).toBe("Title");
    expect(result[1][0]).toBe("Solaris");
  });

  it("handles mixed CRLF and LF linebreaks with trailing empty lines", () => {
    const csv = "Title,Year\r\nBlade Runner,1982\nAlien,1979\r\n\r\n\n";
    const result = parseCsv(csv);
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual(["Blade Runner", "1982"]);
    expect(result[2]).toEqual(["Alien", "1979"]);
  });

  it("preserves Turkish and Unicode characters without corruption", () => {
    const csv = "Başlık,Yazar,Notlar\nİnce Memed,Yaşar Kemal,Çukurova'nın eşsiz destanı şahane bir şaheser.";
    const table = parseCsvToTable(csv);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]["Başlık"]).toBe("İnce Memed");
    expect(table.rows[0]["Yazar"]).toBe("Yaşar Kemal");
    expect(table.rows[0]["Notlar"]).toContain("Çukurova'nın eşsiz destanı");
  });

  it("handles consecutive empty fields cleanly", () => {
    const csv = "Title,Author,Score,Notes\nDune,,,Favorite sci-fi";
    const result = parseCsv(csv);
    expect(result[1]).toEqual(["Dune", "", "", "Favorite sci-fi"]);
  });

  it("handles unclosed quotes at EOF gracefully without crashing", () => {
    const csv = 'Title,Notes\n"Dune","Unclosed quote at end of file';
    const result = parseCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[1][0]).toBe("Dune");
    expect(result[1][1]).toContain("Unclosed quote");
  });
});

describe("Goodreads CSV Parser", () => {
  const goodreadsCsv = `Book Id,Title,Author,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Private Notes,Read Count
234223,"The Left Hand of Darkness",Ursula K. Le Guin,,="0441478123",="9780441478125",5,4.08,Ace Books,Paperback,304,1987,1969,2024/02/15,2023/11/01,,,read,"Brilliant exploration of gender and sociology.",Personal note here,1
5907,"The Hobbit",J.R.R. Tolkien,,="0618260307",="9780618260300",0,4.29,Houghton Mifflin,Paperback,366,2002,1937,,2024/01/10,,,to-read,,,0
1353093,"The Dispossessed",Ursula K. Le Guin,,="006051275X",="9780060512750",4,4.24,Harper Voyager,Paperback,387,2003,1974,,2024/02/01,,,currently-reading,"Enjoying it so far.",,1`;

  it("parses Goodreads CSV and maps fields accurately", () => {
    const items = parseGoodreadsCsv(goodreadsCsv);
    expect(items).toHaveLength(3);

    // Item 1: Read book
    const item1 = items[0];
    expect(item1.title).toBe("The Left Hand of Darkness");
    expect(item1.creator).toBe("Ursula K. Le Guin");
    expect(item1.mediaType).toBe("book");
    expect(item1.status).toBe("completed");
    expect(item1.rating).toBe(5);
    expect(item1.progressTotal).toBe(304);
    expect(item1.progressCurrent).toBe(304);
    expect(item1.progressUnit).toBe("pages");
    expect(item1.externalSource).toBe("goodreads");
    expect(item1.externalId).toBe("234223");
    expect(item1.dateFinished).toBeDefined();
    expect(item1.notes).toContain("Personal note here");
    expect(item1.notes).toContain("Brilliant exploration");

    // Item 2: To-read book with 0 rating
    const item2 = items[1];
    expect(item2.title).toBe("The Hobbit");
    expect(item2.creator).toBe("J.R.R. Tolkien");
    expect(item2.status).toBe("plan_to_consume");
    expect(item2.rating).toBeUndefined(); // 0 rating mapped to undefined
    expect(item2.progressTotal).toBe(366);
    expect(item2.progressCurrent).toBeUndefined();

    // Item 3: Currently reading
    const item3 = items[2];
    expect(item3.title).toBe("The Dispossessed");
    expect(item3.status).toBe("in_progress");
    expect(item3.rating).toBe(4);
    expect(item3.progressTotal).toBe(387);
  });
});

describe("Letterboxd CSV Parser", () => {
  const diaryCsv = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2024-03-01,Dune: Part Two,2024,https://boxd.it/m8q8,4.5,No,"imax, cinema",2024-03-01
2024-02-15,Spirited Away,2001,https://boxd.it/2aEw,5.0,Yes,,2024-02-15`;

  const watchlistCsv = `Date,Name,Year,Letterboxd URI
2024-01-10,Challengers,2024,https://boxd.it/vGKs
2024-01-12,Poor Things,2023,https://boxd.it/s99e`;

  it("parses Letterboxd diary and converts 0.5-5.0 ratings to integer scale", () => {
    const items = parseLetterboxdCsv(diaryCsv, "diary.csv");
    expect(items).toHaveLength(2);

    expect(items[0].title).toBe("Dune: Part Two");
    expect(items[0].mediaType).toBe("movie");
    expect(items[0].status).toBe("completed");
    expect(items[0].rating).toBe(5); // 4.5 rounds to 5
    expect(items[0].externalSource).toBe("letterboxd");
    expect(items[0].externalId).toBe("https://boxd.it/m8q8");
    expect(items[0].dateFinished).toBeDefined();

    expect(items[1].title).toBe("Spirited Away");
    expect(items[1].rating).toBe(5);
  });

  it("parses Letterboxd watchlist as plan_to_consume status", () => {
    const items = parseLetterboxdCsv(watchlistCsv, "watchlist.csv");
    expect(items).toHaveLength(2);

    expect(items[0].title).toBe("Challengers");
    expect(items[0].mediaType).toBe("movie");
    expect(items[0].status).toBe("plan_to_consume");
    expect(items[0].rating).toBeUndefined();

    expect(items[1].title).toBe("Poor Things");
    expect(items[1].status).toBe("plan_to_consume");
  });
});

describe("StoryGraph CSV Parser", () => {
  const storyGraphCsv = `Title,Authors,Read Status,Dates Read,Star Rating,Review,Tags,Format,Date Added,Last Date Read,Number of Pages
Project Hail Mary,Andy Weir,read,2023/10/01-2023/10/10,4.5,Incredible sci-fi audiobook!,sci-fi,Audio,2023/09/15,2023/10/10,496
Klara and the Sun,Kazuo Ishiguro,currently-reading,,,,,Print,2024/01/05,,303
Brave New World,Aldous Huxley,to-read,,,,,Digital,2024/02/01,,288
Infinite Jest,David Foster Wallace,did-not-finish,,2.0,Too dense.,,Print,2022/01/01,,1079`;

  it("parses StoryGraph read statuses, star ratings, and page counts", () => {
    const items = parseStoryGraphCsv(storyGraphCsv);
    expect(items).toHaveLength(4);

    // Read item
    expect(items[0].title).toBe("Project Hail Mary");
    expect(items[0].creator).toBe("Andy Weir");
    expect(items[0].status).toBe("completed");
    expect(items[0].rating).toBe(5); // 4.5 -> 5
    expect(items[0].progressTotal).toBe(496);
    expect(items[0].progressCurrent).toBe(496);
    expect(items[0].notes).toBe("Incredible sci-fi audiobook!");
    expect(items[0].dateFinished).toBeDefined();

    // Currently reading
    expect(items[1].title).toBe("Klara and the Sun");
    expect(items[1].status).toBe("in_progress");
    expect(items[1].progressTotal).toBe(303);
    expect(items[1].progressCurrent).toBeUndefined();

    // To read
    expect(items[2].title).toBe("Brave New World");
    expect(items[2].status).toBe("plan_to_consume");

    // Dropped / DNF
    expect(items[3].title).toBe("Infinite Jest");
    expect(items[3].status).toBe("dropped");
    expect(items[3].rating).toBe(2);
    expect(items[3].notes).toBe("Too dense.");
  });
});

describe("Auto Detection & Unified parseImportFile", () => {
  it("auto-detects Goodreads CSV format", () => {
    const content = "Book Id,Title,Author,My Rating,Exclusive Shelf\n1,Dune,Frank Herbert,5,read";
    const result = detectImportSource(content);
    expect(result.source).toBe("goodreads");
  });

  it("auto-detects Letterboxd diary CSV format", () => {
    const content = "Date,Name,Year,Letterboxd URI,Rating,Watched Date\n2024-01-01,Arrival,2016,https://boxd.it/cMsu,5.0,2024-01-01";
    const result = detectImportSource(content, "diary.csv");
    expect(result.source).toBe("letterboxd");
  });

  it("auto-detects StoryGraph CSV format", () => {
    const content = "Title,Authors,Read Status,Star Rating,Number of Pages\nSapiens,Yuval Noah Harari,read,4.5,443";
    const result = detectImportSource(content);
    expect(result.source).toBe("storygraph");
  });

  it("auto-detects Titirek JSON format", () => {
    const json = JSON.stringify({
      version: "1.0",
      items: [
        {
          title: "Interstellar",
          mediaType: "movie",
          status: "completed",
          rating: 5,
        },
      ],
    });
    const result = detectImportSource(json);
    expect(result.source).toBe("titirek_json");

    const parsed = parseImportFile(json);
    expect(parsed.source).toBe("titirek_json");
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].title).toBe("Interstellar");
    expect(parsed.items[0].mediaType).toBe("movie");
    expect(parsed.items[0].status).toBe("completed");
  });

  it("handles empty or unparseable files gracefully", () => {
    const emptyResult = parseImportFile("");
    expect(emptyResult.items).toHaveLength(0);
    expect(emptyResult.errors.length).toBeGreaterThan(0);

    const whitespaceResult = parseImportFile("   \n\n  ");
    expect(whitespaceResult.items).toHaveLength(0);
  });
});

describe("CSV Formula-Injection Round-Trip (CWE-1236)", () => {
  it("parser preserves formula-leading cells verbatim (neutralization happens at the action boundary)", () => {
    const csv = [
      'Title,Author,Rating,Notes',
      '"Dune","Frank Herbert",5,"=HYPERLINK(""http://evil.example/"",""Click"")"',
      '"Neuromancer","William Gibson",4,"+cmd|\'/C calc\'!A0"',
      '"Solaris","Stanislaw Lem",3,"@SUM(A1:A2)"',
    ].join("\n");

    const table = parseCsvToTable(csv);

    // The RFC-4180 parser must not mangle or drop attacker-controlled cells:
    // they flow through to batchImportProgress, which neutralizes the
    // free-text fields via neutralizeFormulaPrefix, and exportShelfToCsv
    // neutralizes every field at the spreadsheet boundary.
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0]["Notes"]).toBe('=HYPERLINK("http://evil.example/","Click")');
    expect(table.rows[1]["Notes"]).toBe("+cmd|'/C calc'!A0");
    expect(table.rows[2]["Notes"]).toBe("@SUM(A1:A2)");
  });
});
