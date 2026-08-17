import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "@/lib/pocketbase/session";
import { MEDIA_TYPES, type MediaType } from "@/lib/media-types";
import { getProvider } from "@/lib/providers";
import { logDiagnostic } from "@/lib/errors";

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

  if (!query) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  try {
    const results = await getProvider(mediaType).search(query);
    return NextResponse.json({ results }, { status: 200 });
  } catch (err) {
    const diag = logDiagnostic(err, {
      action: "api/titles/search",
      mediaType,
      query,
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
