// PocketBase record ids are capped at 15 lowercase-alphanumeric characters,
// so the deterministic-id trick from the (abandoned) Appwrite plan —
// `${titleId}_${userId}` as the record's own id — doesn't fit. Instead
// derive a stable 15-char id from a hash of the pair: the first vote
// create() for a given (titleId, userId) is then atomic-by-construction
// (SQLite's single-writer model serializes concurrent creates; exactly one
// wins, the other 400s on the unique id), closing the "duplicate row /
// crash" race without needing a lock. See src/lib/actions/votes.ts.
export async function voteRecordId(
  titleId: string,
  userId: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${titleId}:${userId}`),
  );

  // 15 base36 chars needs ~78 bits; the first 10 digest bytes (80 bits) are
  // plenty and keep the BigInt small. `BigInt(...)` calls (not `123n`
  // literals) so this compiles under the project's ES2017 target.
  let n = BigInt(0);
  for (const byte of new Uint8Array(digest).subarray(0, 10)) {
    n = (n << BigInt(8)) | BigInt(byte);
  }

  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const base = BigInt(36);
  let out = "";
  while (out.length < 15) {
    out += alphabet[Number(n % base)];
    n /= base;
  }
  return out;
}
