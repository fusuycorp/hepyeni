"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clapperboard,
  Compass,
  Disc3,
  Flame,
  Heart,
  Layers,
  MessageSquare,
  Mic,
  Quote,
  Shield,
  Sparkles,
  Star,
  Tv,
  Users,
} from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { VoteControl } from "@/components/vote-control";
import { useTranslations, useLocale } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface LandingViewProps {
  currentUser?: {
    id: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
  } | null;
}

export function LandingView({ currentUser }: LandingViewProps) {
  const t = useTranslations();
  const locale = useLocale();

  const mediaTypes = [
    {
      type: "book" as const,
      label: t.media.book,
      icon: BookOpen,
      sample: "A Gentleman in Moscow",
      creator: "Amor Towles",
      note: locale === "tr" ? "Edebiyat & Romanlar" : "Literature & Novels",
    },
    {
      type: "movie" as const,
      label: t.media.movie,
      icon: Clapperboard,
      sample: "Perfect Days",
      creator: "Wim Wenders",
      note: locale === "tr" ? "Sinema & Klasikler" : "Cinema & Classics",
    },
    {
      type: "tv" as const,
      label: t.media.tv,
      icon: Tv,
      sample: "Severance",
      creator: "Dan Erickson",
      note: locale === "tr" ? "Mini Diziler & Sezonlar" : "Limited Series & Shows",
    },
    {
      type: "music" as const,
      label: t.media.music,
      icon: Disc3,
      sample: "Promises",
      creator: "Floating Points, Pharoah Sanders",
      note: locale === "tr" ? "Albümler & Plaklar" : "Vinyl & Full Albums",
    },
    {
      type: "podcast" as const,
      label: t.media.podcast,
      icon: Mic,
      sample: "Philosophize This!",
      creator: "Stephen West",
      note: locale === "tr" ? "Sesli Denemeler & Sohbetler" : "Audio Essays & Talks",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-foreground">
      {/* Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md px-4 sm:px-8 transition-colors">
        <div className="mx-auto flex w-full max-w-5xl h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-base tracking-tight group"
          >
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs group-hover:scale-105 transition-transform">
              <BookOpen className="size-4.5" />
            </div>
            <span className="text-foreground tracking-tight font-semibold">
              Titirek
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />
            <ThemeToggle />

            {currentUser ? (
              <Link
                href="/groups"
                className={buttonVariants({
                  variant: "default",
                  size: "sm",
                  className: "gap-2 text-xs font-semibold shadow-xs",
                })}
              >
                <span>{t.landing.goToCircles}</span>
                <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className={buttonVariants({
                    variant: "ghost",
                    size: "sm",
                    className: "text-xs font-medium text-muted-foreground hover:text-foreground",
                  })}
                >
                  {t.landing.signIn}
                </Link>
                <Link
                  href="/login"
                  className={buttonVariants({
                    variant: "default",
                    size: "sm",
                    className: "gap-1.5 text-xs font-semibold shadow-xs",
                  })}
                >
                  <span>{t.landing.getStarted}</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Landing Flow */}
      <main className="flex-1">
        {/* 1. Hero Section (Slow Cooking / Patient Living Aesthetic) */}
        <section className="relative px-4 sm:px-8 pt-12 sm:pt-20 pb-16 sm:pb-24 border-b border-border/40 overflow-hidden">
          <div className="mx-auto max-w-4xl space-y-8 text-center">
            {/* Gentle Warm Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 border border-border/70 text-xs font-medium text-muted-foreground shadow-2xs">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>{t.landing.heroBadge}</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.15] max-w-3xl mx-auto">
              {t.landing.heroTitle}
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              {t.landing.heroSubtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href={currentUser ? "/groups" : "/login"}
                className={buttonVariants({
                  variant: "default",
                  size: "lg",
                  className: "h-11 px-6 text-sm font-semibold gap-2 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all",
                })}
              >
                <span>
                  {currentUser
                    ? t.landing.goToCircles
                    : t.landing.getStarted}
                </span>
                <ArrowRight className="size-4" />
              </Link>

              <Link
                href="/invite/SAMPLE"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "h-11 px-5 text-sm font-medium text-muted-foreground hover:text-foreground border-border/70",
                })}
              >
                <span>{t.landing.joinWithCode}</span>
              </Link>
            </div>

            {currentUser && (
              <p className="text-xs text-muted-foreground pt-1">
                {t.landing.welcomeBack.replace(
                  "{name}",
                  currentUser.name || currentUser.email || ""
                )}
              </p>
            )}

            {/* 2. Interactive Tactile Backlog Preview Card */}
            <div className="pt-8 sm:pt-12 max-w-2xl mx-auto text-left">
              <div className="p-1 rounded-2xl bg-gradient-to-b from-border/70 to-border/30 shadow-md">
                <Card className="border-0 bg-card/95 backdrop-blur-sm rounded-[14px] overflow-hidden">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    {/* Circle & Status Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-border/50 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {locale === "tr" ? "Pazar Okuma Grubu" : "Sunday Reading Club"}
                        </span>
                        <span className="text-muted-foreground">&middot;</span>
                        <span className="text-muted-foreground">
                          {t.media.upNext}
                        </span>
                      </div>
                      <Badge
                        variant="default"
                        className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-semibold"
                      >
                        {t.media.topPick}
                      </Badge>
                    </div>

                    {/* Media Item Detail */}
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="shrink-0">
                        <MediaCover
                          src="https://covers.openlibrary.org/b/id/10521270-M.jpg"
                          alt={t.landing.previewTitle}
                          size="md"
                          className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg shadow-sm"
                        />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <MediaBadge type="book" size="sm" />
                          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            <Star className="size-3 fill-amber-500" />
                            <span>4.9</span>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight leading-snug">
                            {t.landing.previewTitle}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                            {t.landing.previewCreator}
                          </p>
                        </div>

                        <p className="text-xs text-muted-foreground/90 italic leading-relaxed pt-0.5">
                          &ldquo;{t.landing.previewNote}&rdquo;
                        </p>
                      </div>
                    </div>

                    {/* Member Note & Tasting Reflection */}
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar size="sm" className="size-5 ring-1 ring-border">
                            <AvatarFallback className="text-[9px]">
                              {t.landing.previewReviewer[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-foreground text-[11px]">
                            {t.landing.previewReviewer}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className="size-2.5 fill-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-muted-foreground leading-relaxed text-[11px]">
                        &ldquo;{t.landing.previewReview}&rdquo;
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Philosophy Callout ("The Simmering Table") */}
        <section className="px-4 sm:px-8 py-16 sm:py-20 bg-muted/20 border-b border-border/40">
          <div className="mx-auto max-w-3xl text-center space-y-4">
            <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Quote className="size-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {t.landing.philosophyTitle}
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed italic max-w-2xl mx-auto">
              &ldquo;{t.landing.philosophyText}&rdquo;
            </p>
          </div>
        </section>

        {/* 4. Supported Media Shelves */}
        <section className="px-4 sm:px-8 py-16 sm:py-24 border-b border-border/40">
          <div className="mx-auto max-w-5xl space-y-12">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {t.landing.mediaTypesHeadline}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {t.landing.mediaTypesDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mediaTypes.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.type}
                    className="p-5 rounded-2xl border border-border/60 bg-card/60 hover:bg-card hover:border-border transition-all duration-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                          <Icon className="size-4.5" />
                        </div>
                        <span className="font-bold text-sm text-foreground">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {item.note}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs space-y-0.5">
                      <p className="font-semibold text-foreground line-clamp-1">
                        {item.sample}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {item.creator}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Custom Media Card */}
              <div className="p-5 rounded-2xl border border-dashed border-border bg-muted/20 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="size-4.5" />
                    </div>
                    <span className="font-bold text-sm text-foreground">
                      {t.titles.addCustomTitle}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {locale === "tr"
                      ? "Veritabanlarında olmayan yerel tiyatro oyunları, bağımsız makaleler ve özel öneriler."
                      : "Add independent essays, plays, local performances, and personal discoveries."}
                  </p>
                </div>
                <Badge variant="outline" className="w-fit text-[10px]">
                  {t.media.externalSource}: Custom
                </Badge>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Core Pillars / Features */}
        <section className="px-4 sm:px-8 py-16 sm:py-24 bg-muted/10 border-b border-border/40">
          <div className="mx-auto max-w-5xl space-y-12">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {t.landing.featuresHeading}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {t.landing.featuresSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Feature 1 */}
              <div className="p-6 rounded-2xl border border-border/70 bg-card space-y-3 shadow-2xs">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Layers className="size-4.5" />
                </div>
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  {t.landing.feature1Title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t.landing.feature1Desc}
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-2xl border border-border/70 bg-card space-y-3 shadow-2xs">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Sparkles className="size-4.5" />
                </div>
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  {t.landing.feature2Title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t.landing.feature2Desc}
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-2xl border border-border/70 bg-card space-y-3 shadow-2xs">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <MessageSquare className="size-4.5" />
                </div>
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  {t.landing.feature3Title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t.landing.feature3Desc}
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-6 rounded-2xl border border-border/70 bg-card space-y-3 shadow-2xs">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Shield className="size-4.5" />
                </div>
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  {t.landing.feature4Title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {t.landing.feature4Desc}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. The 3-Step Flow */}
        <section className="px-4 sm:px-8 py-16 sm:py-24 border-b border-border/40">
          <div className="mx-auto max-w-4xl space-y-12">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {t.landing.stepsHeading}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 space-y-3">
                <div className="size-8 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                  {t.landing.step1Title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t.landing.step1Desc}
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 space-y-3">
                <div className="size-8 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                  {t.landing.step2Title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t.landing.step2Desc}
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 space-y-3">
                <div className="size-8 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                  {t.landing.step3Title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t.landing.step3Desc}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Bottom Warm CTA */}
        <section className="px-4 sm:px-8 py-16 sm:py-24 text-center">
          <div className="mx-auto max-w-2xl space-y-6">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground leading-snug">
              {t.landing.ctaTitle}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
              {t.landing.ctaSubtitle}
            </p>
            <div className="pt-2">
              <Link
                href={currentUser ? "/groups" : "/login"}
                className={buttonVariants({
                  variant: "default",
                  size: "lg",
                  className: "h-11 px-6 text-sm font-semibold gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all",
                })}
              >
                <span>{t.landing.ctaButton}</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Public Footer */}
      <footer className="border-t border-border/60 bg-muted/20 px-4 sm:px-8 py-8 sm:py-12 text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <span className="font-semibold text-foreground">Titirek</span>
            <span>&middot;</span>
            <span>{t.common.appDescription}</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              {t.common.privacy}
            </Link>
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              {t.common.terms}
            </Link>
            <Link
              href="/login"
              className="hover:text-foreground transition-colors"
            >
              {t.landing.signIn}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
