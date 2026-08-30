import type { Metadata } from "next";
import Link from "next/link";
import { BookmarkCheck, ArrowLeft, FileText, CheckCircle2, Users, AlertCircle } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslations();
  return { title: t.terms.title, description: t.terms.description };
}

export default async function TermsOfServicePage() {
  const t = await getServerTranslations();
  const tm = t.terms;

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
              <span>{tm.backToLogin}</span>
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
              <span>{tm.badge}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {tm.heading}
            </h1>
            <p className="text-xs text-muted-foreground">
              {tm.lastUpdated} &middot; {tm.platformLabel}
            </p>
          </div>

          {/* Detailed Sections */}
          <div className="space-y-8 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                <span>{tm.s1Heading}</span>
              </h2>
              <p>
                {tm.s1Text}
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <span>{tm.s2Heading}</span>
              </h2>
              <p>
                {tm.s2Text}
              </p>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <AlertCircle className="size-4 text-primary" />
                <span>{tm.s3Heading}</span>
              </h2>
              <p>{tm.s3Intro}</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>{tm.s3Rule1}</li>
                <li>{tm.s3Rule2}</li>
                <li>{tm.s3Rule3}</li>
                <li>{tm.s3Rule4}</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {tm.s4Heading}
              </h2>
              <p>
                {tm.s4Text}
              </p>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {tm.s5Heading}
              </h2>
              <p>
                {tm.s5Text}
              </p>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {tm.s6Heading}
              </h2>
              <p>
                {tm.s6Text}
              </p>
            </section>

            {/* Section 7 */}
            <section className="space-y-3 pt-4 border-t">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                {tm.s7Heading}
              </h2>
              <p>
                {tm.s7Intro}
              </p>
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1 font-mono">
                <p><span className="text-foreground font-semibold">{tm.websiteLabel}</span> https://hepyeni.net</p>
                <p><span className="text-foreground font-semibold">{tm.emailLabel}</span> contact@hepyeni.net</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/60 py-6 px-4 text-center text-xs text-muted-foreground">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>&copy; {new Date().getFullYear()} HepYeni &middot; hepyeni.net. {tm.footerCopyright}</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground underline underline-offset-4">{tm.privacyLink}</Link>
            <Link href="/terms" className="hover:text-foreground underline underline-offset-4">{tm.termsLink}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
