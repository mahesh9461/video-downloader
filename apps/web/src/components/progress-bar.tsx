"use client";

import { Zap, HardDrive, Clock, CheckCircle2, XCircle, Merge, X, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DownloadProgress as DownloadProgressType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: DownloadProgressType;
  onCancel?: () => void;
  onReset?: () => void;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  downloading: { icon: Zap, label: "Downloading...", color: "text-cyan-400" },
  merging: { icon: Merge, label: "Merging video & audio...", color: "text-amber-400" },
  converting: { icon: HardDrive, label: "Converting format...", color: "text-violet-400" },
  complete: { icon: CheckCircle2, label: "Complete!", color: "text-emerald-400" },
  error: { icon: XCircle, label: "Failed", color: "text-rose-400" },
};

export function ProgressBar({ progress, onCancel, onReset }: ProgressBarProps) {
  const config = STATUS_CONFIG[progress.status] || STATUS_CONFIG.downloading;
  const Icon = config.icon;
  const isInFlight = ["downloading", "merging", "converting"].includes(progress.status);

  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 overflow-hidden border-white/10 bg-[#12151f]/95 shadow-xl">
      <CardContent className="p-5">
        <div className="space-y-3">
          {/* Status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                className={cn("w-4 h-4", config.color, progress.status === "downloading" && "animate-pulse")}
              />
              <span className={cn("text-sm font-bold", config.color)}>{config.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-bold text-white tabular-nums">
                {Math.round(progress.percent)}%
              </span>
              {isInFlight && onCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="h-7 px-2.5 text-xs text-zinc-300 hover:text-rose-400 hover:bg-rose-500/10 font-medium"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
              )}
              {progress.status === "complete" && onReset && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  className="h-7 px-2.5 text-xs text-zinc-300 hover:text-cyan-400 hover:bg-cyan-500/10 font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  New Download
                </Button>
              )}
            </div>
          </div>

          {/* Bar */}
          <Progress
            value={progress.percent}
            className={cn(
              "h-2.5 rounded-full bg-zinc-800",
              progress.status === "complete" && "[&>div]:bg-emerald-400",
              progress.status === "error" && "[&>div]:bg-rose-500",
              progress.status === "merging" && "[&>div]:bg-amber-400",
              progress.status === "converting" && "[&>div]:bg-violet-400",
              progress.status === "downloading" && "[&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-violet-500"
            )}
          />

          {/* Speed & ETA stats */}
          {progress.status === "downloading" && (progress.speed || progress.eta !== null) && (
            <div className="flex items-center justify-between text-xs text-zinc-300 font-mono pt-1">
              {progress.speed && <span>{progress.speed}</span>}
              {progress.eta !== null && progress.eta !== undefined && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  ETA: {progress.eta}
                </span>
              )}
            </div>
          )}

          {/* Error detail */}
          {progress.status === "error" && (progress.error_message || progress.error) && (
            <p className="text-xs text-rose-300 font-medium bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              {progress.error_message || progress.error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
