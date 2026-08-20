import type { UserMediaProgressResponse } from "@/types/pocketbase-types";

export interface ShelfJsonExport {
  version: string;
  exportedAt: string;
  appName: string;
  totalCount: number;
  items: UserMediaProgressResponse[];
}

export function exportShelfToJson(items: UserMediaProgressResponse[]): string {
  const exportData: ShelfJsonExport = {
    version: "1.0",
    appName: "HepYeni",
    exportedAt: new Date().toISOString(),
    totalCount: items.length,
    items,
  };

  return JSON.stringify(exportData, null, 2);
}
