import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { SendResetLinkButton } from "@/components/send-reset-link-button";
import { UpdateNameForm } from "@/components/update-name-form";
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

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center gap-3">
        <Button
          render={<Link href="/groups" />}
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-muted-foreground"
        >
          &larr; Back
        </Button>
        <h1 className="text-lg font-semibold">Profile</h1>
      </header>

      <div className="flex items-center gap-3">
        <Avatar size="lg">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>
        <div className="text-left">
          <p className="font-medium">{user.name || "Unnamed"}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display name</CardTitle>
        </CardHeader>
        <CardContent>
          <UpdateNameForm
            defaultName={user.name}
            onUpdate={updateProfileName}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Send yourself a link to set a new password.
          </p>
          <SendResetLinkButton email={user.email} />
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Delete account
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account. You&apos;ll need to leave any
            groups you own first.
          </p>
          <ConfirmActionButton
            triggerLabel="Delete account"
            title="Delete your account?"
            description="This permanently deletes your account and removes you from every group. This can't be undone."
            confirmLabel="Delete"
            pendingLabel="Deleting…"
            onConfirm={deleteAccount}
          />
        </CardContent>
      </Card>
    </div>
  );
}
