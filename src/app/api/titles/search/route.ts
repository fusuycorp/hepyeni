import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "@/lib/pocketbase/session";
import { MEDIA_TYPES, type MediaType } from "@/lib/media-types";
import { getProvider } from "@/lib/providers";
import { normalizeProviderResult } from "@/lib/providers/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { logDiagnostic } from "@/lib/errors";

// Bounds: the query is trimmed/capped before it reaches a provider, and each
// session gets a fixed outbound search budget per minute.
const MAX_QUERY_CHARS = 200;
const SEARCH_LIMIT_PER_WINDOW = 30;

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionFromToken(token);

  if (!session) {
    return NextResponse.json(
      { error: "Please sign in to search media." },
      { status: 401 },
    );
  }

  const { searchParams } = req.nextUrl;
  const mediaType = searchParams.get("mediaType") as MediaType | null;
  const query = searchParams.get("q")?.trim() || "";

  if (!mediaType || !MEDIA_TYPES.includes(mediaType)) {
    return NextResponse.json(
      { error: "Invalid or missing mediaType parameter." },
      { status: 400 },
    );
  }

  // ADR-007: bound the untrusted query before it reaches any provider. Each
  // book search fans out to up to three sequential upstream fetches, so an
  // unbounded `q` is 1:1 outbound amplification.
  if (query.length > MAX_QUERY_CHARS) {
    return NextResponse.json(
      { error: `Search query must be ${MAX_QUERY_CHARS} characters or fewer.` },
      { status: 400 },
    );
  }

  if (!query) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  // Per-session outbound budget: this route is the only externally reachable
  // path that triggers third-party provider calls.
  const limit = checkRateLimit(`titles-search:${session.id}`, {
    limit: SEARCH_LIMIT_PER_WINDOW,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many searches. Please slow down." },
      { status: 429 },
    );
  }

  try {
    const results = await getProvider(mediaType).search(query);
    // Normalise at the boundary, exactly as the LLM consumer does. Provider
    // mappers validate nothing, so this is what keeps unbounded titles and
    // non-http cover URLs out of the client.
    const normalized = results
      .map((r) => normalizeProviderResult(mediaType, r))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    return NextResponse.json({ results: normalized }, { status: 200 });
  } catch (err) {
    const diag = logDiagnostic(err, {
      action: "api/titles/search",
      mediaType,
      // S2: never log the raw user search query — length only
      queryLength: query.length,
    });
    return NextResponse.json(
      {
        error: "Media search service temporarily unavailable.",
        traceId: diag.traceId,
        results: [],
      },
      { status: 502 },
    );
  }
}
