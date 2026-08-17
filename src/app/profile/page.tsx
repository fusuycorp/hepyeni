import Link from "next/link";
import { redirect } from "next/navigation";
import { User, KeyRound, AlertTriangle, Shield, LogOut, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { SendResetLinkButton } from "@/components/send-reset-link-button";
import { InlineTextForm } from "@/components/inline-text-form";
import { signOutAction } from "@/lib/actions/auth";
import { deleteAccount, updateProfileName } from "@/lib/actions/profile";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import { getInitials } from "@/lib/format";
import { getServerTranslations } from "@/lib/i18n/server";
import type { UsersResponse } from "@/types/pocketbase-types";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pb = await getSuperuserClient();
  const user = await pb.collection("users").getOne<UsersResponse>(session.id);
  const t = await getServerTranslations();

  const currentUser = {
    id: session.id,
    email: session.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isAdmin: session.isAdmin,
  };

  return (
    <AppShell user={currentUser} maxWidth="default" title={t.profile.title}>
      <div className="space-y-6">
        <div className="pb-4 border-b">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.profile.title}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t.profile.subtitle}
          </p>
        </div>

        {/* Profile Card Header */}
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <Avatar size="lg" className="size-16 ring-2 ring-primary/20 shrink-0">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || user.email} />}
              <AvatarFallback className="text-base font-bold">
                {getInitials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-lg font-bold text-foreground">
                  {user.name || t.common.unnamedUser}
                </h2>
                {user.isAdmin && (
                  <Badge variant="default" className="text-[10px] gap-1 py-0">
                    <Shield className="size-3" />
                    <span>{t.profile.adminBadge}</span>
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {user.email}
              </p>
            </div>

            <form action={signOutAction} className="shrink-0 pt-2 sm:pt-0">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30"
              >
                <LogOut className="size-3.5" />
                <span>{t.nav.signOut}</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Display Name Card */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <div>
                <CardTitle className="text-sm font-semibold">{t.profile.displayNameLabel}</CardTitle>
                <CardDescription className="text-xs">
                  {t.profile.displayNameDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <InlineTextForm
              defaultValue={user.name}
              onSubmit={updateProfileName}
              successMessage={t.profile.nameUpdated}
              errorMessage={t.profile.nameUpdateFailed}
            />
          </CardContent>
        </Card>

        {/* Password & Security Card */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <div>
                <CardTitle className="text-sm font-semibold">{t.profile.passwordSecurityTitle}</CardTitle>
                <CardDescription className="text-xs">
                  {t.profile.passwordSecurityDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              {t.profile.resetLinkWillSend.split("{email}")[0]}
              <span className="font-semibold text-foreground">{user.email}</span>
              {t.profile.resetLinkWillSend.split("{email}")[1]}
            </p>
            <SendResetLinkButton email={user.email} />
          </CardContent>
        </Card>

        {/* Legal & Policies */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <div>
                <CardTitle className="text-sm font-semibold">{t.profile.legalTitle}</CardTitle>
                <CardDescription className="text-xs">
                  {t.profile.legalDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4 text-xs font-medium pt-1">
            <Link
              href="/privacy"
              className="text-primary hover:underline underline-offset-4"
            >
              {t.common.privacy}
            </Link>
            <span className="text-muted-foreground">&middot;</span>
            <Link
              href="/terms"
              className="text-primary hover:underline underline-offset-4"
            >
              {t.common.terms}
            </Link>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              <div>
                <CardTitle className="text-sm font-semibold text-destructive">
                  {t.profile.deleteAccountTitle}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t.profile.deleteAccountCardDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground max-w-md">
              {t.profile.deleteAccountDesc}
            </p>
            <ConfirmActionButton
              triggerLabel={t.profile.deleteAccountButton}
              triggerVariant="destructive"
              variant="destructive"
              size="sm"
              title={t.profile.deleteConfirmModalTitle}
              description={t.profile.deleteConfirmModalDesc}
              confirmLabel={t.common.deletePermanently}
              pendingLabel={t.common.deleting}
              redirectTo="/login"
              onConfirm={deleteAccount}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
