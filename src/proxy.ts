import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getSessionFromToken,
  getRequestOrigin,
  SESSION_COOKIE_NAME,
} from "@/lib/pocketbase/session";

export default async function proxy(req: NextRequest) {
  const session = await getSessionFromToken(
    req.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  const origin = getRequestOrigin(req);

  if (!session) {
    return NextResponse.redirect(new URL("/login", origin));
  }
  if (req.nextUrl.pathname.startsWith("/admin") && !session.isAdmin) {
    return NextResponse.redirect(new URL("/groups", origin));
  }
}


export const config = {
  // Segment-bounded (each alternative must end at "/" or the string end) so
  // a future route that merely starts with one of these words — e.g.
  // /reset-password-request — doesn't silently become public too.
  matcher: [
    "/((?!(?:api/auth|login|reset-password|privacy|terms|invite|_next/static|_next/image|favicon\\.ico)(?:/|$)).*)",
  ],
};

