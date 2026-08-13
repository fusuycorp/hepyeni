import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (req.nextUrl.pathname.startsWith("/admin") && !req.auth.user.isAdmin) {
    return NextResponse.redirect(new URL("/groups", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
