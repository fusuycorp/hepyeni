"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/groups" });
}

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) throw new Error("Email is required");
  await signIn("nodemailer", { email, redirectTo: "/groups" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
