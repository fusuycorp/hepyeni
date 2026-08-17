import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import PocketBase from "pocketbase";
import {
  consumeOAuth2StateCookie,
  oauth2RedirectUrl,
  setSessionCookie,
} from "@/lib/pocketbase/session";
import type { UsersResponse } from "@/types/pocketbase-types";

async function handleCallback(
  req: NextRequest,
  code: string | null,
  state: string | null,
) {
  const deny = () =>
    NextResponse.redirect(new URL("/login?error=AccessDenied", req.nextUrl));

  const stored = await consumeOAuth2StateCookie();
  if (!code || !state || !stored || stored.state !== state) {
    const { logDiagnostic } = await import("@/lib/errors");
    const diag = logDiagnostic(
      new Error("OAuth callback state verification failed or state expired"),
      {
        action: "oauth2-callback:verifyState",
        hasCode: Boolean(code),
        hasState: Boolean(state),
        hasStored: Boolean(stored),
        stateMatch: stored ? stored.state === state : false,
      },
    );
    return NextResponse.redirect(
      new URL(`/login?error=OAuthFailed&trace=${diag.traceId}`, req.nextUrl),
    );
  }

  const pb = new PocketBase(process.env.PB_URL);
  try {
    const { token, record } = await pb
      .collection("users")
      .authWithOAuth2Code<UsersResponse>(
        stored.provider,
        code,
        stored.codeVerifier,
        oauth2RedirectUrl(),
      );

    if (record.bannedAt) return deny();

    await setSessionCookie(token);
    const { autoJoinPendingInvite } = await import("@/lib/actions/groups");
    const pendingGroupId = await autoJoinPendingInvite(record.id);
    return NextResponse.redirect(
      new URL(
        pendingGroupId ? `/groups/${pendingGroupId}` : "/groups",
        req.nextUrl,
      ),
    );
  } catch (err) {
    const { logDiagnostic } = await import("@/lib/errors");
    const diag = logDiagnostic(err, {
      action: "oauth2-callback:authWithOAuth2Code",
      provider: stored.provider,
      redirectUrl: oauth2RedirectUrl(),
    });
    return NextResponse.redirect(
      new URL(`/login?error=OAuthFailed&trace=${diag.traceId}`, req.nextUrl),
    );
  }


}

export async function GET(req: NextRequest) {
  return handleCallback(
    req,
    req.nextUrl.searchParams.get("code"),
    req.nextUrl.searchParams.get("state"),
  );
}

// Apple's OAuth2 sends the callback as a POST (response_mode=form_post) when
// name/email scopes are requested, unlike Google's query-string GET.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  return handleCallback(
    req,
    form.get("code")?.toString() ?? null,
    form.get("state")?.toString() ?? null,
  );
}
