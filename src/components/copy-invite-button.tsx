"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";

export function CopyInviteButton({
  code,
  variant = "pill",
  className,
}: {
  code: string;
  variant?: "pill" | "icon" | "button";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations();

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      toast.error(t.common.error);
      return;
    }
    setCopied(true);
    toast.success(`${t.common.copied} ${code}`);
    setTimeout(() => setCopied(false), 2000);
  }

  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn("size-6 text-muted-foreground hover:text-foreground", className)}
        onClick={copy}
        title={t.groups.copyInviteCode}
        aria-label={t.groups.copyInviteCode}
      >
        {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
      </Button>
    );
  }

  if (variant === "button") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-1.5 font-mono text-xs", className)}
        onClick={copy}
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-emerald-500" />
            <span>{t.common.copied}</span>
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            <span>{t.groups.codeLabel}: {code}</span>
          </>
        )}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] font-medium transition-colors select-none",
        "bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60",
        className
      )}
      title={t.groups.copyInviteCode}
    >
      <span>{code}</span>
      {copied ? (
        <Check className="size-3 text-emerald-500" />
      ) : (
        <Copy className="size-3 opacity-60" />
      )}
    </button>
  );
}
