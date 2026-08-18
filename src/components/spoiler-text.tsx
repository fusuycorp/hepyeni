"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useFeatureFlag } from "@/lib/flags/client";
import { useTranslations } from "@/lib/i18n/client";

export interface SpoilerToken {
  type: "text" | "spoiler";
  content: string;
}

export function parseSpoilerTokens(text: string): SpoilerToken[] {
  if (!text) return [];

  const SPOILER_REGEX = /(\|\|[\s\S]*?\|\|)/g;
  const parts = text.split(SPOILER_REGEX);
  const tokens: SpoilerToken[] = [];

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith("||") && part.endsWith("||") && part.length >= 4) {
      tokens.push({
        type: "spoiler",
        content: part.slice(2, -2),
      });
    } else {
      tokens.push({
        type: "text",
        content: part,
      });
    }
  }

  return tokens;
}

export function hasSpoilerTokens(text: string): boolean {
  if (!text) return false;
  return /\|\|[\s\S]+?\|\|/.test(text);
}

interface SpoilerSpanProps {
  children: string;
  className?: string;
}

export function SpoilerSpan({ children, className }: SpoilerSpanProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const isFlagEnabled = useFeatureFlag("spoiler_blur");
  const t = useTranslations();

  if (!isFlagEnabled) {
    return <span className={className}>{children}</span>;
  }

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setIsRevealed((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle(e);
    }
  };

  if (!isRevealed) {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-expanded={false}
        aria-label={t.spoilers?.reveal || "Click to reveal spoiler"}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-block rounded px-1 py-0.2 select-none cursor-pointer transition-all duration-200",
          "bg-muted/80 text-foreground/80 hover:bg-muted font-sans",
          className,
        )}
        style={{
          filter: "blur(5px)",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-expanded={true}
      aria-label={t.spoilers?.hide || "Click to hide spoiler"}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-block rounded px-1 py-0.2 select-text cursor-pointer transition-all duration-200",
        "bg-primary/10 border-b border-primary/40 text-foreground font-sans",
        className,
      )}
      style={{
        filter: "none",
      }}
    >
      {children}
    </span>
  );
}

export interface SpoilerTextProps {
  text?: string | null;
  children?: React.ReactNode;
  className?: string;
}

export function SpoilerText({ text, children, className }: SpoilerTextProps) {
  const content = typeof text === "string" ? text : typeof children === "string" ? children : null;

  if (content === null) {
    return <>{children}</>;
  }

  const tokens = parseSpoilerTokens(content);

  return (
    <span className={className}>
      {tokens.map((token, idx) => {
        if (token.type === "spoiler") {
          return <SpoilerSpan key={idx}>{token.content}</SpoilerSpan>;
        }
        return <React.Fragment key={idx}>{token.content}</React.Fragment>;
      })}
    </span>
  );
}
