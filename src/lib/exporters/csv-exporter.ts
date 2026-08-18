import type { UserMediaProgressResponse } from "@/types/pocketbase-types";

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportShelfToCsv(items: UserMediaProgressResponse[]): string {
  const headers = [
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
  ];

  const rows: string[] = [headers.join(",")];

  for (const item of items) {
    const row = [
      escapeCsvField(item.title),
      escapeCsvField(item.creator),
      escapeCsvField(item.mediaType),
      escapeCsvField(item.status),
      escapeCsvField(item.rating ?? ""),
      escapeCsvField(item.progressCurrent ?? ""),
      escapeCsvField(item.progressTotal ?? ""),
      escapeCsvField(item.progressUnit ?? ""),
      escapeCsvField(item.currentLabel ?? ""),
      escapeCsvField(item.notes ?? ""),
      escapeCsvField(item.startedAt ?? ""),
      escapeCsvField(item.completedAt ?? ""),
      escapeCsvField(item.createdAt ?? ""),
      escapeCsvField(item.updatedAt ?? ""),
      escapeCsvField(item.externalSource ?? ""),
      escapeCsvField(item.externalId ?? ""),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\r\n");
}
