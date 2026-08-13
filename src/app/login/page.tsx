import { signInWithEmail, signInWithGoogle } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">Titirek</h1>
      <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
        Vote on what your group reads, watches, and listens to next.
      </p>
      {error === "AccessDenied" && (
        <p className="max-w-xs text-sm text-red-600 dark:text-red-400">
          This account has been suspended.
        </p>
      )}
      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="flex h-12 w-64 items-center justify-center gap-2 rounded-full bg-foreground px-5 font-medium text-background"
        >
          Continue with Google
        </button>
      </form>

      <div className="flex w-64 items-center gap-3 text-xs text-zinc-400">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        or
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form action={signInWithEmail} className="flex w-64 flex-col gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-center dark:border-zinc-700 dark:bg-transparent"
        />
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-full border border-zinc-300 px-5 font-medium dark:border-zinc-700"
        >
          Continue with email
        </button>
      </form>
    </div>
  );
}
