import PocketBase from "pocketbase";
import { getPbUrl } from "@/lib/pocketbase/session";

// This app never has client-side JS talking to PocketBase — every
// collection's API rules are superuser-only (see pb_migrations), and all
// authorization happens in Next.js server-action code, same as it did with
// Drizzle. This is the single server-side client used for every read/write.

declare global {
  var __pbSuperuser: PocketBase | undefined;
  var __pbSuperuserAuth: Promise<void> | undefined;
}

function createClient(): PocketBase {
  const pb = new PocketBase(getPbUrl());
  // Without this, concurrent requests from different users on this shared
  // singleton would cancel each other's in-flight calls.
  pb.autoCancellation(false);
  return pb;
}

const pb = globalThis.__pbSuperuser ?? createClient();
globalThis.__pbSuperuser = pb;

async function ensureAuthenticated(): Promise<void> {
  if (pb.authStore.isValid) return;

  const email = process.env.PB_SUPERUSER_EMAIL;
  const password = process.env.PB_SUPERUSER_PASSWORD;

  if (!email || !password) {
    const errorMsg = `[PocketBase Superuser] Missing credentials: PB_SUPERUSER_EMAIL or PB_SUPERUSER_PASSWORD is not set in the environment. PB_URL=${getPbUrl()}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }


  globalThis.__pbSuperuserAuth ??= (async () => {
    try {
      // PocketBase 0.23+ uses `_superusers`, older PocketBase uses `_admins`
      try {
        await pb
          .collection("_superusers")
          .authWithPassword(email, password, { autoRefreshThreshold: 30 * 60 });
      } catch (firstErr) {
        try {
          await pb
            .collection("_admins")
            .authWithPassword(email, password, { autoRefreshThreshold: 30 * 60 });
        } catch {
          throw firstErr;
        }
      }
    } catch (err: unknown) {
      console.error(
        `[PocketBase Superuser] Failed to authenticate superuser (${email}) at ${process.env.PB_URL ?? "http://localhost:8090"}:`,
        err,
      );
      throw err;
    }
  })()
    .then(() => undefined)
    .finally(() => {
      globalThis.__pbSuperuserAuth = undefined;
    });

  await globalThis.__pbSuperuserAuth;
}

export async function getSuperuserClient(): Promise<PocketBase> {
  await ensureAuthenticated();
  return pb;
}
