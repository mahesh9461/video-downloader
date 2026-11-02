"use client";

import { AlertCircle, Lock, Globe, Trash2, Clock, WifiOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ERROR_ICONS: Record<string, React.ElementType> = {
  private: Lock,
  geo_restricted: Globe,
  deleted: Trash2,
  rate_limit: Clock,
  network: WifiOff,
  invalid_url: AlertCircle,
  unknown: AlertCircle,
};

const ERROR_TITLES: Record<string, string> = {
  private: "Private Video",
  geo_restricted: "Geo-Restricted",
  deleted: "Content Unavailable",
  rate_limit: "Rate Limited",
  network: "Network Error",
  invalid_url: "Invalid URL",
  unknown: "Error",
};

interface ErrorBannerProps {
  message: string;
  type?: string | null;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({ message, type = "unknown", onDismiss, className }: ErrorBannerProps) {
  const errorType = type || "unknown";
  const Icon = ERROR_ICONS[errorType] || AlertCircle;
  const title = ERROR_TITLES[errorType] || "Error";

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm animate-in slide-in-from-top-2 duration-300",
        className
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-red-400">{title}</p>
        <p className="text-red-300/80 mt-0.5 leading-relaxed">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-red-400/60 hover:text-red-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

