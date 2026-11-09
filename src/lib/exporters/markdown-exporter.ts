import { createZipArchive, type ZipFileInput } from "./zip";
import type { UserMediaProgressResponse } from "@/types/pocketbase-types";

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>[\]\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "_")
    .slice(0, 100);
}

function escapeYamlString(val: string): string {
  if (/[\n\r":#\\]/.test(val)) {
    return JSON.stringify(val);
  }
  return `"${val}"`;
}

function pushOptionalYamlString(lines: string[], key: string, val?: string | null): void {
  if (val) lines.push(`${key}: ${escapeYamlString(val)}`);
}

function pushOptionalYamlRaw(lines: string[], key: string, val: unknown): void {
  if (val !== undefined && val !== null && val !== "") {
    lines.push(`${key}: ${val}`);
  }
}

function buildMarkdownFrontmatter(item: UserMediaProgressResponse): string[] {
  const yamlLines = ["---", `title: ${escapeYamlString(item.title)}`];
  pushOptionalYamlString(yamlLines, "creator", item.creator);
  yamlLines.push(`media_type: "${item.mediaType}"`, `status: "${item.status}"`);
  pushOptionalYamlRaw(yamlLines, "rating", item.rating);
  pushOptionalYamlRaw(yamlLines, "progress_current", item.progressCurrent);
  pushOptionalYamlRaw(yamlLines, "progress_total", item.progressTotal);
  if (item.progressUnit) yamlLines.push(`progress_unit: "${item.progressUnit}"`);
  pushOptionalYamlString(yamlLines, "current_label", item.currentLabel);
  pushOptionalYamlString(yamlLines, "started_at", item.startedAt);
  pushOptionalYamlString(yamlLines, "completed_at", item.completedAt);
  pushOptionalYamlString(yamlLines, "external_source", item.externalSource);
  pushOptionalYamlString(yamlLines, "external_id", item.externalId);
  yamlLines.push(`created_at: "${item.createdAt}"`, `updated_at: "${item.updatedAt}"`, "---", "");
  return yamlLines;
}

function buildMarkdownBody(item: UserMediaProgressResponse): string[] {
  const bodyLines: string[] = [`# ${item.title}`];
  if (item.creator) bodyLines.push(`**Creator:** ${item.creator}  `);
  bodyLines.push(`**Type:** ${item.mediaType}  `, `**Status:** ${item.status}  `);

  if (item.rating) {
    const stars = "★".repeat(item.rating) + "☆".repeat(5 - item.rating);
    bodyLines.push(`**Rating:** ${stars} (${item.rating}/5)  `);
  }

  if (item.progressTotal) {
    bodyLines.push(
      `**Progress:** ${item.progressCurrent ?? 0} / ${item.progressTotal} ${item.progressUnit ?? ""}  `,
    );
  }

  const trimmedNotes = item.notes?.trim();
  if (trimmedNotes) {
    bodyLines.push("", "## Notes", "", trimmedNotes);
  }

  bodyLines.push("");
  return bodyLines;
}

export function generateItemMarkdown(item: UserMediaProgressResponse): {
  filename: string;
  content: string;
} {
  const safeTitle = sanitizeFilename(item.title) || "untitled";
  const safeCreator = item.creator ? ` - ${sanitizeFilename(item.creator)}` : "";
  const filename = `${safeTitle}${safeCreator}.md`;

  const yamlLines = buildMarkdownFrontmatter(item);
  const bodyLines = buildMarkdownBody(item);

  return {
    filename,
    content: `${yamlLines.join("\n")}\n${bodyLines.join("\n")}`,
  };
}

function allocateUniqueFilename(filename: string, usedFilenames: Set<string>): string {
  let uniqueName = filename;
  let counter = 1;
  const dotIndex = filename.lastIndexOf(".");
  const base = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex !== -1 ? filename.slice(dotIndex) : "";

  while (usedFilenames.has(uniqueName.toLowerCase())) {
    uniqueName = `${base} (${counter})${ext}`;
    counter++;
  }
  usedFilenames.add(uniqueName.toLowerCase());
  return uniqueName;
}

function formatIndexTableRow(item: UserMediaProgressResponse, uniqueName: string): string {
  const noteBasename = uniqueName.replace(/\.md$/i, "");
  const safeCreator = (item.creator || "-")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
  const ratingStr = item.rating ? `${item.rating}/5` : "-";
  const progressStr = item.progressTotal
    ? `${item.progressCurrent ?? 0}/${item.progressTotal} ${item.progressUnit ?? ""}`
    : "-";
  return `| [[${noteBasename}]] | ${safeCreator} | ${item.mediaType} | ${item.status} | ${ratingStr} | ${progressStr} |`;
}

export function exportShelfToMarkdownZip(items: UserMediaProgressResponse[]): Uint8Array {
  const files: ZipFileInput[] = [];
  const usedFilenames = new Set<string>(["index.md"]);
  const uniqueNames: string[] = [];

  for (const item of items) {
    const { filename, content } = generateItemMarkdown(item);
    const uniqueName = allocateUniqueFilename(filename, usedFilenames);
    uniqueNames.push(uniqueName);
    files.push({
      name: `HepYeni Shelf/${uniqueName}`,
      content,
    });
  }

  // Also include an index overview note
  const indexLines = [
    "---",
    'title: "HepYeni Shelf Overview"',
    `exported_at: "${new Date().toISOString()}"`,
    `total_items: ${items.length}`,
    "---",
    "",
    "# HepYeni Shelf Overview",
    "",
    `Exported **${items.length}** media items on ${new Date().toLocaleDateString()}.`,
    "",
    "| Title | Creator | Type | Status | Rating | Progress |",
    "| :--- | :--- | :--- | :--- | :--- | :--- |",
    ...items.map((item, i) => formatIndexTableRow(item, uniqueNames[i])),
  ];

  files.push({
    name: "HepYeni Shelf/Index.md",
    content: indexLines.join("\n"),
  });

  return createZipArchive(files);
}

export function exportShelfToSingleMarkdown(items: UserMediaProgressResponse[]): string {
  const parts: string[] = [];
  for (const item of items) {
    parts.push(generateItemMarkdown(item).content);
  }
  return parts.join("\n\n---\n\n");
}
