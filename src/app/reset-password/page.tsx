import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { BookmarkCheck, AlertCircle, KeyRound } from "lucide-react";
import { confirmPasswordReset } from "@/lib/actions/auth";

const ERROR_MESSAGES: Record<string, string> = {
  WeakPassword: "Password must be at least 8 characters long.",
  Mismatch: "The passwords entered do not match.",
  Invalid: "This reset link is invalid or has expired — please request a new one.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-radial from-muted/40 via-background to-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold shadow-md">
            <BookmarkCheck className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Titirek</h1>
          <p className="text-xs text-muted-foreground">
            Account Password Reset
          </p>
        </div>

        <Card className="border-border/80 shadow-md">
          <CardHeader className="pb-3 text-center">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-1">
              <KeyRound className="size-4.5" />
            </div>
            <CardTitle className="text-base font-semibold">Set New Password</CardTitle>
            <CardDescription className="text-xs">
              Choose a strong password with at least 8 characters.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            {!token ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs text-left">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  This reset link is missing its verification token. Please request a new link from the login screen.
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {error && ERROR_MESSAGES[error] && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs text-left">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{ERROR_MESSAGES[error]}</span>
                  </div>
                )}

                <form action={confirmPasswordReset} className="space-y-3">
                  <input type="hidden" name="token" value={token} />
                  <Input
                    type="password"
                    name="password"
                    required
                    minLength={8}
                    placeholder="New password (min 8 chars)"
                    className="h-10 text-xs"
                  />
                  <Input
                    type="password"
                    name="passwordConfirm"
                    required
                    minLength={8}
                    placeholder="Confirm new password"
                    className="h-10 text-xs"
                  />
                  <Button type="submit" className="w-full font-semibold h-10 mt-1">
                    Update Password
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
