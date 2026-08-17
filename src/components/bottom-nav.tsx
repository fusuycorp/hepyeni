"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, BookOpen, Rss, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations();

  const tabs = [
    { href: "/groups", label: t.nav.groups, icon: Users },
    { href: "/shelf", label: t.nav.shelf, icon: BookOpen },
    { href: "/activity", label: t.nav.activity, icon: Rss },
    { href: "/profile", label: t.nav.profile, icon: User },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/80"
      aria-label="Mobile Navigation"
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-around px-2 py-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href === "/groups" && pathname.startsWith("/groups") && !pathname.includes("/admin"));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-1.5 px-4 rounded-xl text-[11px] font-medium transition-all min-w-[64px]",
                active
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <span className="absolute -top-1 size-1 rounded-full bg-primary" />
              )}
              <Icon className={cn("size-5 transition-transform", active && "scale-110 text-primary")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
