import type { Metadata } from "next";
import Link from "next/link";
import { BookmarkCheck, ArrowLeft, ShieldCheck, Lock, Trash2, Eye, Server, Sparkles } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslations();
  return { title: t.privacy.title, description: t.privacy.description };
}

export default async function PrivacyPolicyPage() {
  const t = await getServerTranslations();
  const p = t.privacy;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md px-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-4xl h-14 items-center justify-between gap-4">
          <Link href="/groups" className="flex items-center gap-2 font-bold text-sm tracking-tight">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookmarkCheck className="size-4" />
            </div>
            <span>Titirek</span>
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
              <span>{p.backToLogin}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="space-y-8">
          <div className="space-y-2 pb-6 border-b">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <ShieldCheck className="size-3.5" />
              <span>{p.badge}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{p.heading}</h1>
            <p className="text-xs text-muted-foreground">
              {p.lastUpdated} &middot; {p.platformLabel}
            </p>
          </div>

          <Card className="border-border/70 bg-muted/20 shadow-2xs">
            <CardContent className="p-5 space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground">{p.summaryHeading}:</p>
              <p>{p.summaryText}</p>
            </CardContent>
          </Card>

          <div className="space-y-8 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Eye className="size-4 text-primary" />
                <span>{p.collectedHeading}</span>
              </h2>
              <p>{p.collectedIntro}</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">{p.identityLabel}</strong> {p.identityText}</li>
                <li><strong className="text-foreground">{p.groupLabel}</strong> {p.groupText}</li>
                <li><strong className="text-foreground">{p.technicalLabel}</strong> {p.technicalText}</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Lock className="size-4 text-primary" />
                <span>{p.googleHeading}</span>
              </h2>
              <p>{p.googleIntro}</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>{p.googleUse}</li>
                <li>{p.googleNoShare}</li>
                <li>{p.googleNoTraining}</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Server className="size-4 text-primary" />
                <span>{p.integrationsHeading}</span>
              </h2>
              <p>{p.integrationsIntro}</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>{p.tmdb}</li>
                <li>{p.spotify}</li>
                <li>{p.googleBooks}</li>
                <li>{p.apple}</li>
              </ul>
              <p className="text-[11px] text-muted-foreground mt-1">{p.integrationsNote}</p>
            </section>

            <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <span>{p.llmHeading}</span>
              </h2>
              <p>{p.llmIntro}</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>{p.llmProcess}</li>
                <li>{p.llmNoTraining}</li>
                <li>{p.llmNoIdentity}</li>
                <li>{p.llmProviderPolicy}</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Trash2 className="size-4 text-primary" />
                <span>{p.rightsHeading}</span>
              </h2>
              <p>{p.rightsIntro}</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>{p.deleteAccount}</li>
                <li>{p.revokeAccess}</li>
                <li>{p.updateData}</li>
              </ul>
            </section>

            <section className="space-y-3 pt-4 border-t">
              <h2 className="text-base sm:text-lg font-bold text-foreground">{p.contactHeading}</h2>
              <p>{p.contactIntro}</p>
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1 font-mono">
                <p><span className="text-foreground font-semibold">{p.websiteLabel}</span> https://hepyeni.net</p>
                <p><span className="text-foreground font-semibold">{p.emailLabel}</span> contact@hepyeni.net</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t bg-card/60 py-6 px-4 text-center text-xs text-muted-foreground">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>&copy; {new Date().getFullYear()} Titirek &middot; hepyeni.net. {p.footerCopyright}</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground underline underline-offset-4">{p.privacyLink}</Link>
            <Link href="/terms" className="hover:text-foreground underline underline-offset-4">{p.termsLink}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
