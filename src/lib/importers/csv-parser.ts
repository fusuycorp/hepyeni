/**
 * Zero-dependency RFC-4180 compliant CSV parser.
 * Handles:
 * - UTF-8 BOM stripping
 * - Multiline quoted fields
 * - Escaped quotes ("")
 * - Trailing empty lines & mixed CRLF/LF linebreaks
 * - Robust column normalization & fuzzy lookup
 */

export function parseCsv(text: string, delimiter = ","): string[][] {
  if (!text || typeof text !== "string") return [];

  const delim = typeof delimiter === "string" && delimiter.length > 0 ? delimiter : ",";

  // Strip BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;
  const len = cleanText.length;

  while (i < len) {
    const char = cleanText[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < len && cleanText[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delim) {
        currentRow.push(currentField.trim());
        currentField = "";
        i++;
        continue;
      } else if (char === "\r") {
        currentRow.push(currentField.trim());
        currentField = "";
        if (i + 1 < len && cleanText[i + 1] === "\n") {
          i++;
        }
        if (currentRow.some((field) => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        currentField = "";
        if (currentRow.some((field) => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push final field/row if any content remains
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

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

export function parseSafeDate(dateStr?: string | null): string | undefined {
  if (!dateStr || typeof dateStr !== "string") return undefined;
  const trimmed = dateStr.trim();
  if (!trimmed) return undefined;
  if (/[;<>'"`]|\/\*/.test(trimmed)) return undefined;

  // Handle range formats like "2023/10/01-2023/10/10", "2023/10/01 - 2023/10/10", "2023-01-01 to 2023-01-20"
  // Taking the last valid date represents completion / latest activity date.
  if (trimmed.includes(" - ") || trimmed.toLowerCase().includes(" to ") || trimmed.includes(",")) {
    const parts = trimmed.split(/\s+to\s+|\s+-\s+|,\s*/i);
    for (let p = parts.length - 1; p >= 0; p--) {
      const candidate = parseSafeDate(parts[p]);
      if (candidate) return candidate;
    }
  } else if (/^\d{4}\/\d{1,2}\/\d{1,2}-\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split("-");
    const candidate = parseSafeDate(parts[parts.length - 1]);
    if (candidate) return candidate;
  }

  // Handle formats like "YYYY/MM/DD", "YYYY-MM-DD", "YYYY.MM.DD"
  const normalized = trimmed.replace(/\//g, "-").replace(/\./g, "-");
  const parsed = new Date(normalized);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    if (year >= 1000 && year <= 9999) {
      try {
        return parsed.toISOString();
      } catch {
        return undefined;
      }
    }
  }

  // Handle year-only like "2024"
  if (/^\d{4}$/.test(trimmed)) {
    const yearDate = new Date(`${trimmed}-01-01T00:00:00.000Z`);
    if (!isNaN(yearDate.getTime())) {
      const year = yearDate.getUTCFullYear();
      if (year >= 1000 && year <= 9999) {
        try {
          return yearDate.toISOString();
        } catch {
          return undefined;
        }
      }
    }
  }

  return undefined;
}
