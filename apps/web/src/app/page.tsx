"use client";

import { useState, useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Download,
  Play,
  Music2,
  Sparkles,
  Zap,
  ShieldCheck,
  Film,
  ChevronDown,
  Eraser,
  Scissors,
} from "lucide-react";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { UrlInput } from "@/components/url-input";
import { VideoPreview } from "@/components/video-preview";
import { DownloadOptions } from "@/components/download-options";
import { ProgressBar } from "@/components/progress-bar";
import { HistoryDrawer } from "@/components/history-drawer";
import { ErrorBanner } from "@/components/error-banner";
import { WatermarkRemover } from "@/components/watermark-remover";
import { ViralClips } from "@/components/viral-clips";
import { AutopilotDashboard } from "@/components/autopilot-dashboard";
import { useDownload } from "@/hooks/use-download";
import { useHistory } from "@/hooks/use-history";
import { RootState, setAuthUser } from "@/lib/store";
import { apiClient } from "@/lib/api";
import { cleanVideoUrl, detectPlatform } from "@/lib/validators";
import {
  trackVideoSearch,
  trackDownloadStart,
  trackFaqClick,
  trackHistoryAction,
} from "@/lib/analytics";

export default function Home() {
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);
  const [activeTab, setActiveTab] = useState<"downloader" | "watermark" | "clips" | "autopilot">("downloader");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
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

  const { history, addToHistory, clearHistory, removeFromHistory } = useHistory(auth?.user?.id);

  // Restore authenticated session on mount if token is saved in localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("saveit_auth_token");
      if (token) {
        apiClient
          .getMe()
          .then((user) => {
            if (user) {
              dispatch(setAuthUser({ user, token }));
            }
          })
          .catch(() => {});
      }
    }
  }, [dispatch]);

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
    (formatId: string, label: string) => {
      setActiveFormatId(formatId);
      const chosenFormat = metadata?.formats.find((f) => f.format_id === formatId);
      
      trackDownloadStart({
        platform: metadata?.platform || "unknown",
        title: metadata?.title || "Unknown Video",
        format: label,
        quality: chosenFormat?.resolution || label,
        is_audio: chosenFormat?.is_audio_only || label.toLowerCase().includes("mp3"),
      });

      startDownload(currentUrl, formatId);

      // Add to history when download starts
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
    <div className="min-h-screen flex flex-col selection:bg-violet-500/20 selection:text-violet-300">
      <Header
        onOpenHistory={() => {
          trackHistoryAction("open", history.length);
          setHistoryOpen(true);
        }}
        historyCount={history.length}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <main className="flex-1 flex flex-col items-center px-4 pt-8 sm:pt-12 pb-20">
        {/* Ambient Top Glow */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Top Feature Switcher Tabs */}
        <nav aria-label="Feature navigation" className="w-full max-w-2xl mx-auto mb-10 flex items-center p-1.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl backdrop-blur-xl">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "downloader"}
            onClick={() => setActiveTab("downloader")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "downloader"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "watermark"}
            onClick={() => setActiveTab("watermark")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "watermark"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Eraser className="w-4 h-4" />
            <span>Watermark</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "clips"}
            onClick={() => setActiveTab("clips")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "clips"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span>Viral Shorts</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "autopilot"}
            onClick={() => setActiveTab("autopilot")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "autopilot"
                ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="font-bold">GTA 6 Autopilot</span>
          </button>
        </nav>

        {/* TAB 1: VIDEO DOWNLOADER */}
        {activeTab === "downloader" && (
          <>
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
                High-speed, lossless downloads from YouTube, TikTok, and Instagram. Enjoy watermark-free videos,
                up to 4K resolutions, and crystal-clear audio extraction.
              </p>

              {/* Platform Badges */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 bg-zinc-900/80 border border-zinc-800 rounded-full px-3.5 py-1.5 shadow-sm">
                  <Play className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                  YouTube (4K, 1080p, MP3)
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 bg-zinc-900/80 border border-zinc-800 rounded-full px-3.5 py-1.5 shadow-sm">
                  <Music2 className="w-3.5 h-3.5 text-cyan-400" />
                  TikTok (No Watermark)
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 bg-zinc-900/80 border border-zinc-800 rounded-full px-3.5 py-1.5 shadow-sm">
                  <Film className="w-3.5 h-3.5 text-pink-400" />
                  Instagram (Reels, HD)
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
              {progress && (
                <ProgressBar
                  progress={progress}
                  onCancel={cancelDownload}
                  onReset={reset}
                />
              )}
            </section>
          </>
        )}

        {/* TAB 2: WATERMARK REMOVER */}
        {activeTab === "watermark" && (
          <div className="w-full flex flex-col items-center">
            <section className="text-center space-y-4 mb-8 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium shadow-sm shadow-violet-500/10">
                <Eraser className="w-3.5 h-3.5 text-violet-400" />
                <span>AI-Powered Watermark Removal</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                Remove Watermarks{" "}
                <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
                  from Any Video.
                </span>
              </h1>
              <p className="text-zinc-400 text-sm sm:text-base max-w-lg mx-auto">
                Clean TikTok logos, creator usernames, and unwanted static overlays with precision FFmpeg inpainting.
              </p>
            </section>
            <WatermarkRemover />
          </div>
        )}

        {/* TAB 3: VIRAL CLIPS (AI SHORTS) */}
        {activeTab === "clips" && (
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
        )}

        {/* TAB 4: GTA 6 VIRAL AUTOPILOT */}
        {activeTab === "autopilot" && (
          <div className="w-full flex flex-col items-center">
            <AutopilotDashboard />
          </div>
        )}

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
                    onClick={() => toggleFaq(idx, faq.q)}
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

      {/* User Authentication & Account Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}
