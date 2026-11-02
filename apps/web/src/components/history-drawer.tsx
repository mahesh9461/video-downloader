"use client";

import Image from "next/image";
import { Trash2, Clock, HardDrive, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HistoryItem } from "@/lib/types";
import { formatFileSize, formatTimestamp } from "@/lib/utils";

interface HistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: HistoryItem[];
  onClear: () => void;
  onRemove: (id: string) => void;
}

export function HistoryDrawer({
  open,
  onOpenChange,
  history,
  onClear,
  onRemove,
}: HistoryDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-400" />
            Download History
          </SheetTitle>
          <SheetDescription>
            {history.length === 0
              ? "No downloads yet. Start by pasting a video URL."
              : `${history.length} download${history.length === 1 ? "" : "s"} recorded`}
          </SheetDescription>
        </SheetHeader>

        {history.length > 0 && (
          <div className="mt-4 mb-6">
            <Button variant="ghost" size="sm" onClick={onClear} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
              <Trash2 className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          </div>
        )}

        <div className="space-y-1">
          {history.map((item) => (
            <div
              key={item.id}
              className="group flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 line-clamp-1">{item.title}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                  <Badge
                    variant={item.platform === "youtube" ? "youtube" : "tiktok"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {item.platform === "youtube" ? "YT" : "TT"}
                  </Badge>
                  <span>{item.format}</span>
                  {item.filesize && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <HardDrive className="w-2.5 h-2.5" />
                        {formatFileSize(item.filesize)}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {formatTimestamp(item.timestamp)}
                </p>
              </div>

              {/* Remove */}
              <button
                onClick={() => onRemove(item.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

