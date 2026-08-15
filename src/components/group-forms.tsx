"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const groupId = await onCreate(formData);
        router.push(`/groups/${groupId}`);
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't create the group."));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create a group</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input name="name" placeholder="Group name" required />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create"}
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
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const groupId = await onJoin(formData);
        router.push(`/groups/${groupId}`);
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't join that group."));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Join a group</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input name="code" placeholder="Invite code" required className="uppercase" />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Joining…" : "Join"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
