"use client";

import React from "react";
import { Scissors } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ViralClips } from "@/components/viral-clips";

export default function ViralShortsPage() {
  return (
    <PageShell activeTab="clips">
      <div className="w-full flex flex-col items-center">
        <section className="text-center space-y-4 mb-8 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium shadow-sm shadow-violet-500/10">
            <Scissors className="w-3.5 h-3.5 text-violet-400" />
            <span>Viral Shorts & Reel Generator</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Turn Long Videos into{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
              Viral 9:16 Shorts.
            </span>
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-lg mx-auto">
            Opus Clip style workflow: auto-detects high-retention hooks, reframes to vertical 9:16, and adds headline banners & background music.
          </p>
        </section>
        <ViralClips />
      </div>
    </PageShell>
  );
}
