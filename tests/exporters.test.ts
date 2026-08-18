import { describe, expect, it } from "bun:test";
import {
  exportShelfToJson,
  exportShelfToCsv,
  generateItemMarkdown,
  exportShelfToMarkdownZip,
  exportShelfToSingleMarkdown,
  calculateCrc32,
  createZipArchive,
  uint8ArrayToBase64,
} from "@/lib/exporters";
import { parseCsvToTable } from "@/lib/importers";
import type { UserMediaProgressResponse } from "@/types/pocketbase-types";

const mockItems = [
  {
    id: "rec_1",
    collectionId: "col_1",
    collectionName: "user_media_progress",
    user: "usr_1",
    title: "Dune: Part Two",
    creator: "Denis Villeneuve",
    mediaType: "movie",
    status: "completed",
    rating: 5,
    progressCurrent: 166,
    progressTotal: 166,
    progressUnit: "minutes",
    currentLabel: "Final chapter",
    notes: 'Spectacular cinematic experience! "Masterpiece" of modern sci-fi.',
    isSharedWithCircles: true,
    startedAt: "2024-03-01T20:00:00.000Z",
    completedAt: "2024-03-01T22:46:00.000Z",
    createdAt: "2024-03-01T20:00:00.000Z",
    updatedAt: "2024-03-01T22:46:00.000Z",
    externalSource: "letterboxd",
    externalId: "https://boxd.it/m8q8",
    coverUrl: "",
    groupTitle: "",
  },
  {
    id: "rec_2",
    collectionId: "col_1",
    collectionName: "user_media_progress",
    user: "usr_1",
    title: "İnce Memed",
    creator: "Yaşar Kemal",
    mediaType: "book",
    status: "in_progress",
    rating: 5,
    progressCurrent: 120,
    progressTotal: 436,
    progressUnit: "pages",
    currentLabel: "Bölüm 12",
    notes: "Toroslar'ın eşsiz anlatımı.",
    isSharedWithCircles: true,
    startedAt: "2024-02-01T10:00:00.000Z",
    completedAt: "",
    createdAt: "2024-02-01T10:00:00.000Z",
    updatedAt: "2024-02-05T14:30:00.000Z",
    externalSource: "goodreads",
    externalId: "987654",
    coverUrl: "",
    groupTitle: "",
  },
] as unknown as UserMediaProgressResponse[];

describe("JSON Exporter", () => {
  it("exports full-fidelity JSON with metadata and item records", () => {
    const jsonStr = exportShelfToJson(mockItems);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.version).toBe("1.0");
    expect(parsed.appName).toBe("Titirek");
    expect(parsed.totalCount).toBe(2);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].title).toBe("Dune: Part Two");
    expect(parsed.items[0].rating).toBe(5);
    expect(parsed.items[1].creator).toBe("Yaşar Kemal");
  });
});

describe("CSV Exporter & Roundtrip", () => {
  it("generates RFC-4180 escaped CSV string", () => {
    const csvStr = exportShelfToCsv(mockItems);
    expect(csvStr).toContain("Title,Creator,Media Type");
    // Verify quotes inside notes are escaped with double quotes
    expect(csvStr).toContain('""Masterpiece""');
    expect(csvStr).toContain("Yaşar Kemal");

    // Parse back with our CSV parser
    const table = parseCsvToTable(csvStr);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]["Title"]).toBe("Dune: Part Two");
    expect(table.rows[0]["Notes"]).toBe('Spectacular cinematic experience! "Masterpiece" of modern sci-fi.');
    expect(table.rows[1]["Creator"]).toBe("Yaşar Kemal");
    expect(table.rows[1]["Progress Total"]).toBe("436");
  });
});

describe("Markdown & Obsidian Exporter", () => {
  it("generates clean YAML frontmatter and markdown body", () => {
    const { filename, content } = generateItemMarkdown(mockItems[0]);
    expect(filename).toBe("Dune_ Part Two - Denis Villeneuve.md");
    expect(content).toContain("---");
    expect(content).toContain('title: "Dune: Part Two"');
    expect(content).toContain('creator: "Denis Villeneuve"');
    expect(content).toContain('media_type: "movie"');
    expect(content).toContain("rating: 5");
    expect(content).toContain("# Dune: Part Two");
    expect(content).toContain("★★★★★ (5/5)");
    expect(content).toContain("## Notes");
    expect(content).toContain("Spectacular cinematic experience!");
  });

  it("exports single concatenated markdown document", () => {
    const combined = exportShelfToSingleMarkdown(mockItems);
    expect(combined).toContain("# Dune: Part Two");
    expect(combined).toContain("# İnce Memed");
  });
});

describe("Zero-Dependency PKZip Archive Builder", () => {
  it("calculates accurate standard CRC-32 checksums", () => {
    const data = new TextEncoder().encode("Hello World");
    const crc = calculateCrc32(data);
    expect(typeof crc).toBe("number");
    expect(crc).toBe(0x4a17b156);
  });

  it("builds a valid ZIP archive binary with PK signatures", () => {
    const zipBytes = createZipArchive([
      { name: "test.txt", content: "Hello Titirek!" },
      { name: "folder/note.md", content: "# Markdown Note" },
    ]);

    expect(zipBytes).toBeInstanceOf(Uint8Array);
    expect(zipBytes.length).toBeGreaterThan(50);

    // Standard PKZip Local Header Signature 0x04034b50 -> 'PK\x03\x04'
    expect(zipBytes[0]).toBe(0x50); // 'P'
    expect(zipBytes[1]).toBe(0x4b); // 'K'
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);

    const base64 = uint8ArrayToBase64(zipBytes);
    expect(base64.length).toBeGreaterThan(0);
    expect(typeof base64).toBe("string");
  });

  it("exports full shelf as an Obsidian markdown ZIP package with index", () => {
    const zipBytes = exportShelfToMarkdownZip(mockItems);
    expect(zipBytes.length).toBeGreaterThan(100);
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
  });
});
