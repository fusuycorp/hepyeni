import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield, ArrowLeft } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { getSession } from "@/lib/pocketbase/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  await requireAdmin(session.id);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Admin Top Navbar */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md px-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2 font-bold text-sm tracking-tight">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="size-4" />
              </div>
              <span>Yönetici Portalı</span>
            </Link>

            <nav className="flex items-center gap-1 text-xs font-medium">
              <Link
                href="/admin"
                className="px-2.5 py-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                Genel Bakış
              </Link>
              <Link
                href="/admin/users"
                className="px-2.5 py-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                Kullanıcılar
              </Link>
              <Link
                href="/admin/groups"
                className="px-2.5 py-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                Gruplar
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Link
              href="/groups"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8",
              })}
            >
              <ArrowLeft className="size-3.5" />
              <span>Uygulamaya Dön</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
