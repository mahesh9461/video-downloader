"use client";

import React from "react";
import { Eraser } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { WatermarkRemover } from "@/components/watermark-remover";

export default function WatermarkPage() {
  return (
    <PageShell activeTab="watermark">
      <div className="w-full flex flex-col items-center">
        <section className="text-center space-y-4 mb-8 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-bold shadow-sm tracking-wide">
            <Eraser className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI-Powered Watermark Removal</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.15]">
            Remove Watermarks{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent">
              from Any Video.
            </span>
          </h1>
          <p className="text-zinc-300 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Clean TikTok logos, creator usernames, and unwanted static overlays with precision video inpainting.
          </p>
        </section>
        <WatermarkRemover />
      </div>
    </PageShell>
  );
}
