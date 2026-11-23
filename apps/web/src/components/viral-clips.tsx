"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  Scissors,
  Sparkles,
  Flame,
  Clock,
  Play,
  Volume2,
  Layers,
  Download,
  RotateCcw,
  Sliders,
  Type,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Music2,
  TrendingUp,
  Zap,
  Upload,
  Share2,
  ExternalLink,
  Loader2,
  Settings,
  Video as Youtube,
  Copy,
  Check,
  Lightbulb,
  Trash2,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Stepper, StepItem } from "@/components/ui/stepper";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ShortPreviewCard } from "@/components/short-preview-card";
import { ChannelManagerModal } from "@/components/channel-manager-modal";
import { GlobalSettingsPanel } from "@/components/global-settings-panel";
import { apiClient } from "@/lib/api";
import {
  ClipCandidate,
  ClipRenderResponse,
  YouTubeAuthStatus,
  YouTubePublishResponse,
  YouTubeChannelItem,
  GlobalSettings,
} from "@/lib/types";
import { formatDuration, formatFileSize } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_GTA_DESCRIPTION =
  "Welcome to GTA World: ViceVerse — your daily hub for GTA 6 Shorts, live gameplay streams, hidden Leonida secrets, Vice City map discoveries, crazy physics tests, and launch-week moments with Jason and Lucia.\n\nSubscribe and turn on notifications so you never miss a daily Short or live stream!\n\n#GTA6 #GTAVI #Shorts #GTA6Shorts #GTA6Live #GTA6LiveStream #ViceCity #Leonida #GTA6Gameplay #GTA6Launch #GamingShorts #LiveGaming";

const STEPS: StepItem[] = [
  { id: 1, label: "Add Video", description: "Paste link or select clip" },
  { id: 2, label: "Edit Details", description: "Headline, tags & 9:16 layout" },
  { id: 3, label: "Choose Channel", description: "Select YouTube channel" },
  { id: 4, label: "Publish", description: "Upload or download Short" },
];

export function ViralClips() {
  const { success, error: toastError, info } = useToast();

  // Stepper state (1: Add Video, 2: Edit Details, 3: Choose Channel, 4: Publish)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Video URL & Analysis state
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [clips, setClips] = useState<ClipCandidate[]>([]);
  const [selectedClip, setSelectedClip] = useState<ClipCandidate | null>(null);

  // Customization & Rendering state
  const [layout, setLayout] = useState<string>("center_crop");
  const [hookTitle, setHookTitle] = useState<string>("");
  const [hookStyle, setHookStyle] = useState<string>("none");
  const [backgroundMusic, setBackgroundMusic] = useState<string>("none");
  const [musicVolume, setMusicVolume] = useState<number>(0.12);
  const [progressBar, setProgressBar] = useState<boolean>(true);
  const [progressBarColor, setProgressBarColor] = useState<string>("yellow");
  const [burnCaptions, setBurnCaptions] = useState<boolean>(false);
  const [captionStyle, setCaptionStyle] = useState<string>("viral_yellow");

  // Render Execution & Progress state
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedClip, setRenderedClip] = useState<ClipRenderResponse | null>(null);

  // YouTube Channels & Publishing State
  const [channels, setChannels] = useState<YouTubeChannelItem[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [ytAuthStatus, setYtAuthStatus] = useState<YouTubeAuthStatus | null>(null);
  const [ytTitle, setYtTitle] = useState("");
  const [ytDescription, setYtDescription] = useState(DEFAULT_GTA_DESCRIPTION);
  const [ytPrivacy, setYtPrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [ytAccessToken, setYtAccessToken] = useState("");
  const [isPublishingYt, setIsPublishingYt] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [ytPublishResult, setYtPublishResult] = useState<YouTubePublishResponse | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);

  // Modals & Dialogs
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch YouTube connection status and channels
  const refreshChannels = useCallback(async () => {
    try {
      if (typeof apiClient.getYouTubeChannels === "function") {
        const res = await apiClient.getYouTubeChannels();
        if (res?.channels) {
          setChannels(res.channels);
          if (res.active_channel_id) {
            setActiveChannelId(res.active_channel_id);
          } else if (res.channels.length > 0) {
            setActiveChannelId(res.channels[0].channel_id);
          }
        }
      }
      const status = await apiClient.getYouTubeStatus();
      if (status) setYtAuthStatus(status);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (typeof apiClient.getYouTubeChannels === "function") {
          const res = await apiClient.getYouTubeChannels();
          if (mounted && res?.channels) {
            setChannels(res.channels);
            if (res.active_channel_id) {
              setActiveChannelId(res.active_channel_id);
            } else if (res.channels.length > 0) {
              setActiveChannelId(res.channels[0].channel_id);
            }
          }
        }
        const status = await apiClient.getYouTubeStatus();
        if (mounted && status) setYtAuthStatus(status);
      } catch {
        // Ignored
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Restore cached settings from localStorage
    if (typeof window !== "undefined") {
      try {
        const savedPrivacy = localStorage.getItem("saveit_pref_privacy") as "public" | "unlisted" | "private";
        if (savedPrivacy) setYtPrivacy(savedPrivacy);

        const lastViralUrl = localStorage.getItem("saveit_viral_url") || localStorage.getItem("saveit_last_url");
        if (lastViralUrl) setUrl(lastViralUrl);

        const cachedClips = sessionStorage.getItem("saveit_viral_clips");
        const cachedTitle = sessionStorage.getItem("saveit_viral_title");
        if (cachedClips) {
          const parsed = JSON.parse(cachedClips);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setClips(parsed);
            if (cachedTitle) setVideoTitle(cachedTitle);
            setSelectedClip(parsed[0]);
            if (parsed[0]?.hook_title) setHookTitle(parsed[0].hook_title);
          }
        }
      } catch {}

      // Handle return from Google OAuth callback
      const params = new URLSearchParams(window.location.search);
      if (params.get("youtube_auth") === "success") {
        showToast("YouTube channel connected successfully!", "success");
        setShowChannelModal(true);
      } else if (params.get("youtube_auth") === "error") {
        showToast(params.get("error_detail") || "Failed to authenticate with Google.", "error");
        setShowChannelModal(true);
      }
    }
  }, []);

  const activeChannel = useMemo(() => {
    return channels.find((c) => c.channel_id === activeChannelId) || channels[0] || null;
  }, [channels, activeChannelId]);

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("saveit_viral_url", newUrl);
        localStorage.setItem("saveit_last_url", newUrl);
      } catch {}
    }
  };

  const handleGlobalSettingsChange = useCallback((newSettings: GlobalSettings) => {
    if (newSettings.layout) setLayout(newSettings.layout);
    if (newSettings.audio_mix?.background_music) setBackgroundMusic(newSettings.audio_mix.background_music);
    if (typeof newSettings.audio_mix?.music_volume === "number") setMusicVolume(newSettings.audio_mix.music_volume);
    if (typeof newSettings.progress_bar === "boolean") setProgressBar(newSettings.progress_bar);
    if (newSettings.progress_bar_color) setProgressBarColor(newSettings.progress_bar_color);
    if (newSettings.default_privacy) setYtPrivacy(newSettings.default_privacy);
    if (newSettings.text_overlay?.default_hook) setHookTitle(newSettings.text_overlay.default_hook);
    if (typeof newSettings.text_overlay?.burn_captions === "boolean") setBurnCaptions(newSettings.text_overlay.burn_captions);
    if (newSettings.text_overlay?.caption_style) setCaptionStyle(newSettings.text_overlay.caption_style);
  }, []);

  const validateVideoUrl = (inputUrl: string): string | null => {
    try {
      const parsed = new URL(inputUrl);
      const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
      if (host === "youtube.com" && parsed.pathname === "/results") {
        return "That's a search results page. Please paste a direct video link.";
      }
      if (
        host === "youtube.com" &&
        (parsed.pathname.startsWith("/@") ||
          parsed.pathname.startsWith("/channel/") ||
          parsed.pathname.startsWith("/playlist"))
      ) {
        return "Please paste a specific video URL, not a channel or playlist.";
      }
    } catch {
      return "Please enter a valid video URL.";
    }
    return null;
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!url.trim()) return;

    const validationError = validateVideoUrl(url.trim());
    if (validationError) {
      setAnalysisError(validationError);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setClips([]);
    setSelectedClip(null);
    setRenderedClip(null);

    try {
      const res = await apiClient.analyzeClips(url.trim(), 30, 60, 4);
      setVideoTitle(res.title || "Video Highlights");
      setClips(res.clips);

      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("saveit_viral_clips", JSON.stringify(res.clips));
          sessionStorage.setItem("saveit_viral_title", res.title || "Video Highlights");
        } catch {}
      }

      if (res.clips.length > 0) {
        setSelectedClip(res.clips[0]);
        if (res.clips[0]?.hook_title) {
          setHookTitle(res.clips[0].hook_title);
          setYtTitle(`${res.clips[0].hook_title} #Shorts`.substring(0, 100));
        } else {
          setYtTitle(`${res.title || "Viral Short"} #Shorts`.substring(0, 100));
        }
        setCurrentStep(2); // Advance to Edit Details
        success(`Discovered ${res.clips.length} viral hook moments!`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to analyze video clips. Please check the URL.";
      setAnalysisError(errorMsg);
      toastError(errorMsg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRenderClip = async (targetClip?: ClipCandidate) => {
    const clip = targetClip || selectedClip;
    if (!clip || !url.trim()) return;

    setIsRendering(true);
    setRenderError(null);
    setRenderProgress(50);

    try {
      const res = await apiClient.renderClip({
        url: url.trim(),
        start_time: clip.start_time,
        end_time: clip.end_time,
        layout,
        hook_title: hookTitle.trim(),
        hook_style: hookTitle.trim() ? "viral_yellow" : "none",
        background_music: backgroundMusic,
        music_volume: musicVolume,
        progress_bar: progressBar,
        progress_bar_color: progressBarColor,
        burn_captions: burnCaptions,
        caption_style: captionStyle,
      });

      setRenderProgress(100);
      setRenderedClip(res);
      success("Viral Short ready in 9:16 vertical format!");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to render viral clip.";
      setRenderError(errorMsg);
      toastError(errorMsg);
    } finally {
      setIsRendering(false);
    }
  };

  // 1-Click Fast Track: Render top clip immediately
  const handleDownloadMostViral = async () => {
    if (clips.length === 0) return;
    const topClip = clips[0];
    setSelectedClip(topClip);
    if (topClip.hook_title) setHookTitle(topClip.hook_title);

    setIsRendering(true);
    setRenderError(null);
    setRenderProgress(50);

    try {
      const res = await apiClient.renderClip({
        url: url.trim(),
        start_time: topClip.start_time,
        end_time: topClip.end_time,
        layout: "center_crop",
        hook_style: "none",
        background_music: "none",
        music_volume: 0,
        progress_bar: true,
        progress_bar_color: "yellow",
        burn_captions: false,
        caption_style: "viral_yellow",
      });
      setRenderProgress(100);
      setRenderedClip(res);
      setCurrentStep(2);
      success("Most viral clip rendered!");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to render clip.";
      setRenderError(errorMsg);
      toastError(errorMsg);
    } finally {
      setIsRendering(false);
    }
  };

  const handleOpenYouTubeModal = async () => {
    setShowYouTubeModal(true);
    setYtError(null);
    setYtPublishResult(null);
    await refreshChannels();
  };

  const handlePublishToYouTube = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!renderedClip) {
      toastError("Please render the Short first before uploading.");
      return;
    }
    if (!ytTitle.trim()) {
      setYtError("Video title is required.");
      return;
    }

    setIsPublishingYt(true);
    setYtError(null);
    setUploadProgress(50);

    try {
      const res = await apiClient.publishToYouTube({
        filename: renderedClip.filename,
        title: ytTitle.trim(),
        description: ytDescription.trim(),
        privacy: ytPrivacy,
        access_token: ytAccessToken.trim() || undefined,
      });

      setUploadProgress(100);
      setYtPublishResult(res);
      success("Short published to YouTube Shorts!");
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("saveit_pref_privacy", ytPrivacy);
        } catch {}
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to publish video to YouTube Shorts.";
      setYtError(errorMsg);
      toastError(errorMsg);
    } finally {
      setIsPublishingYt(false);
    }
  };

  const handleDisconnectYouTube = async () => {
    try {
      await apiClient.disconnectYouTube();
      await refreshChannels();
      success("Disconnected YouTube channel");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to disconnect.";
      toastError(errorMsg);
    }
  };

  const handleCopyLink = () => {
    if (ytPublishResult?.youtube_url) {
      navigator.clipboard.writeText(ytPublishResult.youtube_url);
      setCopiedLink(true);
      info("YouTube Shorts link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in-50 duration-300">
      {/* 4-Step Interactive Stepper */}
      <Stepper
        steps={STEPS}
        currentStep={currentStep}
        onStepClick={(stepId) => {
          if (stepId === 1 || clips.length > 0) {
            setCurrentStep(stepId);
          }
        }}
      />

      {/* Connected Channel Quick Badge Header */}
      {ytAuthStatus?.channel_title && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-950/20 text-xs shadow-sm">
          <div className="flex items-center gap-2 text-red-300 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-400">YouTube Channel:</span>
            <span className="text-white font-semibold">
              {ytAuthStatus.channel_title || "Connected YouTube Channel"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenYouTubeModal}
              className="text-red-400 hover:text-red-300 underline font-semibold"
            >
              Shorts Settings
            </button>
            <button
              type="button"
              onClick={handleDisconnectYouTube}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 1: ADD VIDEO & DISCOVER MOMENTS
         ========================================================================= */}
      {currentStep <= 2 && (
        <div className="space-y-8">
          <Card className="border border-white/10 bg-[#12151f]/80 p-6 sm:p-8 rounded-2xl shadow-xl">
            <form onSubmit={handleAnalyze} className="space-y-4">
              <label htmlFor="viral-url-input" className="block text-sm font-bold text-white tracking-tight">
                Video URL (YouTube or TikTok)
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full flex-1">
                  <Input
                    id="viral-url-input"
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="Paste long YouTube video or TikTok link..."
                    disabled={isAnalyzing}
                    className="h-12 text-base pl-4 pr-10"
                  />
                  {url && (
                    <button
                      type="button"
                      onClick={() => handleUrlChange("")}
                      aria-label="Clear input"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                    >
                      ×
                    </button>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={!url.trim() || isAnalyzing}
                  className="w-full sm:w-auto h-12 px-6 shrink-0"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Analyzing Hooks...
                    </>
                  ) : (
                    <>
                      <Scissors className="w-5 h-5 mr-2" />
                      Find Viral Moments
                    </>
                  )}
                </Button>
              </div>

              {analysisError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}
            </form>
          </Card>

          {/* Global Customization Settings Panel under URL Input */}
          <GlobalSettingsPanel onSettingsChange={handleGlobalSettingsChange} />

          {/* Discovered Clips Grid */}
          {clips.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Discovered Viral Moments ({clips.length})
                  </h3>
                  <p className="text-xs text-zinc-300">
                    High-retention segments ranked by curiosity, emotion, and pace.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  onClick={handleDownloadMostViral}
                  className="inline-flex items-center shadow-md shadow-cyan-500/20"
                >
                  <Zap className="w-4 h-4 mr-1.5" />
                  Download Most Viral Clip
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clips.map((clip, idx) => {
                  const isSelected = selectedClip?.id === clip.id;
                  const viralScore = clip.hook_score || (clip as any).viral_score || 90;

                  return (
                    <Card
                      key={clip.id || idx}
                      onClick={() => {
                        setSelectedClip(clip);
                        if (clip.hook_title) setHookTitle(clip.hook_title);
                        setCurrentStep(2);
                      }}
                      className={`p-5 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] ${
                        isSelected
                          ? "border-cyan-500/60 bg-cyan-950/20 shadow-lg shadow-cyan-500/10"
                          : "border-white/10 bg-[#12151f]/80 hover:border-zinc-600"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs border border-cyan-500/30">
                              #{idx + 1} Best Moment
                            </span>
                            <span className="text-xs font-bold text-amber-300">
                              {viralScore}/100 Virality
                            </span>
                            <span className="text-xs text-emerald-400 font-semibold">
                              {(clip as any).retention_rate || "96% Retention"}
                            </span>
                            <span className="text-xs text-purple-300 font-semibold">
                              {(clip as any).hook_rating || "Top 1% Virality"}
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-white line-clamp-2 mt-1">
                            {clip.hook_title || "Untitled Viral Moment"}
                          </h4>

                          <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                            {clip.transcript_snippet || clip.reasoning || (clip as any).summary || "High retention hook identified."}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-zinc-400 pt-2 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDuration(clip.start_time)} - {formatDuration(clip.end_time)} ({Math.round(clip.duration)}s)
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 pt-1">
                          <Button
                            type="button"
                            variant={isSelected ? "primary" : "secondary"}
                            size="sm"
                            className="rounded-xl"
                          >
                            Customize <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Scissors className="w-8 h-8" />}
              title="Transform Long Videos into 9:16 Shorts"
              description="Paste any YouTube or TikTok link above. We'll automatically identify peak moments, reframe them vertically, and prepare them for 1-click publishing."
            />
          )}
        </div>
      )}

      {/* =========================================================================
          STEP 2: EDIT DETAILS (WITH LIVE 9:16 PREVIEW)
         ========================================================================= */}
      {currentStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Customization Controls */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border border-white/10 bg-[#12151f]/90 p-6 rounded-2xl shadow-xl space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="short-title-input" className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-cyan-400" />
                    Short Title
                  </label>
                  <span
                    className={`text-xs font-mono font-bold ${
                      ytTitle.length > 100
                        ? "text-rose-400"
                        : ytTitle.length > 85
                        ? "text-amber-400"
                        : "text-zinc-400"
                    }`}
                  >
                    {ytTitle.length} / 100
                  </span>
                </div>
                <Input
                  id="short-title-input"
                  value={ytTitle}
                  maxLength={110}
                  onChange={(e) => setYtTitle(e.target.value)}
                  placeholder="Enter a catchy title with #Shorts..."
                  className="h-11"
                />
                {ytTitle.length > 100 && (
                  <p className="text-xs text-rose-400 mt-1 font-medium">
                    YouTube titles cannot exceed 100 characters. Please shorten it.
                  </p>
                )}
              </div>

              {/* Hook Title Banner Text */}
              <div>
                <label htmlFor="hook-banner-input" className="block text-sm font-bold text-white mb-1.5">
                  Overlay Hook Headline (shown at top of video)
                </label>
                <Input
                  id="hook-banner-input"
                  value={hookTitle}
                  onChange={(e) => setHookTitle(e.target.value)}
                  placeholder="e.g. WAIT FOR THE END!"
                  className="h-11"
                />
              </div>

              {/* Layout Mode Selector */}
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  Vertical 9:16 Layout
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: "center_crop", label: "Center Crop", desc: "Full-screen action" },
                    { id: "blurred_background", label: "Blurred Canvas", desc: "Soft border glow" },
                    { id: "stacked", label: "Split Stack", desc: "Two camera angles" },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLayout(l.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        layout === l.id
                          ? "bg-cyan-500/15 border-cyan-500/50 text-white font-bold shadow-sm"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      <span className="block text-xs font-bold">{l.label}</span>
                      <span className="block text-[11px] text-zinc-400 mt-0.5">{l.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Kinetic Progress Bar & Music Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                <div>
                  <label htmlFor="bg-music-select" className="block text-xs font-bold text-zinc-300 mb-1.5">
                    Background Music
                  </label>
                  <select
                    id="bg-music-select"
                    value={backgroundMusic}
                    onChange={(e) => setBackgroundMusic(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <option value="none">Original Video Audio Only</option>
                    <option value="vice_city_synth">Vice City Neon Synth</option>
                    <option value="trap_beat">Viral Trap Hype Beat</option>
                    <option value="suspense_lofi">Dark Suspense Lofi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    Kinetic Progress Bar
                  </label>
                  <div className="flex items-center gap-2 h-10">
                    <button
                      type="button"
                      onClick={() => setProgressBar(!progressBar)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                        progressBar
                          ? "bg-amber-400/20 border-amber-400/40 text-amber-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400"
                      }`}
                    >
                      {progressBar ? "Yellow Bar Active" : "No Progress Bar"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Rendering Action Button */}
              <div className="pt-4 border-t border-white/5 space-y-3">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={() => handleRenderClip()}
                  disabled={isRendering || !selectedClip}
                  className="w-full text-base font-bold shadow-lg shadow-cyan-500/20"
                >
                  {isRendering ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Generating 9:16 Short with FFmpeg...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generate 9:16 Viral Short
                    </>
                  )}
                </Button>

                {renderedClip && (
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Viral Short Ready!</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={renderedClip.download_url}
                        download={renderedClip.filename}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-bold hover:bg-emerald-400 shadow-sm transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download 9:16 Short (MP4)
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleOpenYouTubeModal}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-medium text-xs h-8"
                      >
                        <Share2 className="w-3.5 h-3.5 mr-1" />
                        Post to YouTube Shorts
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setCurrentStep(3)}
                      >
                        Next: Choose Channel <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back to Moments
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={() => setCurrentStep(3)}
              >
                Continue to Channels <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>

          {/* Right Column: Live 9:16 Phone Mockup */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="sticky top-24 space-y-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block text-center">
                Live 9:16 Shorts Mockup
              </span>
              <ShortPreviewCard
                thumbnailUrl={selectedClip?.thumbnail_url || (selectedClip as any)?.thumbnail || undefined}
                videoUrl={renderedClip?.download_url}
                title={ytTitle}
                channelName={activeChannel?.channel_title || "Vice City Gaming"}
                channelThumbnail={activeChannel?.thumbnail_url}
                hookTitle={hookTitle}
                layout={layout}
                musicTrack={backgroundMusic === "none" ? "Original Audio" : backgroundMusic.replace("_", " ")}
              />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3: CHOOSE YOUTUBE CHANNEL
         ========================================================================= */}
      {currentStep === 3 && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="border border-white/10 bg-[#12151f]/90 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Youtube className="w-6 h-6 text-red-500" />
                Select Channel for Upload
              </h3>
              <p className="text-xs text-zinc-300 mt-1">
                Choose the brand channel to publish this Short to.
              </p>
            </div>

            {/* Crucial Multi-channel Tip Box */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Lightbulb className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Tip for Multiple Channels:</span>
              </div>
              <p className="text-zinc-200">
                On the Google screen, pick the other channel to connect a second one. Both channels will stay connected so you can switch anytime!
              </p>
            </div>

            {/* Channels Grid */}
            <div className="space-y-3">
              {channels.length === 0 ? (
                <div className="text-center py-8 p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40">
                  <Youtube className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-zinc-200">No YouTube channels connected yet</p>
                  <p className="text-xs text-zinc-400 mt-1 mb-4">
                    Connect your YouTube account to upload Shorts in one click.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setShowChannelModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Connect YouTube Channel
                  </Button>
                </div>
              ) : (
                channels.map((ch) => {
                  const isActive = ch.channel_id === (activeChannel?.channel_id || activeChannelId);

                  return (
                    <div
                      key={ch.channel_id}
                      onClick={async () => {
                        try {
                          await apiClient.selectYouTubeChannel(ch.channel_id);
                          setActiveChannelId(ch.channel_id);
                          success(`Switched active channel to ${ch.channel_title}`);
                        } catch {}
                      }}
                      className={`flex items-center justify-between gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        isActive
                          ? "bg-cyan-950/20 border-cyan-500/50 shadow-md shadow-cyan-500/10"
                          : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-700 shrink-0">
                          {ch.thumbnail_url ? (
                            <Image
                              src={ch.thumbnail_url}
                              alt={ch.channel_title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-white bg-red-600">
                              {ch.channel_title.substring(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white truncate">
                              {ch.channel_title}
                            </h4>
                            {isActive && (
                              <Badge variant="active" className="text-[10px] py-0 px-2">
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-zinc-300 truncate">
                            {ch.email || "Google Account"}
                          </p>
                          {ch.subscriber_count && (
                            <p className="text-[11px] text-zinc-400">
                              {ch.subscriber_count} subscribers
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isActive ? (
                          <div className="w-6 h-6 rounded-full bg-cyan-500 text-zinc-950 flex items-center justify-center font-bold">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400 hover:text-white font-medium">
                            Select
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowChannelModal(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Connect another channel
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setCurrentStep(4)}
                  disabled={channels.length === 0}
                >
                  Continue to Publish <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* =========================================================================
          STEP 4: PUBLISH TO YOUTUBE SHORTS
         ========================================================================= */}
      {currentStep === 4 && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="border border-white/10 bg-[#12151f]/90 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-cyan-400" />
                  Publish Short to YouTube
                </h3>
                <p className="text-xs text-zinc-300 mt-1">
                  Upload directly to YouTube Shorts with your chosen settings.
                </p>
              </div>

              {activeChannel && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="relative w-5 h-5 rounded-full overflow-hidden bg-red-600 shrink-0">
                    {activeChannel.thumbnail_url && (
                      <Image
                        src={activeChannel.thumbnail_url}
                        alt={activeChannel.channel_title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                  <span className="text-xs font-bold text-white truncate max-w-[120px]">
                    {activeChannel.channel_title}
                  </span>
                </div>
              )}
            </div>

            {/* Publishing Success Result */}
            {ytPublishResult?.youtube_url ? (
              <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 text-center space-y-4 animate-in zoom-in-95">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-white">Your Short is Live on YouTube!</h4>
                  <p className="text-xs text-zinc-300 max-w-sm mx-auto">
                    Video published successfully to {activeChannel?.channel_title || "your channel"}.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <a
                    href={ytPublishResult.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all"
                  >
                    <Youtube className="w-4 h-4" />
                    Watch on YouTube Shorts
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="w-full sm:w-auto"
                  >
                    {copiedLink ? <Check className="w-4 h-4 mr-1 text-emerald-400" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copiedLink ? "Copied!" : "Copy Link"}
                  </Button>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setYtPublishResult(null);
                      setCurrentStep(1);
                    }}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Publish Another Short
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePublishToYouTube} className="space-y-5">
                {/* Short Title */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-white">
                      Title
                    </label>
                    <span className="text-[11px] font-mono text-zinc-400">{ytTitle.length}/100</span>
                  </div>
                  <Input
                    value={ytTitle}
                    onChange={(e) => setYtTitle(e.target.value)}
                    maxLength={100}
                    placeholder="Short Title..."
                    className="h-11"
                  />
                </div>

                {/* Privacy Visibility */}
                <div>
                  <label className="block text-xs font-bold text-white mb-2">
                    Privacy Setting
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: "public", label: "Public", desc: "Visible to everyone" },
                      { id: "unlisted", label: "Unlisted", desc: "Link holders only" },
                      { id: "private", label: "Private", desc: "Only you" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setYtPrivacy(p.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          ytPrivacy === p.id
                            ? "bg-cyan-500/15 border-cyan-500/50 text-white font-bold"
                            : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        <span className="block text-xs font-bold">{p.label}</span>
                        <span className="block text-[10px] text-zinc-400">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description & Hashtags */}
                <div>
                  <label className="block text-xs font-bold text-white mb-1.5">
                    Description & Tags
                  </label>
                  <textarea
                    rows={4}
                    value={ytDescription}
                    onChange={(e) => setYtDescription(e.target.value)}
                    className="w-full p-3 rounded-xl bg-zinc-900/80 border border-zinc-700 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none font-mono"
                  />
                </div>

                {/* Upload Progress Bar */}
                {isPublishingYt && (
                  <div className="space-y-2 p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-cyan-300 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading Short to YouTube...
                      </span>
                      <span className="text-cyan-400 font-mono">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-red-500 transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {ytError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{ytError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(3)}
                    disabled={isPublishingYt}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isPublishingYt || !renderedClip}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 shadow-lg shadow-red-600/25"
                  >
                    {isPublishingYt ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Publishing Short...
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4 mr-2" />
                        Post to YouTube Shorts
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}

      {/* YouTube Channel Management Modal */}
      <ChannelManagerModal
        isOpen={showChannelModal}
        onClose={() => setShowChannelModal(false)}
        channels={channels}
        activeChannelId={activeChannelId}
        onChannelsUpdated={refreshChannels}
      />

      {/* Shorts Settings Modal (Preserved for backwards compatibility with legacy tests) */}
      <Modal
        isOpen={showYouTubeModal}
        onClose={() => setShowYouTubeModal(false)}
        maxWidth="md"
        title="Post to YouTube Shorts"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
            <span className="text-zinc-400 font-medium">Channel Status:</span>
            {ytAuthStatus?.connected ? (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Connected: {ytAuthStatus.channel_title || "My Channel"}
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                {ytAuthStatus?.configured ? "Not Connected" : "Credentials Required"}
              </Badge>
            )}
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
            <strong>Multiple Channels Tip:</strong> On the Google screen, pick the other channel to connect a second one.
          </div>

          <form onSubmit={handlePublishToYouTube} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-zinc-300">Video Title</label>
                <span className="text-[11px] text-zinc-500">{ytTitle.length}/100</span>
              </div>
              <Input
                value={ytTitle}
                onChange={(e) => setYtTitle(e.target.value)}
                placeholder="Shorts Title"
                className="h-10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Privacy Status</label>
              <div className="grid grid-cols-3 gap-2">
                {(["public", "unlisted", "private"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setYtPrivacy(p)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium capitalize border transition-all ${
                      ytPrivacy === p
                        ? "bg-red-600/20 border-red-500/60 text-red-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    {p === "public" ? "Public (Shorts)" : p}
                  </button>
                ))}
              </div>
            </div>

            {ytError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                {ytError}
              </div>
            )}

            {ytPublishResult && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 animate-in fade-in-0 duration-200">
                <div className="flex items-center gap-2 text-emerald-300 font-medium text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>🎉 Published to YouTube Shorts!</span>
                </div>
                <p className="text-xs text-zinc-300">
                  Your short is live at:{" "}
                  <a
                    href={ytPublishResult.youtube_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-red-400 hover:underline font-medium inline-flex items-center gap-1"
                  >
                    {ytPublishResult.youtube_url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowYouTubeModal(false)}
              >
                Close
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPublishingYt}
                className="bg-red-600 hover:bg-red-500 text-white font-bold"
              >
                {isPublishingYt ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 mr-1.5" />
                    Publish to YouTube Shorts Now
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
