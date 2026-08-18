"use server";

import { getSession } from "@/lib/pocketbase/session";
import { requireAdmin } from "@/lib/admin";
import { getRecentDiagnostics, type DiagnosticEntry } from "@/lib/errors";

export async function getDiagnosticsAction(): Promise<DiagnosticEntry[]> {
  const session = await getSession();
  if (!session) return [];
  // S2: the diagnostics buffer is process-global and may contain other
  // users' raw input and PII, so only admins may read it. Anonymous and
  // non-admin callers get a safe empty list.
  try {
    await requireAdmin(session.id);
  } catch {
    return [];
  }
  return getRecentDiagnostics();
}
