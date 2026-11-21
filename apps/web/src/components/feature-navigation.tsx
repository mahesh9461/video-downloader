"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Eraser, Scissors, Sparkles } from "lucide-react";

export type FeatureTab = "downloader" | "watermark" | "clips" | "autopilot";

interface FeatureNavigationProps {
  activeTab?: FeatureTab;
}

export function FeatureNavigation({ activeTab: explicitTab }: FeatureNavigationProps) {
  const pathname = usePathname();

  let activeTab: FeatureTab = explicitTab || "downloader";
  if (!explicitTab && pathname) {
    if (pathname.startsWith("/watermark")) {
      activeTab = "watermark";
    } else if (
      pathname.startsWith("/viral-shorts") ||
      pathname.startsWith("/shorts") ||
      pathname.startsWith("/clips")
    ) {
      activeTab = "clips";
    } else if (pathname.startsWith("/autopilot")) {
      activeTab = "autopilot";
    } else {
      activeTab = "downloader";
    }
  }

  return (
    <nav
      aria-label="Feature navigation"
      className="w-full max-w-2xl mx-auto mb-10 flex items-center p-1.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl backdrop-blur-xl"
    >
      <Link
        href="/"
        role="tab"
        aria-selected={activeTab === "downloader"}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
          activeTab === "downloader"
            ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        <Download className="w-4 h-4" />
        <span>Download</span>
      </Link>

      <Link
        href="/watermark"
        role="tab"
        aria-selected={activeTab === "watermark"}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
          activeTab === "watermark"
            ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        <Eraser className="w-4 h-4" />
        <span>Watermark</span>
      </Link>

      <Link
        href="/viral-shorts"
        role="tab"
        aria-selected={activeTab === "clips"}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
          activeTab === "clips"
            ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        <Scissors className="w-4 h-4" />
        <span>Viral Shorts</span>
      </Link>

      <Link
        href="/autopilot"
        role="tab"
        aria-selected={activeTab === "autopilot"}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
          activeTab === "autopilot"
            ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        <Sparkles className="w-4 h-4 text-amber-300" />
        <span className="font-bold">GTA 6 Autopilot</span>
      </Link>
    </nav>
  );
}
