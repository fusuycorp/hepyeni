import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "@/lib/pocketbase/session";

export default async function proxy(req: NextRequest) {
  const session = await getSessionFromToken(
    req.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (req.nextUrl.pathname.startsWith("/admin") && !session.isAdmin) {
    return NextResponse.redirect(new URL("/groups", req.nextUrl));
  }
}

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
