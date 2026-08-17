"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, KeyRound, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/client";
import type { ActionResult } from "@/types/actions";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function CreateGroupCard({
  onCreate,
}: {
  onCreate: (formData: FormData) => Promise<string | ActionResult<{ groupId: string }>>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        const res = await onCreate(formData);
        if (typeof res === "object" && res !== null && "success" in res) {
          if (!res.success) {
            toast.error(res.error || t.groups.createError, {
              description: res.traceId ? `Ref: ${res.traceId}` : undefined,
            });
            return;
          }
          toast.success(t.groups.createSuccess);
          router.push(`/groups/${res.data.groupId}`);
          return;
        }
        toast.success(t.groups.createSuccess);
        router.push(`/groups/${res}`);
      } catch (err) {
        toast.error(errorMessage(err, t.groups.createError));
      }
    });
  }

  return (
    <Card className="border-border/70 shadow-xs hover:border-border transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Plus className="size-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{t.groups.createCircle}</CardTitle>
            <CardDescription className="text-xs">
              {t.groups.createCircleDesc}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            name="name"
            placeholder={t.groups.circleNamePlaceholder}
            required
            className="text-xs"
            disabled={isPending}
          />
          <Button type="submit" size="sm" disabled={isPending} className="shrink-0">
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>{t.groups.creating}</span>
              </>
            ) : (
              <>
                <span>{t.groups.createButton}</span>
                <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function JoinGroupCard({
  onJoin,
}: {
  onJoin: (formData: FormData) => Promise<string | ActionResult<{ groupId: string }>>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        const res = await onJoin(formData);
        if (typeof res === "object" && res !== null && "success" in res) {
          if (!res.success) {
            toast.error(res.error || t.groups.joinError, {
              description: res.traceId ? `Ref: ${res.traceId}` : undefined,
            });
            return;
          }
          toast.success(t.groups.joinSuccess);
          router.push(`/groups/${res.data.groupId}`);
          return;
        }
        toast.success(t.groups.joinSuccess);
        router.push(`/groups/${res}`);
      } catch (err) {
        toast.error(errorMessage(err, t.groups.joinError));
      }
    });
  }

  return (
    <Card className="border-border/70 shadow-xs hover:border-border transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <KeyRound className="size-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{t.groups.joinCircle}</CardTitle>
            <CardDescription className="text-xs">
              {t.groups.joinCircleDesc}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            name="code"
            placeholder={t.groups.inviteCodePlaceholder}
            required
            maxLength={12}
            className="uppercase font-mono text-xs tracking-wider"
            disabled={isPending}
          />
          <Button type="submit" variant="secondary" size="sm" disabled={isPending} className="shrink-0">
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>{t.groups.joining}</span>
              </>
            ) : (
              <>
                <span>{t.groups.joinButton}</span>
                <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
