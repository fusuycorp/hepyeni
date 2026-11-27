import type { UserMediaProgressResponse } from "@/types/pocketbase-types";

// Spreadsheet apps evaluate cells starting with = + - @ (or a tab/CR) as
// formulas (CWE-1236, CSV injection). Prefixing such cells with a single
// quote turns them into literal text. Shared by the exporter (escapeCsvField)
// and the importer boundary (batchImportProgress) so the two sides cannot
// drift — the stored value may be verbatim user content, but anything that
// reaches a spreadsheet-capable format is neutralized here.
const FORMULA_PREFIX_RE = /^[=+\-@|\t\r\n]/;

export function neutralizeFormulaPrefix(val: string): string {
  return FORMULA_PREFIX_RE.test(val) || FORMULA_PREFIX_RE.test(val.trimStart())
    ? `'${val}`
    : val;
}

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = neutralizeFormulaPrefix(String(val));
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const CSV_HEADERS = [
  "Title",
  "Creator",
  "Media Type",
  "Status",
  "Rating",
  "Progress Current",
  "Progress Total",
  "Progress Unit",
  "Current Label",
  "Notes",
  "Started At",
  "Completed At",
  "Created At",
  "Updated At",
  "External Source",
  "External Id",
] as const;

const CSV_FIELD_KEYS: ReadonlyArray<keyof UserMediaProgressResponse> = [
  "title",
  "creator",
  "mediaType",
  "status",
  "rating",
  "progressCurrent",
  "progressTotal",
  "progressUnit",
  "currentLabel",
  "notes",
  "startedAt",
  "completedAt",
  "createdAt",
  "updatedAt",
  "externalSource",
  "externalId",
];

export function exportShelfToCsv(items: UserMediaProgressResponse[]): string {
  const rows: string[] = [CSV_HEADERS.join(",")];

  for (const item of items) {
    const row = CSV_FIELD_KEYS.map((key) => escapeCsvField(item[key]));
    rows.push(row.join(","));
  }

  return rows.join("\r\n");
}
