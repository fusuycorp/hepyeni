"use client";

import { useState } from "react";
import { Copy, Check, Quote, Tag, Users, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MediaBadge } from "@/components/media-badge";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { useTranslations } from "@/lib/i18n/client";
import { canUserDeleteQuote } from "@/lib/marginalia";
import type {
  ShelfQuotesResponse,
  UserMediaProgressResponse,
  UsersResponse,
} from "@/types/pocketbase-types";
import type { ActionResult } from "@/types/actions";

interface QuoteCardProps {
  quote: ShelfQuotesResponse<{
    user?: UsersResponse;
    progressItem?: UserMediaProgressResponse;
  }>;
  currentUserId?: string;
  isAdmin?: boolean;
  onDelete?: (quoteId: string) => Promise<ActionResult<void> | void>;
}

export function QuoteCard({
  quote,
  currentUserId,
  isAdmin,
  onDelete,
}: QuoteCardProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const isOwnerOrAdmin = canUserDeleteQuote(
    quote,
    currentUserId ? { id: currentUserId, isAdmin } : null,
  );

  const isShared =
    Array.isArray(quote.isSharedWithCircles) && quote.isSharedWithCircles.length > 0;

  const handleCopy = async () => {
    const formatted = `"${quote.quoteText}"\n— ${quote.titleName}${
      quote.attribution ? ` (${quote.attribution})` : ""
    }`;

    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      toast.success(t.marginalia.copySuccess);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t.marginalia.copyError);
    }
  };

  return (
    <Card className="relative overflow-hidden border-border/70 shadow-2xs hover:border-border transition-all bg-card/90 flex flex-col justify-between group">
      {/* Editorial Decorative Background Quote Glyph */}
      <div className="absolute top-2 right-3 text-muted/30 select-none pointer-events-none -z-0">
        <Quote className="size-16 rotate-180 opacity-40 text-primary/15" />
      </div>

      <CardContent className="p-5 space-y-4 relative z-10 flex flex-col justify-between flex-1">
        {/* Header: Media Type & Privacy status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {quote.mediaType ? (
              <MediaBadge type={quote.mediaType} size="sm" />
            ) : (
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                <Quote className="size-2.5 mr-1" />
                {quote.titleName}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isShared ? (
              <Badge
                variant="secondary"
                className="text-[10px] gap-1 py-0 px-2 font-medium bg-primary/10 text-primary border-primary/20"
                title={t.marginalia.shareWithCircles}
              >
                <Users className="size-2.5" />
                <span>{quote.isSharedWithCircles?.length || 1}</span>
              </Badge>
            ) : (
              <span
                title={t.marginalia.privateToShelf}
                className="text-muted-foreground/50 text-xs flex items-center gap-1"
              >
                <EyeOff className="size-3" />
              </span>
            )}
          </div>
        </div>

        {/* Serif Quote Passage */}
        <blockquote className="space-y-1">
          <p className="font-serif text-base text-foreground/90 italic leading-relaxed tracking-normal font-normal">
            &ldquo;{quote.quoteText}&rdquo;
          </p>
        </blockquote>

        {/* Footer: Title, Attribution, Tags, Actions */}
        <div className="space-y-3 pt-2 border-t border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {quote.titleName}
              </p>
              {quote.attribution && (
                <p className="text-[11px] text-muted-foreground font-mono truncate">
                  {quote.attribution}
                </p>
              )}
            </div>

            {quote.expand?.user?.name && quote.user !== currentUserId && (
              <p className="text-[11px] text-muted-foreground shrink-0">
                @{quote.expand.user.name}
              </p>
            )}
          </div>

          {/* Tags */}
          {Array.isArray(quote.tags) && quote.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {quote.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground/80 bg-muted/30 border-border/50"
                >
                  <Tag className="size-2.5 mr-1 opacity-70" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={handleCopy}
                title={t.marginalia.copyQuote}
              >
                {copied ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <Copy className="size-3" />
                )}
                <span>{t.marginalia.copyQuote}</span>
              </Button>
            </div>

            {isOwnerOrAdmin && onDelete && (
              <ConfirmActionButton
                triggerLabel={t.marginalia.deleteQuote}
                title={t.marginalia.deleteQuote}
                description={t.marginalia.deleteConfirm}
                variant="destructive"
                triggerVariant="ghost"
                size="xs"
                onConfirm={() => onDelete(quote.id)}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
