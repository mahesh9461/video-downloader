import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-white text-zinc-950 hover:bg-zinc-200 shadow-sm",
        primary: "bg-cyan-500 text-zinc-950 font-bold hover:bg-cyan-400 shadow-md shadow-cyan-500/20 active:scale-[0.98]",
        destructive: "bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/20",
        danger: "bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/20",
        outline: "border border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800 hover:text-white hover:border-zinc-600",
        secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-750 hover:text-white border border-zinc-700/60 shadow-sm",
        ghost: "text-zinc-300 hover:bg-zinc-800/80 hover:text-white",
        link: "text-cyan-400 underline-offset-4 hover:underline",
        gradient: "bg-gradient-to-r from-cyan-500 via-violet-600 to-indigo-600 text-white hover:from-cyan-400 hover:via-violet-500 hover:to-indigo-500 shadow-lg shadow-cyan-500/20",
      },
      size: {
        default: "h-10 min-h-[44px] px-4 py-2",
        sm: "h-8 min-h-[36px] rounded-lg px-3 text-xs",
        lg: "h-12 min-h-[48px] rounded-xl px-6 text-base",
        icon: "h-10 w-10 min-h-[40px] min-w-[40px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
