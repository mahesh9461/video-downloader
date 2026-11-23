"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Trash2, Clock, HardDrive } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-[#10121a] border-l border-white/10 text-white">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2 text-white font-bold">
              <Clock className="w-4 h-4 text-cyan-400" />
              Download History
            </SheetTitle>
            <SheetDescription className="text-zinc-300 text-xs">
              {history.length === 0
                ? "No downloads yet. Start by pasting a video URL."
                : `${history.length} download${history.length === 1 ? "" : "s"} recorded`}
            </SheetDescription>
          </SheetHeader>

          {history.length > 0 && (
            <div className="mt-3 mb-4 flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-xs font-semibold text-zinc-400">Past Downloads</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-8"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Clear All
              </Button>
            </div>
          )}

          <div className="space-y-2 mt-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="group flex items-start gap-3 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:bg-zinc-800/60 transition-all"
              >
                {/* Thumbnail */}
                <div className="relative w-16 h-11 rounded-lg overflow-hidden bg-zinc-800 shrink-0 border border-white/10">
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
                  <p className="text-sm font-semibold text-white line-clamp-1">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-zinc-300">
                    <Badge
                      variant={item.platform === "youtube" ? "youtube" : item.platform === "instagram" ? "instagram" : "tiktok"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {item.platform === "youtube" ? "YT" : item.platform === "instagram" ? "IG" : "TT"}
                    </Badge>
                    <span className="font-medium">{item.format}</span>
                    {item.filesize && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 font-mono text-zinc-400">
                          <HardDrive className="w-2.5 h-2.5" />
                          {formatFileSize(item.filesize)}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {formatTimestamp(item.timestamp)}
                  </p>
                </div>

                {/* Remove item button (visible on hover or mobile tap) */}
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${item.title} from history`}
                  className="sm:opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-400 p-2 rounded-lg hover:bg-white/5 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={onClear}
        title="Clear All History?"
        description="This will remove your entire local download history. Downloaded files on your disk will not be deleted."
        confirmLabel="Clear All"
        isDestructive={true}
      />
    </>
  );
}
