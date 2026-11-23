"use client";

import Image from "next/image";
import { User, Clock, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoMetadata } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface VideoPreviewProps {
  metadata: VideoMetadata | null;
  isLoading: boolean;
}

export function VideoPreview({ metadata, isLoading }: VideoPreviewProps) {
  if (isLoading) {
    return (
      <Card className="overflow-hidden animate-in fade-in-0 duration-300 border-white/10 bg-[#12151f]/80 shadow-xl">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            <Skeleton className="w-full sm:w-72 h-44 rounded-none bg-zinc-800/80" />
            <div className="flex-1 p-5 space-y-3">
              <Skeleton className="h-6 w-3/4 bg-zinc-800/80" />
              <Skeleton className="h-4 w-1/2 bg-zinc-800/80" />
              <div className="flex gap-2 mt-4">
                <Skeleton className="h-6 w-20 rounded-full bg-zinc-800/80" />
                <Skeleton className="h-6 w-24 rounded-full bg-zinc-800/80" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metadata) return null;

  return (
    <Card className="overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-300 border-white/10 bg-[#12151f]/90 shadow-xl">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Thumbnail */}
          <div className="relative w-full sm:w-72 h-44 shrink-0 bg-zinc-900 overflow-hidden">
            <Image
              src={metadata.thumbnail}
              alt={metadata.title}
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute bottom-2 right-2 bg-black/90 backdrop-blur-md text-white text-xs font-mono font-bold px-2 py-0.5 rounded-md border border-white/10">
              {formatDuration(metadata.duration)}
            </div>
            <Badge
              variant={metadata.platform === "youtube" ? "youtube" : metadata.platform === "instagram" ? "instagram" : "tiktok"}
              className="absolute top-2 left-2"
            >
              {metadata.platform === "youtube" ? "YouTube" : metadata.platform === "instagram" ? "Instagram" : "TikTok"}
            </Badge>
          </div>

          {/* Details */}
          <div className="flex-1 p-5 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h3 className="font-bold text-white text-base sm:text-lg line-clamp-2 leading-snug tracking-tight">
                {metadata.title}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium">
                <User className="w-3.5 h-3.5 text-zinc-400" />
                <span>{metadata.creator}</span>
              </div>
            </div>

            {/* Quick Stats Chips */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-white/5">
              <span className="flex items-center gap-1 text-xs text-zinc-300 font-medium bg-zinc-900/80 border border-zinc-800 rounded-full px-2.5 py-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                {formatDuration(metadata.duration)}
              </span>
              {metadata.view_count && (
                <span className="flex items-center gap-1 text-xs text-zinc-300 font-medium bg-zinc-900/80 border border-zinc-800 rounded-full px-2.5 py-1">
                  <Eye className="w-3 h-3 text-cyan-400" />
                  {metadata.view_count > 1000000
                    ? `${(metadata.view_count / 1000000).toFixed(1)}M views`
                    : `${(metadata.view_count / 1000).toFixed(0)}K views`}
                </span>
              )}
              <span className="text-xs text-zinc-300 font-medium bg-zinc-900/80 border border-zinc-800 rounded-full px-2.5 py-1">
                {metadata.formats.length} formats available
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
