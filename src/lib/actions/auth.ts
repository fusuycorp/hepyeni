"use server";

import { redirect } from "next/navigation";
import PocketBase from "pocketbase";
import { isValidationNotUnique } from "@/lib/pocketbase/errors";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import {
  clearSessionCookie,
  consumeOtpCookie,
  getPbUrl,
  oauth2RedirectUrl,
  setOAuth2StateCookie,
  setOtpCookie,
  setSessionCookie,
} from "@/lib/pocketbase/session";

import { autoJoinPendingInvite } from "@/lib/actions/groups";
import { logDiagnostic } from "@/lib/errors";
import type { UsersResponse } from "@/types/pocketbase-types";

export async function getAvailableAuthProviders(): Promise<{
  google: boolean;
  apple: boolean;
}> {
  try {
    const pb = new PocketBase(getPbUrl());
    const methods = await pb.collection("users").listAuthMethods();
    const providers = methods.oauth2?.providers ?? [];
    return {
      google: providers.some((p) => p.name === "google"),
      apple: providers.some((p) => p.name === "apple"),
    };
  } catch (err) {
    logDiagnostic(err, { action: "getAvailableAuthProviders" });
    return { google: false, apple: false };
  }
}

async function signInWithOAuth2(provider: "google" | "apple") {
  const pb = new PocketBase(getPbUrl());
  let method:
    | { authURL: string; state: string; codeVerifier: string }
    | undefined;

  try {
    const methods = await pb.collection("users").listAuthMethods();
    method = methods.oauth2.providers.find((p) => p.name === provider);
  } catch (err) {
    const diag = logDiagnostic(err, {
      action: "signInWithOAuth2:listAuthMethods",
      provider,
    });
    redirect(`/login?error=OAuthFailed&trace=${diag.traceId}`);
  }

  if (!method) {
    redirect(`/login?error=OAuthNotConfigured&provider=${provider}`);
  }

  await setOAuth2StateCookie({
    provider,
    state: method.state,
    codeVerifier: method.codeVerifier,
  });

  const { headers } = await import("next/headers");
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") || "https";
  const origin =
    host && !host.includes("0.0.0.0") ? `${proto}://${host}` : undefined;

  // authURL ends with `redirect_uri=` (no value) — PocketBase's documented
  // pattern is to concatenate the redirect URL directly, not merge query
  // params via the URL API.
  redirect(method.authURL + oauth2RedirectUrl(origin));
}


export async function signInWithGoogle() {
  await signInWithOAuth2("google");
}

export async function signInWithApple() {
  await signInWithOAuth2("apple");
}


export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) throw new Error("Email is required");

  // PocketBase's requestOTP is a no-op (anti-enumeration) for unknown
  // emails — it does NOT create a user, unlike NextAuth's old Nodemailer
  // provider. Look up-or-create first to preserve "first email sign-in
  // creates the account".
  const superuser = await getSuperuserClient();
  try {
    await superuser
      .collection("users")
      .getFirstListItem(superuser.filter("email = {:email}", { email }));
  } catch {
    const randomPassword = crypto.randomUUID();
    await superuser.collection("users").create({
      email,
      emailVisibility: true,
      verified: false,
      password: randomPassword,
      passwordConfirm: randomPassword,
    });
  }

  const pb = new PocketBase(getPbUrl());
  const { otpId } = await pb.collection("users").requestOTP(email);
  await setOtpCookie({ email, otpId });

  redirect("/login?step=code");
}

export async function verifyEmailCode(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) throw new Error("Code is required");

  const stored = await consumeOtpCookie();
  if (!stored) redirect("/login?error=InvalidCode");

  // redirect() throws a special error that must propagate un-caught, so the
  // fallible OTP exchange is isolated in its own try/catch and every
  // redirect() call happens outside of it.
  const pb = new PocketBase(getPbUrl());
  let record: UsersResponse;
  let token: string;
  try {
    ({ token, record } = await pb
      .collection("users")
      .authWithOTP<UsersResponse>(stored.otpId, code));
  } catch {
    redirect("/login?error=InvalidCode");
  }

  if (record.bannedAt) redirect("/login?error=AccessDenied");

  await setSessionCookie(token);
  const pendingGroupId = await autoJoinPendingInvite(record.id);
  redirect(pendingGroupId ? `/groups/${pendingGroupId}` : "/groups");
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=InvalidCredentials");

  const pb = new PocketBase(getPbUrl());
  let record: UsersResponse;
  let token: string;
  try {
    ({ token, record } = await pb
      .collection("users")
      .authWithPassword<UsersResponse>(email, password));
  } catch {
    redirect("/login?error=InvalidCredentials");
  }

  if (record.bannedAt) redirect("/login?error=AccessDenied");

  await setSessionCookie(token);
  const pendingGroupId = await autoJoinPendingInvite(record.id);
  redirect(pendingGroupId ? `/groups/${pendingGroupId}` : "/groups");
}

export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=InvalidCredentials");
  if (password.length < 8) redirect("/login?error=WeakPassword");
  if (password.length > 128) redirect("/login?error=InvalidPassword");

  // The `users` collection is create-locked to superusers (all rules are
  // null), so self-service signup has to go through the superuser client,
  // same as the email/OTP account-creation path above.
  const superuser = await getSuperuserClient();
  try {
    await superuser.collection("users").create({
      email,
      emailVisibility: true,
      verified: false,
      password,
      passwordConfirm: password,
    });
  } catch (err) {
    if (isValidationNotUnique(err, "email")) {
      redirect("/login?error=EmailInUse");
    }
    redirect("/login?error=SignupFailed");
  }

  const pb = new PocketBase(getPbUrl());
  const { token, record } = await pb
    .collection("users")
    .authWithPassword<UsersResponse>(email, password);

  if (record.bannedAt) redirect("/login?error=AccessDenied");

  await setSessionCookie(token);
  const pendingGroupId = await autoJoinPendingInvite(record.id);
  redirect(pendingGroupId ? `/groups/${pendingGroupId}` : "/groups");
}


export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return;

  const pb = new PocketBase(getPbUrl());
  try {
    // Anti-enumeration by design on PocketBase's side: this resolves the
    // same way whether or not the email exists — callers should always
    // show the same "check your email" message regardless of outcome.
    await pb.collection("users").requestPasswordReset(email);
  } catch {
    // Swallowed for the same anti-enumeration reason.
  }
}

export async function confirmPasswordReset(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  if (!token) redirect("/login?error=AccessDenied");
  if (password.length < 8) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=WeakPassword`);
  }
  if (password !== passwordConfirm) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=Mismatch`);
  }

  const pb = new PocketBase(getPbUrl());
  try {
    await pb
      .collection("users")
      .confirmPasswordReset(token, password, passwordConfirm);
  } catch {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=Invalid`);
  }

  redirect("/login?notice=ResetComplete");
}

export async function signOutAction() {
  await clearSessionCookie();
  redirect("/login");
}
