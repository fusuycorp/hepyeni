import PocketBase from "pocketbase";

// This app never has client-side JS talking to PocketBase — every
// collection's API rules are superuser-only (see pb_migrations), and all
// authorization happens in Next.js server-action code, same as it did with
// Drizzle. This is the single server-side client used for every read/write.

declare global {
  var __pbSuperuser: PocketBase | undefined;
  var __pbSuperuserAuth: Promise<void> | undefined;
}

function createClient(): PocketBase {
  const pb = new PocketBase(process.env.PB_URL);
  // Without this, concurrent requests from different users on this shared
  // singleton would cancel each other's in-flight calls.
  pb.autoCancellation(false);
  return pb;
}

const pb = globalThis.__pbSuperuser ?? createClient();
globalThis.__pbSuperuser = pb;

async function ensureAuthenticated(): Promise<void> {
  if (pb.authStore.isValid) return;

  globalThis.__pbSuperuserAuth ??= pb
    .collection("_superusers")
    .authWithPassword(
      process.env.PB_SUPERUSER_EMAIL!,
      process.env.PB_SUPERUSER_PASSWORD!,
      { autoRefreshThreshold: 30 * 60 },
    )
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
