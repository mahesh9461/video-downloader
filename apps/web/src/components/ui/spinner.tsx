import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function Spinner({ size = "md", label, className, ...props }: SpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 text-cyan-400", className)}
      {...props}
    >
      <Loader2 className={cn("animate-spin shrink-0", sizeClasses[size])} />
      {label && <span className="text-sm font-medium text-zinc-300">{label}</span>}
      <span className="sr-only">{label || "Loading..."}</span>
    </div>
  );
}
