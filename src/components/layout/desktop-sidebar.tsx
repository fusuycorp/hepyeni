"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, BookOpen, Rss, User, Shield, LogOut, BookmarkCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { getDisplayName, getInitials } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/client";

interface DesktopSidebarProps {
  user?: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    isAdmin?: boolean;
  } | null;
}

export function DesktopSidebar({ user }: DesktopSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();

  const navItems = [
    {
      href: "/groups",
      label: t.nav.groups,
      icon: Users,
      active: pathname === "/groups" || (pathname.startsWith("/groups") && !pathname.includes("/admin")),
    },
    {
      href: "/shelf",
      label: t.nav.shelf,
      icon: BookOpen,
      active: pathname === "/shelf",
    },
    {
      href: "/activity",
      label: t.nav.activity,
      icon: Rss,
      active: pathname === "/activity",
    },
    {
      href: "/profile",
      label: t.nav.profile,
      icon: User,
      active: pathname === "/profile",
    },
  ];

  if (user?.isAdmin) {
    navItems.push({
      href: "/admin",
      label: t.nav.admin,
      icon: Shield,
      active: pathname.startsWith("/admin"),
    });
  }

  const userInitials = getInitials(user?.name, user?.email);

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card/60 backdrop-blur-md z-30">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-border/60">
        <Link href="/groups" className="flex items-center gap-2.5 group">
          <div className="flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground font-bold shadow-2xs transition-transform group-hover:scale-105">
            <BookmarkCheck className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-base tracking-tight leading-none">
              {t.common.appName}
            </span>
            <span className="text-[11px] text-muted-foreground tracking-tight mt-0.5">
              {t.nav.mediaTracker}
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-0.5">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Main Nav Links */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        <div className="px-2 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {t.nav.menu}
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium transition-all",
                item.active
                  ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
              aria-current={item.active ? "page" : undefined}
            >
              <Icon className={cn("size-4", item.active ? "text-primary" : "text-muted-foreground")} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Legal Links */}
        <div className="px-2 pt-6 flex items-center gap-2 text-[10px] text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            {t.common.privacy}
          </Link>
          <span>&middot;</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            {t.common.terms}
          </Link>
          <span>&middot;</span>
          <span>hepyeni.net</span>
        </div>
      </div>

      {/* User Footer */}
      {user && (
        <div className="p-4 border-t border-border/60 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/profile"
              className="flex items-center gap-3 min-w-0 flex-1 p-1.5 rounded-sm hover:bg-muted/70 transition-colors"
            >
              <Avatar size="sm">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={getDisplayName(user, t.common.unnamedUser)} />}
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold truncate leading-tight">
                  {getDisplayName(user, t.common.unnamedUser)}
                </span>
                <span className="text-[11px] text-muted-foreground truncate leading-tight">
                  {user.email}
                </span>
              </div>
            </Link>

            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title={t.nav.signOut}
                aria-label={t.nav.signOut}
              >
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
