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
  mode = "code",
  className,
}: {
  code: string;
  variant?: "pill" | "icon" | "button";
  mode?: "code" | "link";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations();

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const textToCopy =
      mode === "link"
        ? typeof window !== "undefined"
          ? `${window.location.origin}/invite/${code}`
          : `/invite/${code}`
        : code;

    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      toast.error(t.common.error);
      return;
    }
    setCopied(true);
    if (mode === "link") {
      toast.success(t.invite.linkCopied);
    } else {
      toast.success(`${t.common.copied} ${code}`);
    }
    setTimeout(() => setCopied(false), 2000);
  }


  const label = mode === "link" ? t.invite.copyLink : t.groups.copyInviteCode;

  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn("size-6 text-muted-foreground hover:text-foreground", className)}
        onClick={copy}
        title={label}
        aria-label={label}
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
            <span>
              {mode === "link"
                ? t.invite.copyLink
                : `${t.groups.codeLabel}: ${code}`}
            </span>
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
