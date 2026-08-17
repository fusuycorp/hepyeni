import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { BookmarkCheck, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
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
  AccessDenied: "Bu hesap bir yönetici tarafından askıya alınmıştır.",
  InvalidCode: "Girilen doğrulama kodu geçersiz veya süresi dolmuş.",
  InvalidCredentials: "E-posta veya şifre hatalı.",
  InvalidPassword: "Şifre en fazla 128 karakter olabilir.",
  WeakPassword: "Şifre en az 8 karakter uzunluğunda olmalıdır.",
  EmailInUse: "Bu e-posta adresiyle kayıtlı bir hesap zaten var.",
  SignupFailed: "Hesap oluşturulamadı. Lütfen tekrar deneyin veya başka bir giriş yöntemi kullanın.",
};

const NOTICE_MESSAGES: Record<string, string> = {
  ResetComplete: "Şifreniz başarıyla güncellendi — yeni bilgilerinizle giriş yapabilirsiniz.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; step?: string; notice?: string }>;
}) {
  const { error, step, notice } = await searchParams;
  const otp = step === "code" ? await peekOtpCookie() : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-radial from-muted/40 via-background to-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold shadow-md">
            <BookmarkCheck className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Titirek</h1>
          <p className="text-xs text-muted-foreground max-w-xs">
            Arkadaşlarınızla ve kulüplerinizle kitap, film, dizi, müzik ve podcast takip edin.
          </p>
        </div>

        {/* Notices and Errors */}
        {error && ERROR_MESSAGES[error] && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertCircle className="size-4 shrink-0" />
            <span>{ERROR_MESSAGES[error]}</span>
          </div>
        )}

        {notice && NOTICE_MESSAGES[notice] && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{NOTICE_MESSAGES[notice]}</span>
          </div>
        )}

        {/* Main Auth Card */}
        <Card className="border-border/80 shadow-md">
          <CardContent className="p-6">
            {otp ? (
              <form action={verifyEmailCode} className="space-y-4 text-center">
                <div className="space-y-1">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
                    <Mail className="size-5" />
                  </div>
                  <h2 className="text-sm font-semibold">Kodunuzu Doğrulayın</h2>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{otp.email}</span> adresine gönderilen 6 haneli kodu girin
                  </p>
                </div>

                <Input
                  type="text"
                  name="code"
                  inputMode="numeric"
                  required
                  autoFocus
                  placeholder="123456"
                  maxLength={10}
                  className="h-11 text-center font-mono text-lg tracking-widest"
                />

                <Button type="submit" className="w-full font-semibold">
                  Doğrula ve Giriş Yap
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Social Login Buttons */}
                <div className="space-y-2">
                  <form action={signInWithGoogle}>
                    <Button type="submit" variant="outline" className="w-full font-medium justify-center h-10 shadow-2xs">
                      <svg className="size-4 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Google ile Devam Et</span>
                    </Button>
                  </form>

                  <form action={signInWithApple}>
                    <Button type="submit" variant="outline" className="w-full font-medium justify-center h-10 shadow-2xs">
                      <svg className="size-4 mr-2 fill-current" viewBox="0 0 170 170">
                        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.8-12-14.28-6.19-9.13-11.1-19.63-14.75-31.5-3.65-11.87-5.48-23.01-5.48-33.43 0-14.57 3.73-26.68 11.2-36.33 7.46-9.66 16.81-14.65 28.05-14.98 4.35 0 9.27 1.17 14.75 3.52 5.48 2.34 9.27 3.58 11.37 3.71 1.74-.13 5.79-1.42 12.16-3.87 6.37-2.45 11.64-3.52 15.8-3.21 11.87.65 21.32 4.9 28.37 12.74-10.23 6.19-15.24 14.89-15.02 26.09.22 8.7 3.48 16.09 9.78 22.18 6.3 6.09 13.92 9.56 22.83 10.43-1.74 5.22-3.8 10.43-6.19 15.65zM119.22 31.02c0-7.07 2.5-13.48 7.5-19.24 5-5.76 11.2-9.24 18.6-10.43.22 1.3.33 2.5.33 3.59 0 7.07-2.61 13.59-7.83 19.57-5.22 5.98-11.41 9.46-18.6 10.43z" />
                      </svg>
                      <span>Apple ile Devam Et</span>
                    </Button>
                  </form>
                </div>

                <div className="relative flex items-center justify-center my-2">
                  <Separator className="w-full" />
                  <span className="absolute bg-card px-2 text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    veya şununla devam et
                  </span>
                </div>

                <Tabs defaultValue="link" className="w-full">
                  <TabsList className="grid grid-cols-2 w-full mb-3">
                    <TabsTrigger value="link" className="text-xs">E-posta Kodu</TabsTrigger>
                    <TabsTrigger value="password" className="text-xs">Şifre</TabsTrigger>
                  </TabsList>

                  <TabsContent value="link" className="space-y-3 pt-1">
                    <form action={signInWithEmail} className="space-y-2.5">
                      <Input
                        type="email"
                        name="email"
                        required
                        placeholder="ornek@eposta.com"
                        className="text-xs h-10"
                      />
                      <Button type="submit" className="w-full text-xs font-semibold h-10">
                        Giriş Kodu Gönder
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="password" className="space-y-3 pt-1">
                    <form className="space-y-2.5">
                      <Input
                        type="email"
                        name="email"
                        required
                        placeholder="ornek@eposta.com"
                        className="text-xs h-10"
                      />
                      <Input
                        type="password"
                        name="password"
                        required
                        minLength={8}
                        placeholder="Şifre (en az 8 karakter)"
                        className="text-xs h-10"
                      />
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                          type="submit"
                          formAction={signInWithPassword}
                          variant="default"
                          className="w-full text-xs font-semibold h-9"
                        >
                          Giriş Yap
                        </Button>
                        <Button
                          type="submit"
                          formAction={signUpWithPassword}
                          variant="secondary"
                          className="w-full text-xs font-semibold h-9"
                        >
                          Kayıt Ol
                        </Button>
                      </div>
                    </form>

                    <div className="pt-2 text-center">
                      <Dialog>
                        <DialogTrigger
                          render={
                            <Button
                              variant="link"
                              size="xs"
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Şifrenizi mi unuttunuz?
                            </Button>
                          }
                        />
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Şifrenizi Sıfırlayın</DialogTitle>
                            <DialogDescription className="text-xs">
                              Hesabınıza ait e-posta adresini girin, size yeni şifre belirleme bağlantısı gönderelim.
                            </DialogDescription>
                          </DialogHeader>
                          <ForgotPasswordForm />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Legal Links */}
        <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground underline underline-offset-4 transition-colors">
            Gizlilik Politikası
          </Link>
          <span>&middot;</span>
          <Link href="/terms" className="hover:text-foreground underline underline-offset-4 transition-colors">
            Kullanım Koşulları
          </Link>
        </div>
      </div>
    </div>
  );
}
