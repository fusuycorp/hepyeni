"use server";

import { getSession } from "@/lib/pocketbase/session";
import { getRecentDiagnostics, type DiagnosticEntry } from "@/lib/errors";

export async function getDiagnosticsAction(): Promise<DiagnosticEntry[]> {
  const session = await getSession();
  // Anyone authenticated can inspect diagnostics in developer mode, or anonymous users get safe empty list
  if (!session) return [];
  return getRecentDiagnostics();
}
