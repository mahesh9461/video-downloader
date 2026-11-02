"use client";

import Image from "next/image";
import { User, Clock } from "lucide-react";
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
      <Card className="overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            <Skeleton className="w-full sm:w-72 h-44 rounded-none" />
            <div className="flex-1 p-5 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2 mt-4">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metadata) return null;

  return (
    <Card className="overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Thumbnail */}
          <div className="relative w-full sm:w-72 h-44 shrink-0 bg-zinc-800 overflow-hidden">
            <Image
              src={metadata.thumbnail}
              alt={metadata.title}
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded-md">
              {formatDuration(metadata.duration)}
            </div>
            <Badge
              variant={metadata.platform === "youtube" ? "youtube" : "tiktok"}
              className="absolute top-2 left-2"
            >
              {metadata.platform === "youtube" ? "YouTube" : "TikTok"}
            </Badge>
          </div>

          {/* Info */}
          <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
            <div>
              <h3 className="font-semibold text-white text-base leading-snug line-clamp-2">
                {metadata.title}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                {metadata.creator_avatar ? (
                  <Image
                    src={metadata.creator_avatar}
                    alt={metadata.creator}
                    width={24}
                    height={24}
                    className="rounded-full"
                    unoptimized
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
                    <User className="w-3 h-3 text-zinc-400" />
                  </div>
                )}
                <span className="text-sm text-zinc-400 truncate">{metadata.creator}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(metadata.duration)}
              </span>
              <span>•</span>
              <span>{metadata.formats.length} formats available</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

