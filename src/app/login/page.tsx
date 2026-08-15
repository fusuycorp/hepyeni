import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  verifyEmailCode,
} from "@/lib/actions/auth";
import { peekOtpCookie } from "@/lib/pocketbase/session";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "This account has been suspended.",
  WeakPassword: "Password must be at least 8 characters.",
  EmailInUse: "An account with that email already exists.",
};

const NOTICE_MESSAGES: Record<string, string> = {
  ResetComplete: "Password updated — sign in with your new password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; step?: string; notice?: string }>;
}) {
  const { error, step, notice } = await searchParams;
  const otp = step === "code" ? await peekOtpCookie() : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">Titirek</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Vote on what your group reads, watches, and listens to next.
      </p>
      {error && ERROR_MESSAGES[error] && (
        <p className="max-w-xs text-sm text-destructive">
          {ERROR_MESSAGES[error]}
        </p>
      )}
      {notice && NOTICE_MESSAGES[notice] && (
        <p className="max-w-xs text-sm text-muted-foreground">
          {NOTICE_MESSAGES[notice]}
        </p>
      )}

      {otp ? (
        <form action={verifyEmailCode} className="flex w-64 flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Enter the code sent to {otp.email}
          </p>
          <Input
            type="text"
            name="code"
            inputMode="numeric"
            required
            autoFocus
            placeholder="123456"
            className="h-12 rounded-full text-center tracking-widest"
          />
          <Button type="submit" className="h-12 rounded-full">
            Verify code
          </Button>
        </form>
      ) : (
        <div className="flex w-64 flex-col gap-3">
          <form action={signInWithGoogle}>
            <Button type="submit" className="h-12 w-full rounded-full">
              Continue with Google
            </Button>
          </form>

          <form action={signInWithApple}>
            <Button type="submit" className="h-12 w-full rounded-full">
              Continue with Apple
            </Button>
          </form>

          <div className="my-1 flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>

          <Tabs defaultValue="link" className="gap-3">
            <TabsList className="w-full">
              <TabsTrigger value="link">Email link</TabsTrigger>
              <TabsTrigger value="password">Password</TabsTrigger>
            </TabsList>

            <TabsContent value="link">
              <form
                action={signInWithEmail}
                className="flex flex-col gap-2"
              >
                <Input
                  type="email"
                  name="email"
                  required
                  placeholder="you@example.com"
                  className="h-12 rounded-full text-center"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="h-12 w-full rounded-full"
                >
                  Continue with email
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="password">
              <form className="flex flex-col gap-2">
                <Input
                  type="email"
                  name="email"
                  required
                  placeholder="you@example.com"
                  className="h-12 rounded-full text-center"
                />
                <Input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  placeholder="Password"
                  className="h-12 rounded-full text-center"
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    formAction={signInWithPassword}
                    variant="outline"
                    className="h-12 flex-1 rounded-full"
                  >
                    Sign in
                  </Button>
                  <Button
                    type="submit"
                    formAction={signUpWithPassword}
                    variant="outline"
                    className="h-12 flex-1 rounded-full"
                  >
                    Sign up
                  </Button>
                </div>
              </form>

              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto p-0 text-muted-foreground"
                    >
                      Forgot password?
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset your password</DialogTitle>
                    <DialogDescription>
                      Enter your account email and we&apos;ll send a link to
                      set a new password.
                    </DialogDescription>
                  </DialogHeader>
                  <ForgotPasswordForm />
                </DialogContent>
              </Dialog>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
