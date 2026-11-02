"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Clipboard, Loader2, X, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { detectPlatform, isValidUrl } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { Platform } from "@/lib/types";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function UrlInput({ onSubmit, isLoading, disabled }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const detected = detectPlatform(url);
    setPlatform(detected);
  }, [url]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (isValidUrl(url) && !isLoading && !disabled) {
        onSubmit(url.trim());
      }
    },
    [url, isLoading, disabled, onSubmit]
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      if (isValidUrl(text)) {
        onSubmit(text.trim());
      }
    } catch {
      // Clipboard access denied
    }
  }, [onSubmit]);

  const handleClear = useCallback(() => {
    setUrl("");
    setPlatform(null);
    inputRef.current?.focus();
  }, []);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={cn(
          "relative flex items-center gap-2 p-2 rounded-2xl border transition-all duration-300",
          isFocused
            ? "border-violet-500/50 bg-zinc-900/80 shadow-lg shadow-violet-500/5 ring-1 ring-violet-500/20"
            : "border-zinc-800 bg-zinc-900/50",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        <div className="flex items-center pl-3">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-zinc-500" />
          )}
        </div>

        <Input
          ref={inputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Paste a YouTube or TikTok URL..."
          className="border-0 bg-transparent focus-visible:ring-0 h-12 text-base placeholder:text-zinc-600"
          disabled={isLoading || disabled}
          autoComplete="off"
          spellCheck={false}
        />

        <div className="flex items-center gap-2 pr-1">
          {platform && (
            <Badge variant={platform === "youtube" ? "youtube" : "tiktok"}>
              {platform === "youtube" ? "YouTube" : "TikTok"}
            </Badge>
          )}

          {url && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="h-8 w-8 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePaste}
            disabled={isLoading}
            className="text-zinc-400 hover:text-white gap-1.5"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Paste</span>
          </Button>

          <Button
            type="submit"
            variant="gradient"
            size="icon"
            disabled={!isValidUrl(url) || isLoading}
            className="h-10 w-10 rounded-xl"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-zinc-600 mt-2 text-center">
        Supports YouTube videos, Shorts, and TikTok videos
      </p>
    </form>
  );
}

