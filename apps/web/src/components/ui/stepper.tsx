"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepItem {
  id: number;
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
  className?: string;
}

export function Stepper({ steps, currentStep, onStepClick, className }: StepperProps) {
  return (
    <nav aria-label="Progress Stepper" className={cn("w-full max-w-3xl mx-auto mb-8", className)}>
      <ol className="flex items-center justify-between relative">
        {/* Background connector line */}
        <div className="absolute top-1/2 -translate-y-1/2 left-6 right-6 h-0.5 bg-zinc-800 -z-10" />

        {steps.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          const isClickable = onStepClick && (isCompleted || isActive);

          return (
            <li key={step.id} className="flex-1 flex flex-col items-center group">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.id)}
                disabled={!isClickable}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "relative flex items-center justify-center w-10 h-10 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 ring-4 ring-[#08090c]",
                  isCompleted
                    ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                    : isActive
                    ? "bg-cyan-500 text-zinc-950 ring-cyan-500/30 scale-110 shadow-lg shadow-cyan-500/30"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700/60",
                  isClickable && "cursor-pointer hover:ring-cyan-500/40"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : (
                  <span>{step.id}</span>
                )}
              </button>

              <div className="text-center mt-2.5">
                <span
                  className={cn(
                    "block text-xs sm:text-sm font-semibold transition-colors tracking-tight",
                    isActive
                      ? "text-cyan-400 font-bold"
                      : isCompleted
                      ? "text-zinc-200"
                      : "text-zinc-400"
                  )}
                >
                  {step.label}
                </span>
                {step.description && (
                  <span className="hidden md:block text-[11px] text-zinc-400 mt-0.5">
                    {step.description}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
