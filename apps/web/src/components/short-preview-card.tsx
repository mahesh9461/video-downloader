"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreVertical,
  Music2,
  Play,
  Pause,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ShortPreviewCardProps {
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  title: string;
  channelName?: string;
  channelThumbnail?: string | null;
  hookTitle?: string;
  layout?: string;
  musicTrack?: string;
  className?: string;
  hookScore?: number | null;
  pacingScore?: number | null;
  audioEnergyScore?: number | null;
  visualMotionScore?: number | null;
  loopRating?: string | null;
  speakerTrackingApplied?: boolean;
}

export function ShortPreviewCard({
  thumbnailUrl,
  videoUrl,
  title,
  channelName = "Your Channel",
  channelThumbnail,
  hookTitle,
  layout = "center_crop",
  musicTrack = "Original Audio",
  className,
  hookScore,
  pacingScore,
  audioEnergyScore,
  visualMotionScore,
  loopRating,
  speakerTrackingApplied,
}: ShortPreviewCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div
      className={cn(
        "relative w-[280px] sm:w-[310px] aspect-[9/16] rounded-[36px] p-3 bg-zinc-950 border-[6px] border-zinc-800 shadow-2xl shadow-cyan-500/10 flex flex-col justify-between overflow-hidden select-none",
        className
      )}
      aria-label="Live 9:16 Short Preview"
    >
      {/* Top Phone Notch / Dynamic Island */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-4 bg-zinc-900 rounded-full z-30 flex items-center justify-center">
        <div className="w-2.5 h-2.5 rounded-full bg-zinc-950" />
      </div>

      {/* Background Frame / Media */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black overflow-hidden">
        {videoUrl ? (
          <video
            src={videoUrl}
            className="w-full h-full object-cover"
            playsInline
            loop
            muted
          />
        ) : thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title || "Short preview"}
            fill
            className={cn(
              "object-cover transition-all duration-300",
              layout === "blurred_background" ? "scale-105 blur-sm brightness-75" : "object-cover"
            )}
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2 p-6 text-center">
            <Sparkles className="w-10 h-10 text-cyan-500/40 animate-pulse" />
            <span className="text-xs text-zinc-400">9:16 Vertical Video Frame</span>
          </div>
        )}

        {/* Cinematic gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 pointer-events-none" />
      </div>

      {/* Top Banner (Hook Headline & Virality Badge) */}
      <div className="relative z-10 pt-6 px-1 text-center space-y-1.5">
        {hookTitle && (
          <div className="inline-block px-3 py-1.5 rounded-xl bg-amber-400 text-zinc-950 font-black text-xs sm:text-sm tracking-tight shadow-xl shadow-amber-400/20 uppercase transform -rotate-1 border border-amber-300">
            {hookTitle}
          </div>
        )}

        {/* Virality Engine Indicators */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
          {loopRating && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[9px] font-bold text-emerald-300 backdrop-blur-md">
              🔄 {loopRating}
            </span>
          )}
          {speakerTrackingApplied && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[9px] font-bold text-cyan-300 backdrop-blur-md">
              🎯 9:16 Speaker Tracked
            </span>
          )}
          {hookScore != null && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-950/70 border border-amber-500/30 text-[9px] font-medium text-amber-200 backdrop-blur-md">
              ⚡ {hookScore}% Hook
            </span>
          )}
        </div>
      </div>

      {/* Middle Interaction / Play Overlay */}
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          aria-label={isPlaying ? "Pause preview" : "Play preview"}
          className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/90 hover:scale-110 hover:bg-black/60 transition-all"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
      </div>

      {/* Bottom Area: Metadata & Right Side Actions */}
      <div className="relative z-10 flex items-end justify-between gap-3 pb-2">
        {/* Left: Channel Info, Title, Music */}
        <div className="flex-1 min-w-0 space-y-2 text-left">
          {/* Channel Avatar & Name */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-cyan-600 border border-white/30 overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-white">
              {channelThumbnail ? (
                <Image
                  src={channelThumbnail}
                  alt={channelName}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                channelName.substring(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white truncate block">
                @{channelName.replace(/\s+/g, "").toLowerCase()}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-red-600 text-[10px] font-bold text-white uppercase tracking-wider">
              Subscribe
            </span>
          </div>

          {/* Title */}
          <p className="text-xs text-white/95 line-clamp-2 font-medium leading-relaxed drop-shadow-sm">
            {title || "Enter a title for your Short..."}
          </p>

          {/* Sound / Music Wave */}
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-300 truncate">
            <Music2 className="w-3 h-3 text-cyan-400 shrink-0 animate-spin" />
            <span className="truncate">{musicTrack}</span>
          </div>
        </div>

        {/* Right Side: Shorts Action Bar */}
        <div className="flex flex-col items-center gap-3.5 shrink-0 text-white pb-1">
          <div className="flex flex-col items-center gap-1">
            <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              <Heart className="w-4 h-4 fill-white/80" />
            </div>
            <span className="text-[10px] font-bold">42.5K</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold">1.2K</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold">Share</span>
          </div>

          <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center">
            <MoreVertical className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
