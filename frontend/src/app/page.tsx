"use client";

import { useState, useCallback } from "react";
import {
  Download,
  Play,
  Music2,
  Sparkles,
  Zap,
  ShieldCheck,
  Film,
  Music,
  CheckCircle2,
  ChevronDown,
  Layers,
  HardDrive,
} from "lucide-react";
import { Header } from "@/components/header";
import { UrlInput } from "@/components/url-input";
import { VideoPreview } from "@/components/video-preview";
import { DownloadOptions } from "@/components/download-options";
import { ProgressBar } from "@/components/progress-bar";
import { HistoryDrawer } from "@/components/history-drawer";
import { ErrorBanner } from "@/components/error-banner";
import { useDownload } from "@/hooks/use-download";
import { useHistory } from "@/hooks/use-history";

export default function Home() {
  const [historyOpen, setHistoryOpen] = useState(false);
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

  const { history, addToHistory, clearHistory, removeFromHistory } = useHistory();

  const handleUrlSubmit = useCallback(
    (url: string) => {
      setCurrentUrl(url);
      reset();
      fetchMetadata(url);
    },
    [fetchMetadata, reset]
  );

  const handleDownload = useCallback(
    (formatId: string, label: string) => {
      setActiveFormatId(formatId);
      startDownload(currentUrl, formatId);

      // Add to history when download starts
      if (metadata) {
        addToHistory({
          platform: metadata.platform,
          title: metadata.title,
          thumbnail: metadata.thumbnail,
          creator: metadata.creator,
          format: label,
          filesize: null,
        });
      }
    },
    [currentUrl, metadata, startDownload, addToHistory]
  );

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-violet-500/20 selection:text-violet-300">
      <Header onOpenHistory={() => setHistoryOpen(true)} historyCount={history.length} />

      <main className="flex-1 flex flex-col items-center px-4 pt-12 sm:pt-20 pb-20">
        {/* Ambient Top Glow */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Hero Section */}
        <section className="text-center space-y-5 mb-10 max-w-2xl">
          {/* Release Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium shadow-sm shadow-violet-500/10 animate-in fade-in slide-in-from-top-3 duration-500">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Next-Gen Video Downloader & MP3 Extractor</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
            Save videos in seconds,{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
              without limits.
            </span>
          </h1>

          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
            High-speed, lossless downloads from YouTube and TikTok. Enjoy watermark-free videos,
            up to 4K 60FPS resolutions, and crystal-clear audio extraction.
          </p>

          {/* Platform Badges */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 bg-zinc-900/80 border border-zinc-800 rounded-full px-3.5 py-1.5 shadow-sm">
              <Play className="w-3.5 h-3.5 text-red-500 fill-red-500" />
              YouTube (4K, 1080p, MP3)
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 bg-zinc-900/80 border border-zinc-800 rounded-full px-3.5 py-1.5 shadow-sm">
              <Music2 className="w-3.5 h-3.5 text-cyan-400" />
              TikTok (No Watermark)
            </div>
          </div>
        </section>

        {/* URL Input Bar */}
        <section className="w-full max-w-2xl relative">
          <UrlInput
            onSubmit={handleUrlSubmit}
            isLoading={isLoadingMetadata}
            disabled={isDownloading}
          />
        </section>

        {/* Content Area (Preview / Options / Progress / Error) */}
        <section className="w-full max-w-2xl mt-8 space-y-6">
          {/* Error Banner */}
          {error && (
            <ErrorBanner
              message={error}
              type={errorType}
              onDismiss={clearError}
            />
          )}

          {/* Video Preview Card */}
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

          {/* Progress Bar */}
          {progress && <ProgressBar progress={progress} />}
        </section>

        {/* Features Grid (SEO & Value Prop) */}
        {!metadata && (
          <section className="w-full max-w-4xl mt-24">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Engineered for speed & quality
              </h2>
              <p className="text-sm text-zinc-400 mt-2">
                Server-side FFmpeg pipeline delivers crisp video and pure audio every time.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <article className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm space-y-3 hover:border-zinc-700/80 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <Film className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-white text-base">True 4K & 1080p DASH</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Automatically blends high-bitrate video streams with pristine stereo audio via automated FFmpeg remuxing.
                </p>
              </article>

              <article className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm space-y-3 hover:border-zinc-700/80 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-white text-base">Clean TikTok Downloads</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Bypasses intrusive branding overlays to fetch clean, watermark-free videos in original creator quality.
                </p>
              </article>

              <article className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm space-y-3 hover:border-zinc-700/80 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-white text-base">Real-Time SSE Streaming</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Live Server-Sent Events stream precise download percentage, bitrate speed, and ETA directly to your browser.
                </p>
              </article>
            </div>
          </section>
        )}

        {/* How It Works (SEO Keyword Optimization) */}
        {!metadata && (
          <section className="w-full max-w-4xl mt-20 pt-10 border-t border-zinc-800/60">
            <div className="text-center mb-10">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                How It Works in 3 Simple Steps
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 font-bold flex items-center justify-center text-sm mb-3">
                  1
                </div>
                <h3 className="font-medium text-white mb-1">Paste Link</h3>
                <p className="text-xs text-zinc-400">
                  Copy any YouTube or TikTok video link and paste it into the search bar.
                </p>
              </div>

              <div className="flex flex-col items-center text-center p-4">
                <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 font-bold flex items-center justify-center text-sm mb-3">
                  2
                </div>
                <h3 className="font-medium text-white mb-1">Select Format</h3>
                <p className="text-xs text-zinc-400">
                  Choose your desired resolution (360p to 4K) or extract high-bitrate MP3 audio.
                </p>
              </div>

              <div className="flex flex-col items-center text-center p-4">
                <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 font-bold flex items-center justify-center text-sm mb-3">
                  3
                </div>
                <h3 className="font-medium text-white mb-1">Save Instantly</h3>
                <p className="text-xs text-zinc-400">
                  Stream the download progress in real time and save directly to your device.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Frequently Asked Questions (FAQ SEO Section) */}
        {!metadata && (
          <section className="w-full max-w-2xl mt-20 pt-10 border-t border-zinc-800/60">
            <div className="text-center mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {[
                {
                  q: "How do I download TikTok videos without a watermark?",
                  a: "Simply paste your TikTok video URL into the bar above, and click the 'No Watermark' button. The platform fetches the clean MP4 directly without any logo or overlay.",
                },
                {
                  q: "Can I download 1080p and 4K YouTube videos with audio?",
                  a: "Yes! YouTube stores 1080p, 1440p, and 4K streams as separate video and audio tracks. Our backend merges them into a single high-quality MP4 file using FFmpeg.",
                },
                {
                  q: "Is there any download limit or registration needed?",
                  a: "No registration is required. You can download videos anytime for free. A standard rate-limiter prevents server overload while keeping the service fast for everyone.",
                },
                {
                  q: "Where are my past downloads stored?",
                  a: "Your download history is saved privately in your browser's local storage (localStorage) and is never tracked or stored on our servers.",
                },
              ].map((faq, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between text-sm font-medium text-zinc-200 hover:text-white"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                        openFaq === idx ? "rotate-180 text-violet-400" : ""
                      }`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-4 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/40 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-zinc-800/50 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <p>© {new Date().getFullYear()} SaveIt. Free personal video downloader.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-zinc-400 cursor-pointer">Privacy</span>
            <span>•</span>
            <span className="hover:text-zinc-400 cursor-pointer">Terms</span>
            <span>•</span>
            <span className="hover:text-zinc-400 cursor-pointer">API Status</span>
          </div>
        </footer>
      </main>

      {/* History Drawer */}
      <HistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={history}
        onClear={clearHistory}
        onRemove={removeFromHistory}
      />
    </div>
  );
}
