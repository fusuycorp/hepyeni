import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { BookmarkCheck, AlertCircle, KeyRound } from "lucide-react";
import { confirmPasswordReset } from "@/lib/actions/auth";

const ERROR_MESSAGES: Record<string, string> = {
  WeakPassword: "Şifre en az 8 karakter uzunluğunda olmalıdır.",
  Mismatch: "Girilen şifreler birbiriyle eşleşmiyor.",
  Invalid: "Bu sıfırlama bağlantısı geçersiz veya süresi dolmuş — lütfen yeniden istekte bulunun.",
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
            Hesap Şifresi Sıfırlama
          </p>
        </div>

        <Card className="border-border/80 shadow-md">
          <CardHeader className="pb-3 text-center">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-1">
              <KeyRound className="size-4.5" />
            </div>
            <CardTitle className="text-base font-semibold">Yeni Şifre Belirleyin</CardTitle>
            <CardDescription className="text-xs">
              En az 8 karakterden oluşan güçlü bir şifre seçin.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            {!token ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs text-left">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  Bu sıfırlama bağlantısında doğrulama jetonu eksik. Lütfen giriş ekranından yeni bir bağlantı talep edin.
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
                    placeholder="Yeni şifre (en az 8 karakter)"
                    className="h-10 text-xs"
                  />
                  <Input
                    type="password"
                    name="passwordConfirm"
                    required
                    minLength={8}
                    placeholder="Yeni şifreyi onaylayın"
                    className="h-10 text-xs"
                  />
                  <Button type="submit" className="w-full font-semibold h-10 mt-1">
                    Şifreyi Güncelle
                  </Button>
                </form>
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
