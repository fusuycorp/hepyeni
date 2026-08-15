"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Rss, User, Shield, LogOut, BookmarkCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

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

  const navItems = [
    {
      href: "/groups",
      label: "Groups",
      icon: Users,
      active: pathname === "/groups" || (pathname.startsWith("/groups") && !pathname.includes("/admin")),
    },
    {
      href: "/activity",
      label: "Activity",
      icon: Rss,
      active: pathname === "/activity",
    },
    {
      href: "/profile",
      label: "Profile",
      icon: User,
      active: pathname === "/profile",
    },
  ];

  if (user?.isAdmin) {
    navItems.push({
      href: "/admin",
      label: "Admin Portal",
      icon: Shield,
      active: pathname.startsWith("/admin"),
    });
  }

  const userInitials = (user?.name?.trim() || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card/60 backdrop-blur-md z-30">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b">
        <Link href="/groups" className="flex items-center gap-2.5 group">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs transition-transform group-hover:scale-105">
            <BookmarkCheck className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-base tracking-tight leading-none">
              Titirek
            </span>
            <span className="text-[11px] text-muted-foreground tracking-tight mt-0.5">
              Media Tracker
            </span>
          </div>
        </Link>
        <ThemeToggle />
      </div>

      {/* Main Nav Links */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        <div className="px-2 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                item.active
                  ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-current={item.active ? "page" : undefined}
            >
              <Icon className={cn("size-4.5", item.active ? "text-primary" : "text-muted-foreground")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* User Footer */}
      {user && (
        <div className="p-4 border-t bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/profile"
              className="flex items-center gap-3 min-w-0 flex-1 p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <Avatar size="sm" className="ring-1 ring-border">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || user.email} />}
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold truncate leading-tight">
                  {user.name || "User"}
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
                title="Sign out"
                aria-label="Sign out"
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
