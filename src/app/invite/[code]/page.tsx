import Link from "next/link";
import {
  BookmarkCheck,
  Users,
  Film,
  AlertCircle,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { MediaCover } from "@/components/media-cover";
import { MediaBadge } from "@/components/media-badge";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getGroupByInviteCode } from "@/lib/queries/groups";
import { getSession } from "@/lib/pocketbase/session";
import { getLocale, getServerTranslations } from "@/lib/i18n/server";
import { formatRelativeTime } from "@/lib/i18n";
import { InviteCTA } from "./invite-cta";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [overview, session, t, locale] = await Promise.all([
    getGroupByInviteCode(code),
    getSession(),
    getServerTranslations(),
    getLocale(),
  ]);


  if (!overview) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-radial from-muted/40 via-background to-background">
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <Card className="w-full max-w-md border-border/80 shadow-md text-center p-6">
          <CardContent className="space-y-4 pt-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mx-auto shadow-xs">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                {t.invite.invalidCodeTitle}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t.invite.invalidCodeDesc}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href={session ? "/groups" : "/login"}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ArrowLeft className="size-3.5 mr-1.5" />
                <span>{t.invite.backToHome}</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { group, memberCount, proposedCount, isMember, proposedTitles } =
    overview;

  return (
    <div className="min-h-screen flex flex-col bg-radial from-muted/30 via-background to-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <Link href={session ? "/groups" : "/login"} className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
            <BookmarkCheck className="size-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground">
            {t.common.appName}
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Circle Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-sm text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <Users className="size-3.5" />
            <span>{t.invite.invitedToJoin}</span>
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {group.name}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {t.invite.invitationSubtitle}
            </p>
          </div>

          {/* Circle Meta Stats */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground pt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/60 border border-border/50 font-medium">
              <Users className="size-3.5 text-primary" />
              <span>{t.invite.membersCount.replace("{n}", String(memberCount))}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/60 border border-border/50 font-medium">
              <Film className="size-3.5 text-primary" />
              <span>{t.invite.proposedCount.replace("{n}", String(proposedCount))}</span>
            </div>

            <CopyInviteButton code={code} variant="pill" mode="link" />
          </div>

          {/* Primary Action */}
          <div className="pt-2">
            <InviteCTA
              code={code}
              groupId={group.id}
              isLoggedIn={Boolean(session)}
              isMember={Boolean(isMember)}
            />
          </div>
        </div>

        {/* Media Preview Section (Overview of Proposed Content) */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              {t.invite.backlogPreviewTitle}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t.invite.backlogPreviewDesc}
            </p>
          </div>

          {proposedTitles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-xs text-muted-foreground bg-muted/20">
              {t.invite.emptyBacklog}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {proposedTitles.map((title) => (
                <div
                  key={title.id}
                  className="flex gap-3 p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/20 transition-colors shadow-2xs"
                >
                  <MediaCover
                    src={title.coverUrl}
                    alt={title.title}
                    size="md"
                    className="shrink-0"
                  />
                  <div className="flex flex-col justify-between min-w-0 flex-1">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <MediaBadge type={title.mediaType} size="sm" />
                      </div>
                      <h3
                        className="font-semibold text-xs sm:text-sm text-foreground line-clamp-2 leading-snug"
                        title={title.title}
                      >
                        {title.title}
                      </h3>
                      {title.creator && (
                        <p
                          className="text-[11px] text-muted-foreground line-clamp-1"
                          title={title.creator}
                        >
                          {title.creator}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 pt-2">
                      <Calendar className="size-3" />
                      <span>{formatRelativeTime(title.createdAt, locale)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Simple Footer */}
      <footer className="py-6 border-t border-border/40 text-center text-[11px] text-muted-foreground">
        <div className="flex items-center justify-center gap-3">
          <Link href="/privacy" className="hover:text-foreground underline underline-offset-4">
            {t.common.privacy}
          </Link>
          <span>&middot;</span>
          <Link href="/terms" className="hover:text-foreground underline underline-offset-4">
            {t.common.terms}
          </Link>
        </div>
      </footer>
    </div>
  );
}
