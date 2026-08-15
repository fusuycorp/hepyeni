import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import PocketBase from "pocketbase";
import {
  consumeOAuth2StateCookie,
  oauth2RedirectUrl,
  setSessionCookie,
} from "@/lib/pocketbase/session";
import type { UsersResponse } from "@/types/pocketbase-types";

export async function GET(req: NextRequest) {
  const deny = () =>
    NextResponse.redirect(new URL("/login?error=AccessDenied", req.nextUrl));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stored = await consumeOAuth2StateCookie();

  if (!code || !state || !stored || stored.state !== state) return deny();

  const pb = new PocketBase(process.env.PB_URL);
  try {
    const { token, record } = await pb
      .collection("users")
      .authWithOAuth2Code<UsersResponse>(
        "google",
        code,
        stored.codeVerifier,
        oauth2RedirectUrl(),
      );

    if (record.bannedAt) return deny();

    await setSessionCookie(token);
    return NextResponse.redirect(new URL("/groups", req.nextUrl));
  } catch {
    return deny();
  }
}
