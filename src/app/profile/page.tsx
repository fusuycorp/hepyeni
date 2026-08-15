import { redirect } from "next/navigation";
import { User, KeyRound, AlertTriangle, Shield, LogOut } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { SendResetLinkButton } from "@/components/send-reset-link-button";
import { UpdateNameForm } from "@/components/update-name-form";
import { signOutAction } from "@/lib/actions/auth";
import { deleteAccount, updateProfileName } from "@/lib/actions/profile";
import { getSession } from "@/lib/pocketbase/session";
import { getSuperuserClient } from "@/lib/pocketbase/superuser";
import type { UsersResponse } from "@/types/pocketbase-types";

function initials(name: string, email: string) {
  const source = name.trim() || email;
  return source.slice(0, 2).toUpperCase();
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pb = await getSuperuserClient();
  const user = await pb.collection("users").getOne<UsersResponse>(session.id);

  const currentUser = {
    id: session.id,
    email: session.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isAdmin: session.isAdmin,
  };

  return (
    <AppShell user={currentUser} maxWidth="default" title="Account Profile">
      <div className="space-y-6">
        <div className="pb-4 border-b">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Your Profile
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your personal credentials, display name, and preferences.
          </p>
        </div>

        {/* Profile Card Header */}
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <Avatar size="lg" className="size-16 ring-2 ring-primary/20 shrink-0">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || user.email} />}
              <AvatarFallback className="text-base font-bold">
                {initials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-lg font-bold text-foreground">
                  {user.name || "Unnamed User"}
                </h2>
                {user.isAdmin && (
                  <Badge variant="default" className="text-[10px] gap-1 py-0">
                    <Shield className="size-3" />
                    <span>Administrator</span>
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
                <span>Sign out</span>
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
                <CardTitle className="text-sm font-semibold">Display Name</CardTitle>
                <CardDescription className="text-xs">
                  This is the name visible to fellow group members when proposing or reviewing media.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <UpdateNameForm
              defaultName={user.name}
              onUpdate={updateProfileName}
            />
          </CardContent>
        </Card>

        {/* Password & Security Card */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <div>
                <CardTitle className="text-sm font-semibold">Password & Authentication</CardTitle>
                <CardDescription className="text-xs">
                  Need to change or set your account password? Request a secure reset email.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              A secure link will be sent to <span className="font-semibold text-foreground">{user.email}</span>.
            </p>
            <SendResetLinkButton email={user.email} />
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              <div>
                <CardTitle className="text-sm font-semibold text-destructive">
                  Delete Account
                </CardTitle>
                <CardDescription className="text-xs">
                  Permanently delete your user account and all personal activity.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground max-w-md">
              Permanently deletes your profile, votes, and reviews. You must transfer or leave any circles you own before deleting.
            </p>
            <ConfirmActionButton
              triggerLabel="Delete Account"
              triggerVariant="destructive"
              variant="destructive"
              size="sm"
              title="Delete your account?"
              description="This permanently deletes your account and removes you from every circle. This action is irreversible."
              confirmLabel="Permanently Delete"
              pendingLabel="Deleting…"
              redirectTo="/login"
              onConfirm={deleteAccount}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
