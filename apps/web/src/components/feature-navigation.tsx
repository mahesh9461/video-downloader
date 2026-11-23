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
      role="tablist"
      aria-label="Feature navigation"
      className="hidden sm:flex w-full max-w-2xl mx-auto mb-8 items-center p-1.5 rounded-2xl bg-[#12151f]/90 border border-white/10 shadow-xl backdrop-blur-xl"
    >
      <Link
        href="/"
        role="tab"
        id="tab-downloader"
        aria-selected={activeTab === "downloader"}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
          activeTab === "downloader"
            ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/25"
            : "text-zinc-300 hover:text-white hover:bg-white/5"
        }`}
      >
        <Download className="w-4 h-4" />
        <span>Download</span>
      </Link>

      <Link
        href="/viral-shorts"
        role="tab"
        id="tab-clips"
        aria-selected={activeTab === "clips"}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
          activeTab === "clips"
            ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/25"
            : "text-zinc-300 hover:text-white hover:bg-white/5"
        }`}
      >
        <Scissors className="w-4 h-4" />
        <span>Viral Shorts</span>
      </Link>

      <Link
        href="/watermark"
        role="tab"
        id="tab-watermark"
        aria-selected={activeTab === "watermark"}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
          activeTab === "watermark"
            ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/25"
            : "text-zinc-300 hover:text-white hover:bg-white/5"
        }`}
      >
        <Eraser className="w-4 h-4" />
        <span>Watermark</span>
      </Link>

      <Link
        href="/autopilot"
        role="tab"
        id="tab-autopilot"
        aria-selected={activeTab === "autopilot"}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px] ${
          activeTab === "autopilot"
            ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30 font-extrabold"
            : "text-zinc-300 hover:text-white hover:bg-white/5"
        }`}
      >
        <Sparkles className="w-4 h-4 text-amber-300" />
        <span>GTA 6 Autopilot</span>
      </Link>
    </nav>
  );
}
