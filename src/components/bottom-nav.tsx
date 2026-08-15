"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rss, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/activity", label: "Activity", icon: Rss },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex w-full max-w-md items-stretch">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href === "/groups" && pathname.startsWith("/groups"));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
