"use client";

import { useState, useRef, useCallback } from "react";
import { Search, Clipboard, Loader2, X, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { detectPlatform, isValidUrl } from "@/lib/validators";
import { cn } from "@/lib/utils";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function UrlInput({ onSubmit, isLoading, disabled }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const platform = detectPlatform(url);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (isValidUrl(url) && !isLoading && !disabled) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("saveit_last_url", url.trim());
          } catch {}
        }
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
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("saveit_last_url", text.trim());
          } catch {}
        }
        onSubmit(text.trim());
      }
    } catch {
      // Clipboard access denied or not allowed
    }
  }, [onSubmit]);

  const handleClear = useCallback(() => {
    setUrl("");
    inputRef.current?.focus();
  }, []);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={cn(
          "relative flex items-center gap-2 p-2 rounded-2xl border transition-all duration-300",
          isFocused
            ? "border-cyan-500/60 bg-[#12151f] shadow-lg shadow-cyan-500/10 ring-2 ring-cyan-500/30"
            : "border-white/10 bg-[#10121a]/90 hover:border-zinc-700",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        <div className="flex items-center pl-3">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-zinc-400" />
          )}
        </div>

        <Input
          ref={inputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Paste a YouTube or TikTok URL..."
          aria-label="Paste video URL"
          className="border-0 bg-transparent focus-visible:ring-0 h-12 text-base placeholder:text-zinc-400 text-white font-medium"
          disabled={isLoading || disabled}
          autoComplete="off"
          spellCheck={false}
        />

        <div className="flex items-center gap-2 pr-1">
          {platform && (
            <Badge
              variant={
                platform === "youtube"
                  ? "youtube"
                  : platform === "instagram"
                  ? "instagram"
                  : "tiktok"
              }
              className="hidden sm:inline-flex"
            >
              {platform === "youtube" ? "YouTube" : platform === "instagram" ? "Instagram" : "TikTok"}
            </Badge>
          )}

          {url && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClear}
              aria-label="Clear video URL input"
              className="h-9 w-9 text-zinc-400 hover:text-white"
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
            aria-label="Paste from clipboard"
            className="text-zinc-300 hover:text-white gap-1.5 min-h-[40px]"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-semibold">Paste</span>
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="icon"
            disabled={!isValidUrl(url) || isLoading}
            aria-label="Submit video URL to download"
            className="h-10 w-10 rounded-xl bg-cyan-500 text-zinc-950 font-bold hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-zinc-400 mt-2 text-center font-medium">
        Supports high-speed 4K & 1080p downloads, TikTok watermark removal, and MP3 audio.
      </p>
    </form>
  );
}
