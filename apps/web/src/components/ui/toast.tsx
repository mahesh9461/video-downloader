"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { useToast, ToastType, dismissToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const icons: Record<ToastType, React.ReactNode> = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          info: <Info className="w-5 h-5 text-cyan-400 shrink-0" />,
        };

        const borderClasses: Record<ToastType, string> = {
          success: "border-emerald-500/40 bg-[#101918]/95 shadow-emerald-500/10",
          error: "border-rose-500/40 bg-[#1c1214]/95 shadow-rose-500/10",
          warning: "border-amber-500/40 bg-[#1c1810]/95 shadow-amber-500/10",
          info: "border-cyan-500/40 bg-[#101820]/95 shadow-cyan-500/10",
        };

        return (
          <div
            key={toast.id}
            role="alert"
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200",
              borderClasses[toast.type]
            )}
          >
            {icons[toast.type]}
            <div className="flex-1 min-w-0">
              {toast.title && (
                <h4 className="text-sm font-semibold text-white tracking-tight">
                  {toast.title}
                </h4>
              )}
              <p className="text-xs text-zinc-300 leading-relaxed mt-0.5">
                {toast.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
