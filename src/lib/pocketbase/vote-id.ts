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

  // 15 base36 chars encode log2(36^15) ≈ 77.6 bits of entropy. The first 10
  // digest bytes (80 bits) cover that with ~2.4 bits of headroom; digits are
  // emitted least-significant-first, so the unused high bits simply never
  // appear — not a lost digit, just unused capacity. Deterministic and
  // collision-safe at this app's scale (birthday bound ≈ 2^38.8 records before
  // a 50% collision chance — far beyond realistic vote counts). `BigInt(...)`
  // calls (not `123n` literals) so this compiles under the project's ES2017
  // target.
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
