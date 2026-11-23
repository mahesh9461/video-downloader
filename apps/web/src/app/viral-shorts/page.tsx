"use client";

import React from "react";
import { Scissors } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ViralClips } from "@/components/viral-clips";

export default function ViralShortsPage() {
  return (
    <PageShell activeTab="clips">
      <div className="w-full flex flex-col items-center">
        <section className="text-center space-y-4 mb-8 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-bold shadow-sm tracking-wide">
            <Scissors className="w-3.5 h-3.5 text-cyan-400" />
            <span>Viral Shorts & Reel Generator</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.15]">
            Turn Long Videos into{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent">
              Viral 9:16 Shorts.
            </span>
          </h1>
          <p className="text-zinc-300 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Auto-detect high-retention hooks, reframe to 9:16 vertical video, preview in real time, and publish directly to your YouTube channels.
          </p>
        </section>
        <ViralClips />
      </div>
    </PageShell>
  );
}
