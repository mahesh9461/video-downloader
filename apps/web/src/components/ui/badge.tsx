import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
        secondary: "border-transparent bg-zinc-800 text-zinc-200 border-zinc-700/80",
        destructive: "border-transparent bg-rose-500/20 text-rose-300 border-rose-500/40",
        outline: "border-zinc-700 text-zinc-200 bg-zinc-900/60",
        active: "border-emerald-500/40 bg-emerald-500/20 text-emerald-300 font-bold",
        success: "border-emerald-500/40 bg-emerald-500/20 text-emerald-300",
        warning: "border-amber-500/40 bg-amber-500/20 text-amber-300",
        youtube: "border-red-500/30 bg-red-500/15 text-red-300",
        tiktok: "border-cyan-500/30 bg-cyan-500/15 text-cyan-300",
        instagram: "border-pink-500/30 bg-pink-500/15 text-pink-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
