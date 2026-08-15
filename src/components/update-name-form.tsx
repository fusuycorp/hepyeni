"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UpdateNameForm({
  defaultName,
  onUpdate,
}: {
  defaultName: string;
  onUpdate: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await onUpdate(formData);
        toast.success("Name updated.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update your name.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input name="name" defaultValue={defaultName} required maxLength={200} />
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
