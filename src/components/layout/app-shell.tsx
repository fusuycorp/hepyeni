import React from "react";
import Link from "next/link";
import { ChevronLeft, BookmarkCheck } from "lucide-react";
import { DesktopSidebar } from "./desktop-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  user?: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    isAdmin?: boolean;
  } | null;
  backHref?: string;
  backLabel?: string;
  title?: string;
  headerActions?: React.ReactNode;
  maxWidth?: "default" | "narrow" | "wide" | "full";
}

export function AppShell({
  children,
  user,
  backHref,
  backLabel = "Geri",
  title,
  headerActions,
  maxWidth = "default",
}: AppShellProps) {
  const widthClasses = {
    narrow: "max-w-xl",
    default: "max-w-4xl",
    wide: "max-w-6xl",
    full: "max-w-7xl",
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Desktop Sidebar (Fixed left on >= md) */}
      <DesktopSidebar user={user} />

      {/* Mobile Top Header (Only on < md) */}
      <header className="sticky top-0 z-30 flex md:hidden h-14 items-center justify-between border-b bg-background/90 backdrop-blur-md px-4 supports-backdrop-filter:bg-background/80">
        <div className="flex items-center gap-2 min-w-0">
          {backHref ? (
            <Link
              href={backHref}
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "-ml-2 h-8 px-2 text-muted-foreground hover:text-foreground inline-flex items-center gap-1",
              })}
            >
              <ChevronLeft className="size-4" />
              <span className="text-xs font-medium">{backLabel}</span>
            </Link>
          ) : (
            <Link href="/groups" className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-2xs">
                <BookmarkCheck className="size-4" />
              </div>
              <span className="font-semibold text-sm tracking-tight">Titirek</span>
            </Link>
          )}

          {title && !backHref && (
            <span className="text-xs text-muted-foreground truncate border-l pl-2 ml-1">
              {title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {headerActions}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 flex flex-col">
        <div
          className={cn(
            "w-full mx-auto px-4 py-6 md:px-8 md:py-8 flex-1 flex flex-col",
            "pb-24 md:pb-12", // Extra space for mobile bottom nav
            widthClasses[maxWidth]
          )}
        >
          {backHref && (
            <div className="hidden md:flex items-center gap-2 mb-4">
              <Link
                href={backHref}
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className:
                    "-ml-2.5 h-8 px-2.5 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium",
                })}
              >
                <ChevronLeft className="size-4" />
                <span>{backLabel}</span>
              </Link>
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
}
