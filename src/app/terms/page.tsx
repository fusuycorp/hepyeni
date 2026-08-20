import type { Metadata } from "next";
import Link from "next/link";
import { BookmarkCheck, ArrowLeft, FileText, CheckCircle2, Users, AlertCircle } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Kullanım Koşulları (Terms of Service) — HepYeni",
  description: "HepYeni ve hepyeni.net platformu kullanım şartları ve topluluk kuralları.",
};

export default function TermsOfServicePage() {
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
            <span>HepYeni</span>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageToggle />
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
              <FileText className="size-3.5" />
              <span>Hizmet Şartları</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Kullanım Koşulları (Terms of Service)
            </h1>
            <p className="text-xs text-muted-foreground">
              Son Güncelleme: {lastUpdated} &middot; hepyeni.net (HepYeni Platformu)
            </p>
          </div>

          {/* Detailed Sections */}
          <div className="space-y-8 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                <span>1. Koşulların Kabulü</span>
              </h2>
              <p>
                HepYeni platformuna (<code className="font-mono text-foreground">hepyeni.net</code>) erişerek veya platformu kullanarak, işbu Kullanım Koşulları&apos;nı ve <Link href="/privacy" className="text-primary hover:underline font-medium">Gizlilik Politikası</Link>&apos;nı kabul etmiş sayılırsınız. Bu koşulları kabul etmiyorsanız lütfen platformu kullanmayınız.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <span>2. Hizmetin Tanımı ve Kapsamı</span>
              </h2>
              <p>
                HepYeni; kitap kulüpleri, arkadaş grupları ve topluluklar için ortak medya listeleri oluşturma, oylama ve değerlendirme yapma olanağı tanıyan iş birlikçi bir medya takip aracıdır. Platform, üçüncü taraf veri sağlayıcıları (TMDB, Spotify, Google Books, Apple Podcasts) aracılığıyla medya meta verilerini görüntüler.
              </p>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <AlertCircle className="size-4 text-primary" />
                <span>3. Kullanıcı Hesapları ve Davranış Kuralları</span>
              </h2>
              <p>Platformu kullanırken aşağıdaki kurallara uymayı taahhüt edersiniz:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Hesabınızın güvenliğini korumak ve yetkisiz erişimleri engellemek sizin sorumluluğunuzdadır.</li>
                <li>Platform üzerinden hakaret, nefret söylemi, spam veya yasa dışı içerik paylaşmak yasaktır.</li>
                <li>Sistemin işleyişini bozacak otomatik botlar veya güvenlik zaafiyeti tarayıcıları çalıştırmak yasaktır.</li>
                <li>Kurallara aykırı davranan kullanıcıların hesapları yöneticiler tarafından uyarılmaksızın askıya alınabilir veya silinebilir.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                4. Fikri Mülkiyet ve Üçüncü Taraf Hakları
              </h2>
              <p>
                Platformda görüntülenen film, dizi, kitap, müzik ve podcast afişleri, başlıkları ve açıklamaları ilgili hak sahiplerine ve veri sağlayıcılarına (TMDB, Spotify, Google, Apple) aittir. Kullanıcıların platformda yazdığı özgün yorum ve değerlendirmeler ilgili kullanıcının mülkiyetindedir.
              </p>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                5. Sorumluluğun Sınırlandırılması
              </h2>
              <p>
                HepYeni hizmeti &quot;olduğu gibi&quot; (as-is) ve &quot;mevcut olduğu şekilde&quot; sağlanmaktadır. hepyeni.net, hizmetin kesintisiz veya hatasız olacağını garanti etmez; veri kaybı veya hizmet kesintilerinden doğabilecek dolaylı zararlardan sorumlu tutulamaz.
              </p>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                6. Hesap Kapatma ve Hizmet Değişiklikleri
              </h2>
              <p>
                Kullanıcılar diledikleri zaman profil sayfalarından hesaplarını kalıcı olarak silebilirler. hepyeni.net, önceden bildirimde bulunarak veya bulunmaksızın hizmet şartlarını güncelleme veya hizmeti sonlandırma hakkını saklı tutar.
              </p>
            </section>

            {/* Section 7 */}
            <section className="space-y-3 pt-4 border-t">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                7. İletişim
              </h2>
              <p>
                Kullanım koşulları ile ilgili sorularınız için lütfen bizimle iletişime geçin:
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
          <p>&copy; {new Date().getFullYear()} HepYeni &middot; hepyeni.net. Tüm hakları saklıdır.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground underline underline-offset-4">Gizlilik Politikası</Link>
            <Link href="/terms" className="hover:text-foreground underline underline-offset-4">Kullanım Koşulları</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
