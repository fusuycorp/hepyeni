/**
 * Zero-dependency RFC-4180 compliant CSV parser.
 * Handles:
 * - UTF-8 BOM stripping
 * - Multiline quoted fields
 * - Escaped quotes ("")
 * - Trailing empty lines & mixed CRLF/LF linebreaks
 * - Robust column normalization & fuzzy lookup
 */

function pushNonEmptyRow(rows: string[][], row: string[]): void {
  if (row.some((field) => field.length > 0)) {
    rows.push(row);
  }
}

function stepQuotedCsvChar(
  cleanText: string,
  i: number,
  currentField: string,
): { nextIndex: number; field: string; inQuotes: boolean } {
  const char = cleanText[i];
  if (char !== '"') {
    return { nextIndex: i + 1, field: currentField + char, inQuotes: true };
  }
  if (i + 1 < cleanText.length && cleanText[i + 1] === '"') {
    return { nextIndex: i + 2, field: currentField + '"', inQuotes: true };
  }
  return { nextIndex: i + 1, field: currentField, inQuotes: false };
}

function resolveDelimiter(delimiter: string): string {
  return typeof delimiter === "string" && delimiter.length > 0 ? delimiter : ",";
}

function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isLineBreakChar(char: string): boolean {
  return char === "\r" || char === "\n";
}

function lineBreakAdvance(cleanText: string, i: number): number {
  return cleanText[i] === "\r" && cleanText[i + 1] === "\n" ? 2 : 1;
}

function finalizeRemainingCsvField(
  rows: string[][],
  currentRow: string[],
  currentField: string,
): void {
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    pushNonEmptyRow(rows, currentRow);
  }
}

export function parseCsv(text: string, delimiter = ","): string[][] {
  if (!text || typeof text !== "string") return [];

  const delim = resolveDelimiter(delimiter);
  const cleanText = stripUtf8Bom(text);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < cleanText.length) {
    if (inQuotes) {
      const next = stepQuotedCsvChar(cleanText, i, currentField);
      i = next.nextIndex;
      currentField = next.field;
      inQuotes = next.inQuotes;
      continue;
    }

    const char = cleanText[i];
    if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === delim) {
      currentRow.push(currentField.trim());
      currentField = "";
      i++;
    } else if (isLineBreakChar(char)) {
      currentRow.push(currentField.trim());
      currentField = "";
      pushNonEmptyRow(rows, currentRow);
      currentRow = [];
      i += lineBreakAdvance(cleanText, i);
    } else {
      currentField += char;
      i++;
    }
  }

  finalizeRemainingCsvField(rows, currentRow, currentField);
  return rows;
}

export interface CsvTable {
  headers: string[];
  normalizedHeaders: string[];
  rows: Record<string, string>[];
}

export function normalizeHeaderKey(key: string): string {
  if (!key || typeof key !== "string") return "";
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseCsvToTable(text: string): CsvTable {
  const grid = parseCsv(text);
  if (grid.length === 0) {
    return { headers: [], normalizedHeaders: [], rows: [] };
  }

  const rawHeaders = grid[0];
  const normalizedHeaders = rawHeaders.map(normalizeHeaderKey);
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < grid.length; r++) {
    const rowCells = grid[r];
    const rowObj: Record<string, string> = {};

    for (let c = 0; c < rawHeaders.length; c++) {
      const normKey = normalizedHeaders[c];
      const val = rowCells[c] ?? "";
      if (normKey) {
        rowObj[normKey] = val;
      }
      // Also store raw header
      if (rawHeaders[c]) {
        rowObj[rawHeaders[c]] = val;
      }
    }

    if (Object.values(rowObj).some((v) => v.trim().length > 0)) {
      rows.push(rowObj);
    }
  }

  return {
    headers: rawHeaders,
    normalizedHeaders,
    rows,
  };
}

export function getField(row: Record<string, string>, ...possibleKeys: string[]): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  for (const key of possibleKeys) {
    const norm = normalizeHeaderKey(key);
    if (row[norm] !== undefined && row[norm] !== "") {
      return row[norm];
    }
    if (row[key] !== undefined && row[key] !== "") {
      return row[key];
    }
  }
  return undefined;
}

function toBoundedIsoString(date: Date): string | undefined {
  if (isNaN(date.getTime())) return undefined;
  const year = date.getUTCFullYear();
  if (year < 1000 || year > 9999) return undefined;
  try {
    return date.toISOString();
  } catch {
    return undefined;
  }
}

function parseDateRangeEnd(trimmed: string): string | undefined {
  if (trimmed.includes(" - ") || trimmed.toLowerCase().includes(" to ") || trimmed.includes(",")) {
    const parts = trimmed.split(/\s+to\s+|\s+-\s+|,\s*/i);
    for (let p = parts.length - 1; p >= 0; p--) {
      const candidate = parseSafeDate(parts[p], false);
      if (candidate) return candidate;
    }
    return undefined;
  }
  if (/^\d{4}\/\d{1,2}\/\d{1,2}-\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split("-");
    return parseSafeDate(parts[parts.length - 1], false);
  }
  return undefined;
}

export function parseSafeDate(dateStr?: string | null, allowRange = true): string | undefined {
  if (!dateStr || typeof dateStr !== "string") return undefined;
  const trimmed = dateStr.trim();
  if (!trimmed || /[;<>'"`]|\/\*/.test(trimmed)) return undefined;

  if (allowRange) {
    const rangeResult = parseDateRangeEnd(trimmed);
    if (rangeResult) return rangeResult;
  }

  const normalized = trimmed.replace(/[/.]/g, "-");
  const isoCandidate = toBoundedIsoString(new Date(normalized));
  if (isoCandidate) return isoCandidate;

  if (/^\d{4}$/.test(trimmed)) {
    return toBoundedIsoString(new Date(`${trimmed}-01-01T00:00:00.000Z`));
  }

  return undefined;
}
