import type { Metadata } from "next";
import Link from "next/link";
import { BookmarkCheck, ArrowLeft, ShieldCheck, Lock, Trash2, Eye, Server } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Gizlilik Politikası (Privacy Policy) — Titirek",
  description: "Titirek ve hepyeni.net gizlilik politikası, veri güvenliği ve Google OAuth kullanıcı verileri beyanı.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "17 Ağustos 2026";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md px-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-4xl h-14 items-center justify-between gap-4">
          <Link href="/groups" className="flex items-center gap-2 font-bold text-sm tracking-tight">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookmarkCheck className="size-4" />
            </div>
            <span>Titirek</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8",
              })}
            >
              <ArrowLeft className="size-3.5" />
              <span>Giriş Ekranı</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="space-y-8">
          {/* Hero Heading */}
          <div className="space-y-2 pb-6 border-b">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <ShieldCheck className="size-3.5" />
              <span>Gizlilik ve Veri Güvenliği</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Gizlilik Politikası (Privacy Policy)
            </h1>
            <p className="text-xs text-muted-foreground">
              Son Güncelleme: {lastUpdated} &middot; hepyeni.net (Titirek Platformu)
            </p>
          </div>

          {/* Quick Summary Card */}
          <Card className="border-border/70 bg-muted/20 shadow-2xs">
            <CardContent className="p-5 space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground">
                Özetle Gizlilik Taahhüdümüz:
              </p>
              <p>
                Titirek (<span className="font-mono text-foreground">hepyeni.net</span>), arkadaş gruplarınızla kitap, film, dizi, müzik ve podcast listeleri oluşturup oylamanızı sağlayan ortak bir medya takip platformudur. Kişisel verilerinizi asla satmayız, üçüncü taraf reklam ağlarıyla paylaşmayız veya yapay zeka modelleri eğitmek için kullanmayız.
              </p>
            </CardContent>
          </Card>

          {/* Detailed Sections */}
          <div className="space-y-8 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Eye className="size-4 text-primary" />
                <span>1. Toplanan Bilgiler ve Veri Kaynakları</span>
              </h2>
              <p>
                Titirek hizmetlerini kullanırken aşağıdaki bilgiler toplanabilir ve işlenebilir:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">Kimlik ve Hesap Bilgileri:</strong> Google OAuth2, Apple ile Giriş veya e-posta ile kayıt olduğunuzda sağlanan ad, soyad, e-posta adresi ve profil fotoğrafı URL&apos;i.
                </li>
                <li>
                  <strong className="text-foreground">Grup ve İçerik Verileri:</strong> Oluşturduğunuz veya katıldığınız gruplar, önerdiğiniz medya başlıkları, verdiğiniz oylar ve yazdığınız incelemeler.
                </li>
                <li>
                  <strong className="text-foreground">Teknik ve Oturum Bilgileri:</strong> Güvenli oturum sürekliliği sağlamak amacıyla şifrelenmiş HTTP çerezleri (<code className="font-mono text-foreground">pb_session</code>) ve IP/cihaz güvenlik kayıtları.
                </li>
              </ul>
            </section>

            {/* Section 2 - Google OAuth Compliance */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Lock className="size-4 text-primary" />
                <span>2. Google Kullanıcı Verileri Politikası Uyumluluğu</span>
              </h2>
              <p>
                Titirek, Google API&apos;leri üzerinden alınan verilerin kullanımında Google API Hizmetleri Kullanıcı Verileri Politikası&apos;na (Google API Services User Data Policy) ve Sınırlı Kullanım (Limited Use) gereksinimlerine tam olarak uyar:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  Google OAuth ile alınan bilgiler (<code className="font-mono text-foreground">email</code>, <code className="font-mono text-foreground">profile</code>) yalnızca kullanıcının platformda kimliğini doğrulamak ve hesap profilini oluşturmak için kullanılır.
                </li>
                <li>
                  Google kullanıcı verileri hiçbir koşulda üçüncü taraflara satılmaz, veri simsarlarına devredilmez veya reklam hedefleme amacıyla kullanılmaz.
                </li>
                <li>
                  Google kullanıcı verileri, kullanıcının açık rızası olmaksızın yapay zeka (LLM / ML) modellerini eğitmek için kullanılmaz.
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Server className="size-4 text-primary" />
                <span>3. Üçüncü Taraf Entegrasyonları</span>
              </h2>
              <p>
                Titirek, kullanıcılara medya arama ve zengin içerik bilgisi sunmak amacıyla aşağıdaki üçüncü taraf API servislerini kullanır:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">The Movie Database (TMDB):</strong> Film ve dizi afişleri, özetleri ve yapımcı bilgileri için.</li>
                <li><strong className="text-foreground">Spotify API:</strong> Müzik albümü kapakları ve sanatçı bilgileri için.</li>
                <li><strong className="text-foreground">Google Books API:</strong> Kitap başlıkları, yazarlar ve kapak görselleri için.</li>
                <li><strong className="text-foreground">Apple iTunes API:</strong> Podcast arama ve podcast yayıncı bilgileri için.</li>
              </ul>
              <p className="text-[11px] text-muted-foreground mt-1">
                Bu servislerle yalnızca arama sorgularınız paylaşılır; kişisel kimlik veya hesap bilgileriniz bu sağlayıcılara aktarılmaz.
              </p>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Trash2 className="size-4 text-primary" />
                <span>4. Veri Saklama, Hesap Silme ve Kullanıcı Hakları</span>
              </h2>
              <p>
                Kullanıcılarımız verileri üzerinde tam kontrole sahiptir:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">Doğrudan Hesap Silme:</strong> Profil sayfanızdaki (<Link href="/profile" className="text-primary hover:underline font-medium">/profile</Link>) &quot;Hesabı Sil&quot; seçeneğini kullanarak hesabınızı, tüm kişisel verilerinizi, oylarınızı ve yorumlarınızı anında ve kalıcı olarak silebilirsiniz.
                </li>
                <li>
                  <strong className="text-foreground">Erişimi Kaldırma:</strong> Google Hesabınızın Güvenlik sayfasından Titirek&apos;e verilen izinleri istediğiniz an iptal edebilirsiniz.
                </li>
                <li>
                  <strong className="text-foreground">Düzeltme ve Güncelleme:</strong> Görünen isminizi ve şifrenizi dilediğiniz an profil ayarlarınızdan güncelleyebilirsiniz.
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3 pt-4 border-t">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                5. İletişim
              </h2>
              <p>
                Gizlilik politikamız veya kişisel verilerinizle ilgili her türlü soru, talep ve geri bildirim için bizimle iletişime geçebilirsiniz:
              </p>
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1 font-mono">
                <p><span className="text-foreground font-semibold">Web Sitesi:</span> https://hepyeni.net</p>
                <p><span className="text-foreground font-semibold">E-posta:</span> contact@hepyeni.net</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/60 py-6 px-4 text-center text-xs text-muted-foreground">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>&copy; {new Date().getFullYear()} Titirek &middot; hepyeni.net. Tüm hakları saklıdır.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground underline underline-offset-4">Gizlilik Politikası</Link>
            <Link href="/terms" className="hover:text-foreground underline underline-offset-4">Kullanım Koşulları</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
