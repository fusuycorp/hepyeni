import Link from "next/link";
import { redirect } from "next/navigation";
import { BookmarkCheck, ArrowLeft, KeyRound } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getServerTranslations } from "@/lib/i18n/server";
import { EnterCodeForm } from "./enter-code-form";

export default async function InviteRootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  if (code && typeof code === "string" && code.trim().length > 0) {
    redirect(`/invite/${encodeURIComponent(code.trim().toUpperCase())}`);
  }

  const t = await getServerTranslations();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-radial from-muted/40 via-background to-background text-foreground selection:bg-primary/20">
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-base tracking-tight"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <BookmarkCheck className="size-5" />
            </div>
            <span className="text-foreground tracking-tight font-semibold text-lg">
              HepYeni
            </span>
          </Link>
        </div>

        <Card className="border-border/80 shadow-md p-6 sm:p-8">
          <CardContent className="space-y-6 pt-2">
            <div className="text-center space-y-2">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto shadow-2xs">
                <KeyRound className="size-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {t.invite.enterCodeTitle}
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {t.invite.enterCodeDesc}
              </p>
            </div>

            <EnterCodeForm />

            <div className="pt-2 text-center border-t border-border/50">
              <Link
                href="/"
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "text-xs text-muted-foreground hover:text-foreground gap-1.5",
                })}
              >
                <ArrowLeft className="size-3.5" />
                <span>{t.invite.backToHome}</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
