import React from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  secondaryAction?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-white/5 bg-[#12151f]/60 backdrop-blur-sm max-w-md mx-auto space-y-4",
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
        {icon}
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
        <p className="text-sm text-zinc-300 leading-relaxed max-w-xs mx-auto">
          {description}
        </p>
      </div>
      {(actionLabel || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full justify-center">
          {actionLabel && onAction && (
            <Button
              type="button"
              variant="primary"
              onClick={onAction}
              className="w-full sm:w-auto"
            >
              {actionLabel}
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
