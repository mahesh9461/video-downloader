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
  downloading: { icon: Zap, label: "Downloading...", color: "text-violet-400" },
  merging: { icon: Merge, label: "Merging video & audio...", color: "text-amber-400" },
  converting: { icon: HardDrive, label: "Converting format...", color: "text-blue-400" },
  complete: { icon: CheckCircle2, label: "Complete!", color: "text-emerald-400" },
  error: { icon: XCircle, label: "Failed", color: "text-red-400" },
};

export function ProgressBar({ progress, onCancel, onReset }: ProgressBarProps) {
  const config = STATUS_CONFIG[progress.status] || STATUS_CONFIG.downloading;
  const Icon = config.icon;
  const isInFlight = ["downloading", "merging", "converting"].includes(progress.status);

  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 overflow-hidden">
      <CardContent className="p-5">
        <div className="space-y-3">
          {/* Status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                className={cn("w-4 h-4", config.color, progress.status === "downloading" && "animate-pulse")}
              />
              <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
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
                  className="h-6 px-2 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
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
                  className="h-6 px-2 text-xs text-zinc-400 hover:text-violet-300 hover:bg-violet-500/10"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Done
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <Progress
            value={progress.percent}
            className={cn(
              "h-2.5",
              progress.status === "complete" && "[&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-green-400",
              progress.status === "error" && "[&>div]:bg-red-500"
            )}
          />

          {/* Stats row */}
          {progress.status === "downloading" && (
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              {progress.speed && (
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {progress.speed}
                </span>
              )}
              {progress.eta && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ETA: {progress.eta}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
