import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmPasswordReset } from "@/lib/actions/auth";

const ERROR_MESSAGES: Record<string, string> = {
  WeakPassword: "Password must be at least 8 characters.",
  Mismatch: "Passwords don't match.",
  Invalid: "This reset link is invalid or has expired — request a new one.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">Set a new password</h1>

      {!token ? (
        <p className="max-w-xs text-sm text-destructive">
          This reset link is missing its token — use the link from your
          email, or request a new one from the sign-in page.
        </p>
      ) : (
        <>
          {error && ERROR_MESSAGES[error] && (
            <p className="max-w-xs text-sm text-destructive">
              {ERROR_MESSAGES[error]}
            </p>
          )}
          <form
            action={confirmPasswordReset}
            className="flex w-64 flex-col gap-2"
          >
            <input type="hidden" name="token" value={token} />
            <Input
              type="password"
              name="password"
              required
              minLength={8}
              placeholder="New password"
              className="h-12 rounded-full text-center"
            />
            <Input
              type="password"
              name="passwordConfirm"
              required
              minLength={8}
              placeholder="Confirm new password"
              className="h-12 rounded-full text-center"
            />
            <Button type="submit" className="h-12 rounded-full">
              Set new password
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
