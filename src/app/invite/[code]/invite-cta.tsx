"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2, LogIn, UserPlus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/client";
import {
  joinGroupByCodeAction,
  setPendingInviteAction,
} from "@/lib/actions/groups";

export function InviteCTA({
  code,
  groupId,
  isLoggedIn,
  isMember,
}: {
  code: string;
  groupId: string;
  isLoggedIn: boolean;
  isMember: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations();

  async function handleDirectJoin() {
    try {
      setLoading(true);
      const joinedId = await joinGroupByCodeAction(code);
      toast.success(t.groups.joinSuccess);
      router.push(`/groups/${joinedId}`);
    } catch {
      toast.error(t.groups.joinError);
      setLoading(false);
    }
  }

  async function handleAuthRedirect() {
    try {
      setLoading(true);
      await setPendingInviteAction(code);
      router.push("/login");
    } catch {
      router.push("/login");
    }
  }

  if (isLoggedIn && isMember) {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
          <Check className="size-3.5" />
          <span>{t.invite.alreadyMember}</span>
        </div>
        <Link
          href={`/groups/${groupId}`}
          className={buttonVariants({ variant: "default", size: "default" })}
        >
          <span>{t.invite.goToCircle}</span>
          <ArrowRight className="size-4 ml-1.5" />
        </Link>
      </div>
    );
  }

  if (isLoggedIn && !isMember) {
    return (
      <div className="flex justify-center w-full">
        <Button
          size="lg"
          onClick={handleDirectJoin}
          disabled={loading}
          className="font-semibold shadow-md px-8"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              <span>{t.invite.joining}</span>
            </>
          ) : (
            <>
              <UserPlus className="size-4 mr-2" />
              <span>{t.invite.joinCircle}</span>
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
      <Button
        size="lg"
        onClick={handleAuthRedirect}
        disabled={loading}
        className="w-full sm:w-auto font-semibold shadow-md px-6"
      >
        {loading ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <LogIn className="size-4 mr-2" />
        )}
        <span>{t.invite.loginToJoin}</span>
      </Button>
      <Button
        size="lg"
        variant="outline"
        onClick={handleAuthRedirect}
        disabled={loading}
        className="w-full sm:w-auto font-medium px-6"
      >
        <UserPlus className="size-4 mr-2 text-muted-foreground" />
        <span>{t.invite.registerToJoin}</span>
      </Button>
    </div>
  );
}
