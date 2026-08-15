"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, KeyRound, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function CreateGroupCard({
  onCreate,
}: {
  onCreate: (formData: FormData) => Promise<string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        const groupId = await onCreate(formData);
        toast.success("Group created successfully!");
        router.push(`/groups/${groupId}`);
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't create the group."));
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
            <CardTitle className="text-sm font-semibold">Create a Group</CardTitle>
            <CardDescription className="text-xs">
              Start a new circle for books, movies, music, or podcasts.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            name="name"
            placeholder="e.g. Friday Film Club, Sci-Fi Book Circle"
            required
            className="text-xs"
            disabled={isPending}
          />
          <Button type="submit" size="sm" disabled={isPending} className="shrink-0">
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Creating…</span>
              </>
            ) : (
              <>
                <span>Create</span>
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
  onJoin: (formData: FormData) => Promise<string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        const groupId = await onJoin(formData);
        toast.success("Joined group!");
        router.push(`/groups/${groupId}`);
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't join that group. Check the invite code."));
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
            <CardTitle className="text-sm font-semibold">Join with Code</CardTitle>
            <CardDescription className="text-xs">
              Enter an 8-character invite code to join an existing circle.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            name="code"
            placeholder="e.g. A1B2C3D4"
            required
            maxLength={12}
            className="uppercase font-mono text-xs tracking-wider"
            disabled={isPending}
          />
          <Button type="submit" variant="secondary" size="sm" disabled={isPending} className="shrink-0">
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Joining…</span>
              </>
            ) : (
              <>
                <span>Join</span>
                <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
