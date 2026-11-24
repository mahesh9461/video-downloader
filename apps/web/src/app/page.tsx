"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import {
  Sparkles,
  Play,
  Music2,
  Film,
  ShieldCheck,
  Zap,
  ChevronDown,
  Scissors,
  ArrowRight,
} from "lucide-react";
import { UrlInput } from "@/components/url-input";
import { GlobalSettingsPanel } from "@/components/global-settings-panel";
import { VideoPreview } from "@/components/video-preview";
import { DownloadOptions } from "@/components/download-options";
import { ProgressBar } from "@/components/progress-bar";
import { ErrorBanner } from "@/components/error-banner";
import { PageShell } from "@/components/page-shell";
import { useDownload } from "@/hooks/use-download";
import { useHistory } from "@/hooks/use-history";
import { RootState } from "@/lib/store";
import { cleanVideoUrl, detectPlatform } from "@/lib/validators";
import {
  trackVideoSearch,
  trackDownloadStart,
  trackFaqClick,
} from "@/lib/analytics";

export default function Home() {
  const auth = useSelector((state: RootState) => state.auth);
  const [currentUrl, setCurrentUrl] = useState("");
  const [activeFormatId, setActiveFormatId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const {
    metadata,
    progress,
    isLoadingMetadata,
    isDownloading,
    error,
    errorType,
    fetchMetadata,
    startDownload,
    cancelDownload,
    clearError,
    reset,
  } = useDownload();

  const { addToHistory } = useHistory(auth?.user?.id);

  const handleUrlSubmit = useCallback(
    (url: string) => {
      const cleaned = cleanVideoUrl(url);
      const platform = detectPlatform(cleaned) || "other";
      trackVideoSearch({ platform, url: cleaned });
      setCurrentUrl(cleaned);
      reset();
      fetchMetadata(cleaned);
    },
    [fetchMetadata, reset]
  );

  const handleDownload = useCallback(
    (formatId: string, label: string, antiCopyrightShield?: boolean, muteAudio?: boolean) => {
      setActiveFormatId(formatId);
      const chosenFormat = metadata?.formats.find((f) => f.format_id === formatId);

      trackDownloadStart({
        platform: metadata?.platform || "unknown",
        title: metadata?.title || "Unknown Video",
        format: label,
        quality: chosenFormat?.resolution || label,
        is_audio: chosenFormat?.is_audio_only || label.toLowerCase().includes("mp3"),
      });

      startDownload(currentUrl, formatId, antiCopyrightShield, muteAudio);

      if (metadata) {
        addToHistory({
          platform: metadata.platform,
          title: metadata.title,
          thumbnail: metadata.thumbnail,
          creator: metadata.creator,
          format: label,
          filesize: chosenFormat?.filesize || null,
        });
      }
    },
    [currentUrl, metadata, startDownload, addToHistory]
  );

  const toggleFaq = (index: number, question: string) => {
    const isOpening = openFaq !== index;
    setOpenFaq(isOpening ? index : null);
    if (isOpening) {
      trackFaqClick(question);
    }
  };

  return (
    <PageShell activeTab="downloader">
      {/* Hero Section */}
      <section className="text-center space-y-4 mb-8 max-w-2xl mx-auto">
        {/* Release / Mode Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-bold tracking-wide shadow-sm animate-in fade-in duration-300">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>High-Speed Video Downloader & MP3 Extractor</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.15]">
          Save videos in seconds,{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent">
            without limits.
          </span>
        </h1>

        <p className="text-zinc-300 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
          Download high-quality videos from YouTube, TikTok, and Instagram without watermarks. Extract clean MP3 audio in one click.
        </p>

        {/* Platform Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 bg-[#12151f] border border-white/10 rounded-full px-3 py-1">
            <Play className="w-3 h-3 text-red-500 fill-red-500" />
            YouTube (4K, 1080p, MP3)
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 bg-[#12151f] border border-white/10 rounded-full px-3 py-1">
            <Music2 className="w-3 h-3 text-cyan-400" />
            TikTok (No Watermark)
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 bg-[#12151f] border border-white/10 rounded-full px-3 py-1">
            <Film className="w-3 h-3 text-pink-400" />
            Instagram (Reels HD)
          </span>
        </div>
      </section>

      {/* URL Input Bar & Global Customization Settings */}
      <section className="w-full max-w-2xl relative space-y-3">
        <UrlInput
          onSubmit={handleUrlSubmit}
          isLoading={isLoadingMetadata}
          disabled={isDownloading}
        />
        <GlobalSettingsPanel />
      </section>

      {/* Content Area (Preview / Options / Progress / Error) */}
      <section className="w-full max-w-2xl mt-6 space-y-5">
        {/* Error Banner */}
        {error && (
          <ErrorBanner
            message={error}
            type={errorType}
            onDismiss={clearError}
          />
        )}

        {/* Video Preview Card with Shimmer Skeleton */}
        <VideoPreview metadata={metadata} isLoading={isLoadingMetadata} />

        {/* Download Options */}
        {metadata && !isLoadingMetadata && (
          <DownloadOptions
            metadata={metadata}
            onDownload={handleDownload}
            isDownloading={isDownloading}
            activeFormatId={activeFormatId}
          />
        )}

        {/* Progress Bar with Cancel & Reset */}
        {progress && (
          <ProgressBar
            progress={progress}
            onCancel={cancelDownload}
            onReset={reset}
          />
        )}

        {/* Quick Upsell to Shorts Studio when video is ready */}
        {metadata && !isLoadingMetadata && (
          <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Want to publish this video as a 9:16 Short?</p>
                <p className="text-[11px] text-zinc-300">Auto-crop, add viral captions, and post to your YouTube channel.</p>
              </div>
            </div>
            <Link
              href="/viral-shorts"
              className="inline-flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200 shrink-0 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 transition-colors"
            >
              Shorts Studio <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* Features Grid */}
      {!metadata && (
        <section className="w-full max-w-4xl mt-16 sm:mt-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Engineered for speed & quality
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 mt-1.5">
              High-speed transfer with crisp video remuxing and clean audio extraction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article className="p-6 rounded-2xl border border-white/10 bg-[#12151f]/80 backdrop-blur-sm space-y-2.5 hover:border-cyan-500/40 transition-colors shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Film className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">True 4K & 1080p Full HD</h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Blends high-bitrate video streams with pristine stereo sound into a single crisp MP4 file.
              </p>
            </article>

            <article className="p-6 rounded-2xl border border-white/10 bg-[#12151f]/80 backdrop-blur-sm space-y-2.5 hover:border-cyan-500/40 transition-colors shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Clean TikTok Downloads</h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Fetches original creator quality videos without distracting overlays or watermark logos.
              </p>
            </article>

            <article className="p-6 rounded-2xl border border-white/10 bg-[#12151f]/80 backdrop-blur-sm space-y-2.5 hover:border-cyan-500/40 transition-colors shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Instant 9:16 Shorts Studio</h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Reframe clips vertically, add attention-grabbing headlines, and publish to multiple YouTube channels.
              </p>
            </article>
          </div>
        </section>
      )}

      {/* How It Works in 3 Simple Steps */}
      {!metadata && (
        <section className="w-full max-w-4xl mt-16 pt-10 border-t border-white/10">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              How It Works in 3 Simple Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-[#12151f]/50 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold flex items-center justify-center text-sm mb-3">
                1
              </div>
              <h3 className="font-semibold text-white mb-1">Paste Link</h3>
              <p className="text-xs text-zinc-400">
                Copy any YouTube or TikTok video link and paste it into the search bar.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-[#12151f]/50 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold flex items-center justify-center text-sm mb-3">
                2
              </div>
              <h3 className="font-semibold text-white mb-1">Select Format</h3>
              <p className="text-xs text-zinc-400">
                Choose your desired resolution (360p to 4K) or extract high-bitrate MP3 audio.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-[#12151f]/50 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold flex items-center justify-center text-sm mb-3">
                3
              </div>
              <h3 className="font-semibold text-white mb-1">Save Instantly</h3>
              <p className="text-xs text-zinc-400">
                Stream the download progress in real time and save directly to your device.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Frequently Asked Questions */}
      {!metadata && (
        <section className="w-full max-w-2xl mt-16 pt-8 border-t border-white/10">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: "How do I download TikTok videos without a watermark?",
                a: "Simply paste your TikTok video URL into the bar above and select 'No Watermark'. We fetch the clean MP4 directly without logos or overlays.",
              },
              {
                q: "Can I download 1080p and 4K YouTube videos with audio?",
                a: "Yes! High-resolution video and audio tracks are merged into a single high-quality MP4 file automatically.",
              },
              {
                q: "How do I publish Shorts to my YouTube channel?",
                a: "Go to Shorts Studio tab, paste your link, review the 9:16 vertical preview, select your YouTube channel from the dropdown, and click Publish.",
              },
              {
                q: "Can I connect multiple YouTube channels under one email?",
                a: "Yes! Click 'Connect another channel' in the top header. On the Google sign-in screen, pick your other brand channel to connect both simultaneously.",
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-[#12151f]/70 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx, faq.q)}
                  aria-expanded={openFaq === idx}
                  className="w-full px-5 py-4 text-left flex items-center justify-between text-sm font-semibold text-zinc-200 hover:text-white"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                      openFaq === idx ? "rotate-180 text-cyan-400" : ""
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4 text-xs text-zinc-300 leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
