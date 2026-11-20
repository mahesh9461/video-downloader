"use client";

import { useState, useEffect } from "react";
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
  Music2,
  TrendingUp,
  Zap,
  Upload,
  Share2,
  ExternalLink,
  Loader2,
  Settings,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import {
  ClipCandidate,
  ClipRenderResponse,
  YouTubeAuthStatus,
  YouTubePublishResponse,
} from "@/lib/types";
import { formatDuration, formatFileSize } from "@/lib/utils";

export function ViralClips() {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const [clips, setClips] = useState<ClipCandidate[]>([]);

  // Selected clip for rendering
  const [selectedClip, setSelectedClip] = useState<ClipCandidate | null>(null);
  const [layout, setLayout] = useState<string>("center_crop");
  const [showOverlay, setShowOverlay] = useState<boolean>(false);
  const [hookTitle, setHookTitle] = useState<string>("");
  const [hookStyle, setHookStyle] = useState<string>("none");
  const [backgroundMusic, setBackgroundMusic] = useState<string>("none");
  const [musicVolume, setMusicVolume] = useState<number>(0.12);
  const [progressBar, setProgressBar] = useState<boolean>(true);
  const [progressBarColor, setProgressBarColor] = useState<string>("yellow");
  const [burnCaptions, setBurnCaptions] = useState<boolean>(false);
  const [captionStyle, setCaptionStyle] = useState<string>("viral_yellow");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Inline previewing clip ID
  const [previewingClipId, setPreviewingClipId] = useState<string | null>(null);

  // Render status
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedClip, setRenderedClip] = useState<ClipRenderResponse | null>(null);

  // Free Open LLM & hook state
  const [isGeneratingAiHook, setIsGeneratingAiHook] = useState(false);
  const [aiTranscript, setAiTranscript] = useState<string | null>(null);
  const [aiHookSource, setAiHookSource] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<"deepseek" | "free_open_llm" | "ollama">("deepseek");

  // YouTube Shorts Publishing state
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [ytAuthStatus, setYtAuthStatus] = useState<YouTubeAuthStatus | null>(null);
  const [ytTitle, setYtTitle] = useState("");
  const [ytDescription, setYtDescription] = useState("");
  const [ytPrivacy, setYtPrivacy] = useState<"public" | "unlisted" | "private">("public");
  const [ytAccessToken, setYtAccessToken] = useState("");
  const [isPublishingYt, setIsPublishingYt] = useState(false);
  const [ytPublishResult, setYtPublishResult] = useState<YouTubePublishResponse | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);

  const [showCredsConfig, setShowCredsConfig] = useState(false);
  const [ytClientId, setYtClientId] = useState("");
  const [ytClientSecret, setYtClientSecret] = useState("");
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [suggestedUrl, setSuggestedUrl] = useState<string | null>(null);
  const [useDefaultDescription, setUseDefaultDescription] = useState<boolean>(true);

  useEffect(() => {
    // 1. Fetch YouTube connection status immediately on load/refresh so connection persists
    apiClient
      .getYouTubeStatus()
      .then((status) => {
        if (status) setYtAuthStatus(status);
      })
      .catch(() => {});

    // 2. Restore cached URL and analyzed clips from localStorage/sessionStorage
    if (typeof window !== "undefined") {
      try {
        const lastViralUrl = localStorage.getItem("saveit_viral_url");
        const lastUrl = localStorage.getItem("saveit_last_url");
        const linkToUse = lastViralUrl || lastUrl;
        if (linkToUse) {
          setUrl(linkToUse);
        } else if (lastUrl) {
          setSuggestedUrl(lastUrl);
        }

        const cachedClips = sessionStorage.getItem("saveit_viral_clips");
        const cachedTitle = sessionStorage.getItem("saveit_viral_title");
        if (cachedClips) {
          const parsed = JSON.parse(cachedClips);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setClips(parsed);
            if (cachedTitle) setVideoTitle(cachedTitle);
            setSelectedClip(parsed[0]);
          }
        }
      } catch {}

      // 3. Check if returning from Google OAuth callback
      const params = new URLSearchParams(window.location.search);
      if (params.get("youtube_auth") === "success") {
        setShowYouTubeModal(true);
      } else if (params.get("youtube_auth") === "error") {
        setYtError(params.get("error_detail") || "Failed to authenticate with Google.");
        setShowYouTubeModal(true);
      }
    }
  }, []);

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("saveit_viral_url", newUrl);
        localStorage.setItem("saveit_last_url", newUrl);
      } catch {}
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ytClientId.trim() || !ytClientSecret.trim()) {
      setYtError("Both Client ID and Client Secret are required.");
      return;
    }
    setIsSavingCreds(true);
    setYtError(null);
    try {
      const res = await apiClient.configureYouTubeOAuth(ytClientId.trim(), ytClientSecret.trim());
      if (res?.youtube_status) {
        setYtAuthStatus(res.youtube_status);
      }
      setShowCredsConfig(false);
    } catch (err: any) {
      setYtError(err?.message || "Failed to save OAuth credentials.");
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handleDisconnectYouTube = async () => {
    try {
      await apiClient.disconnectYouTube();
      const status = await apiClient.getYouTubeStatus();
      setYtAuthStatus(status);
    } catch (err: any) {
      setYtError(err?.message || "Failed to disconnect channel.");
    }
  };

  const handleOpenYouTubeModal = async () => {
    setShowYouTubeModal(true);
    setYtError(null);
    setYtPublishResult(null);

    // Automatically set title from the best AI hook
    const bestAiHook =
      renderedClip?.hook_title?.trim() ||
      selectedClip?.hook_title?.trim() ||
      (clips.length > 0 && clips[0]?.hook_title?.trim()) ||
      videoTitle ||
      "Viral Short";
    const initialTitle = bestAiHook.toLowerCase().includes("#shorts") ? bestAiHook : `${bestAiHook} #Shorts`;
    setYtTitle(initialTitle);

    // Default to using YouTube Channel Upload Defaults (no manual description required)
    setUseDefaultDescription(true);
    setYtDescription("");

    try {
      const status = await apiClient.getYouTubeStatus();
      setYtAuthStatus(status);
    } catch {
      // Ignored if offline
    }
  };

  const handlePublishToYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renderedClip) return;
    if (!ytTitle.trim()) {
      setYtError("Video title is required.");
      return;
    }

    setIsPublishingYt(true);
    setYtError(null);
    setYtPublishResult(null);

    try {
      const res = await apiClient.publishToYouTube({
        filename: renderedClip.filename,
        title: ytTitle.trim(),
        description: useDefaultDescription ? "" : ytDescription.trim(),
        privacy: ytPrivacy,
        access_token: ytAccessToken.trim() || undefined,
      });
      setYtPublishResult(res);
    } catch (err: any) {
      setYtError(err?.message || "Failed to publish video to YouTube Shorts.");
    } finally {
      setIsPublishingYt(false);
    }
  };

  const validateVideoUrl = (inputUrl: string): string | null => {
    try {
      const parsed = new URL(inputUrl);
      const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");

      // YouTube search results page
      if (host === "youtube.com" && parsed.pathname === "/results") {
        return "That's a YouTube search results page, not a video. Please open a specific video and paste its URL (e.g. youtube.com/watch?v=...).";
      }
      // YouTube channel or playlist page
      if (
        host === "youtube.com" &&
        (parsed.pathname.startsWith("/@") ||
          parsed.pathname.startsWith("/channel/") ||
          parsed.pathname.startsWith("/playlist") ||
          parsed.pathname.startsWith("/c/") ||
          parsed.pathname === "/")
      ) {
        return "Please paste a direct video URL (e.g. youtube.com/watch?v=... or youtu.be/...), not a channel or playlist page.";
      }
      // YouTube watch URL without video ID
      if (host === "youtube.com" && parsed.pathname === "/watch" && !parsed.searchParams.get("v")) {
        return "Invalid YouTube URL — the video ID (v=) is missing.";
      }
    } catch {
      return "Please enter a valid URL.";
    }
    return null;
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Client-side URL validation before hitting the API
    const urlError = validateVideoUrl(url.trim());
    if (urlError) {
      setAnalysisError(urlError);
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
        setHookTitle("");
      }
    } catch (err: any) {
      setAnalysisError(err?.message || "Failed to analyze video. Please check the URL and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setAnalysisError(null);
    setClips([]);
    setSelectedClip(null);
    setRenderedClip(null);

    try {
      const formData = new FormData();
      formData.append("video", file);
      const uploadRes = await apiClient.uploadClipVideo(formData);
      setUrl(uploadRes.file_id);
      setVideoTitle(uploadRes.filename);

      setIsAnalyzing(true);
      const res = await apiClient.analyzeClips(uploadRes.file_id, 30, 60, 4);
      setClips(res.clips);
      if (res.clips.length > 0) {
        setSelectedClip(res.clips[0]);
        setHookTitle("");
      }
    } catch (err: any) {
      setAnalysisError(err?.message || "Failed to upload or analyze local video file.");
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  const handleSelectClip = (clip: ClipCandidate) => {
    setSelectedClip(clip);
    setHookTitle("");
    setAiTranscript(null);
    setAiHookSource(null);
    setRenderedClip(null);
  };

  const handleQuickRender = async (clip: ClipCandidate) => {
    setSelectedClip(clip);
    setIsRendering(true);
    setRenderError(null);
    setRenderedClip(null);

    try {
      const res = await apiClient.renderClip({
        url: url.trim(),
        start_time: clip.start_time,
        end_time: clip.end_time,
        layout: "center_crop", // Edge-to-edge full screen 9:16 vertical
        hook_title: "",
        hook_style: "none", // Clean video without obstructing boxes
        background_music: "none", // Preserve pure original soundtrack/audio
        music_volume: 0.12,
        progress_bar: true,
        progress_bar_color: progressBarColor,
      });
      setRenderedClip(res);
    } catch (err: any) {
      setRenderError(err?.message || "Failed to render viral short. Please try again.");
    } finally {
      setIsRendering(false);
    }
  };

  const handleGenerateAiHook = async () => {
    if (!selectedClip) return;
    setIsGeneratingAiHook(true);
    try {
      const res = await apiClient.generateClipAiHook({
        url: url.trim(),
        start_time: selectedClip.start_time,
        end_time: selectedClip.end_time,
        video_title: videoTitle,
        clip_dialogue: selectedClip.summary,
        provider: aiProvider,
      });
      setHookTitle(res.hook_title);
      setAiTranscript(res.transcript);
      setAiHookSource(res.source);
      setShowOverlay(true);
      if (hookStyle === "none") {
        setHookStyle("hormozi_bold");
      }
    } catch (err: any) {
      console.error("Failed to generate AI hook:", err);
    } finally {
      setIsGeneratingAiHook(false);
    }
  };

  const handleRender = async () => {
    if (!selectedClip) return;

    setIsRendering(true);
    setRenderError(null);

    try {
      const res = await apiClient.renderClip({
        url: url.trim(),
        start_time: selectedClip.start_time,
        end_time: selectedClip.end_time,
        layout,
        hook_title: showOverlay ? hookTitle.trim() : "",
        hook_style: showOverlay ? hookStyle : "none",
        background_music: backgroundMusic,
        music_volume: musicVolume,
        progress_bar: progressBar,
        progress_bar_color: progressBarColor,
        burn_captions: burnCaptions,
        caption_style: captionStyle,
      });
      setRenderedClip(res);
    } catch (err: any) {
      setRenderError(err?.message || "Failed to render viral short. Please try again.");
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 animate-in fade-in-0 duration-300">
      {/* Persistent YouTube Connected Status Banner */}
      {ytAuthStatus?.connected && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-950/20 text-xs shadow-sm">
          <div className="flex items-center gap-2 text-red-300 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-400">YouTube Channel:</span>
            <span className="text-white font-semibold">{ytAuthStatus.channel_title || "Connected YouTube Channel"}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenYouTubeModal}
              className="text-red-400 hover:text-red-300 underline font-medium"
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

      {/* Search / Ingest Bar */}
      <form onSubmit={handleAnalyze} className="relative space-y-2">
        <div className="flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2.5 px-3 w-full sm:flex-1">
            <Scissors className="w-5 h-5 text-violet-400 shrink-0" />
            <input
              type="text"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="Paste long YouTube video or podcast URL (e.g. youtube.com/watch?v=...)"
              disabled={isAnalyzing}
              className="w-full bg-transparent text-white placeholder-zinc-500 text-sm focus:outline-none py-2"
            />
          </div>
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700/80 bg-zinc-800/80 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 shrink-0 transition-colors">
            <Upload className="w-3.5 h-3.5 text-violet-400" />
            <span>{isUploading ? "Uploading..." : "Upload Video"}</span>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={handleFileUpload}
              disabled={isUploading || isAnalyzing}
              className="hidden"
            />
          </label>
          <Button
            type="submit"
            variant="gradient"
            size="default"
            disabled={isAnalyzing || !url.trim()}
            className="w-full sm:w-auto font-semibold shrink-0"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Analyzing Virality...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Find Viral Moments
              </span>
            )}
          </Button>
        </div>

        {/* Suggest previously used link if input is empty */}
        {suggestedUrl && !url && (
          <div className="flex items-center gap-2 text-xs text-zinc-400 px-2 py-1">
            <span>💡 Recent link:</span>
            <button
              type="button"
              onClick={() => handleUrlChange(suggestedUrl)}
              className="text-violet-400 hover:text-violet-300 underline font-medium truncate max-w-xs sm:max-w-md text-left"
            >
              {suggestedUrl}
            </button>
            <button
              type="button"
              onClick={() => handleUrlChange(suggestedUrl)}
              className="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 font-semibold text-[11px]"
            >
              Use Link
            </button>
          </div>
        )}
      </form>

      {/* Analysis Error */}
      {analysisError && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 flex items-start gap-3 text-sm text-red-300">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{analysisError}</span>
        </div>
      )}

      {/* Clips Discovery Grid */}
      {clips.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-white text-lg tracking-tight flex items-center gap-2">
                <span>Top Viral Moments</span>
                <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  100M+ Virality Model
                </span>
              </h3>
              <p className="text-xs text-zinc-400 truncate max-w-md">{videoTitle}</p>
            </div>
            <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-full font-medium w-fit">
              {clips.length} High-Retention Slices Ready
            </span>
          </div>

          {/* ⚡ Instant 1-Click Hero Card for #1 Most Viral Moment */}
          {clips[0] && (
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-violet-950/60 via-zinc-900/90 to-amber-950/40 border border-amber-500/30 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="space-y-2 text-left w-full sm:w-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-black shadow-md">
                    <Flame className="w-3.5 h-3.5 fill-black" />
                    #1 HIGHEST VIRAL MOMENT ({clips[0].viral_score}/100)
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                    {clips[0].retention_rate || "96% Retention"}
                  </span>
                </div>
                <h3 className="text-white font-bold text-base sm:text-lg line-clamp-1">{clips[0].hook_title}</h3>
                <p className="text-xs text-zinc-400 max-w-xl">
                  {formatDuration(clips[0].start_time)} → {formatDuration(clips[0].end_time)} • Full-Screen 9:16 Vertical • Kinetic Neon Timeline Bar
                </p>
              </div>
              <Button
                variant="gradient"
                size="lg"
                onClick={() => handleQuickRender(clips[0])}
                disabled={isRendering}
                className="w-full sm:w-auto font-bold shrink-0 shadow-lg shadow-violet-500/25 px-6"
              >
                {isRendering && selectedClip?.clip_id === clips[0].clip_id ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Generating Short...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Download Most Viral Clip (MP4)
                  </span>
                )}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {clips.map((clip) => {
              const isSelected = selectedClip?.clip_id === clip.clip_id;
              const isPreviewing = previewingClipId === clip.clip_id;

              return (
                <Card
                  key={clip.clip_id}
                  className={`border transition-all overflow-hidden text-left hover:border-violet-500/50 flex flex-col justify-between ${
                    isSelected
                      ? "border-violet-500 bg-violet-500/[0.08] shadow-xl shadow-violet-500/10 ring-1 ring-violet-500/30"
                      : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80"
                  }`}
                >
                  <div>
                    {/* Visual Video Thumbnail & Preview Frame */}
                    <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden group">
                      {clip.thumbnail_url ? (
                        <img
                          src={clip.thumbnail_url}
                          alt={clip.hook_title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-950/40 via-zinc-900 to-black flex items-center justify-center">
                          <Play className="w-10 h-10 text-violet-500/40" />
                        </div>
                      )}

                      {/* Dark Vignette Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/60 pointer-events-none" />

                      {/* Top Badges: Virality Score & Duration */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/90 text-black shadow-md backdrop-blur-sm">
                          <Flame className="w-3.5 h-3.5 fill-black text-black" />
                          {clip.viral_score}/100 Virality
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-black/80 text-white border border-white/10 backdrop-blur-sm flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          {formatDuration(clip.duration)}
                        </span>
                      </div>

                      {/* Bottom Badges: Timestamps & Projected Retention */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] pointer-events-none">
                        <span className="px-2 py-0.5 rounded bg-black/80 text-zinc-300 border border-white/10 font-mono">
                          {formatDuration(clip.start_time)} → {formatDuration(clip.end_time)}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/90 text-black font-bold shadow-sm">
                          {clip.retention_rate || "95% Retention"}
                        </span>
                      </div>

                      {/* Center Play / Quick Preview Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewingClipId(isPreviewing ? null : clip.clip_id);
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-violet-600/90 hover:bg-violet-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xl shadow-black/80 backdrop-blur-sm border border-violet-400/40"
                        >
                          <Play className="w-3.5 h-3.5 fill-white text-white" />
                          {isPreviewing ? "Close Preview" : "Quick Preview"}
                        </button>
                      </div>
                    </div>

                    {/* Quick Preview Player if active */}
                    {isPreviewing && (
                      <div className="p-3 bg-zinc-950 border-b border-zinc-800 space-y-2 animate-in fade-in-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-violet-400 font-semibold flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5" />
                            Live Clip Window Preview
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {formatDuration(clip.start_time)} to {formatDuration(clip.end_time)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300">
                          <p className="font-medium text-white mb-1">Snippet Dialogue / Audio:</p>
                          <p className="italic text-zinc-400 leading-relaxed">"{clip.summary}"</p>
                        </div>
                      </div>
                    )}

                    {/* Card Content & Viral Attributes */}
                    <div className="p-4 space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-white text-sm line-clamp-1">
                            {clip.hook_title}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 shrink-0">
                            {clip.hook_rating || "Top 1% Virality"}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {clip.summary}
                        </p>
                      </div>

                      <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 pt-1">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="truncate">{clip.reason}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions: 1-Click Short + Customize */}
                  <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickRender(clip)}
                      disabled={isRendering}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center gap-1 shadow-md shadow-violet-600/30 transition-all disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      1-Click Short
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectClip(clip)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                        isSelected
                          ? "bg-zinc-800 border border-violet-500/60 text-violet-300"
                          : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800"
                      }`}
                    >
                      Customize
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Customization & Render Panel */}
      {selectedClip && !renderedClip && (
        <Card className="border-zinc-800 bg-zinc-900/70 overflow-hidden shadow-2xl">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                  Step 2 • Customization
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">Render 9:16 Vertical Short</h3>
              </div>
              <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-300">
                {formatDuration(selectedClip.start_time)} → {formatDuration(selectedClip.end_time)}
              </Badge>
            </div>

            {/* Layout Options */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-violet-400" />
                Vertical 9:16 Layout
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => setLayout("center_crop")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    layout === "center_crop"
                      ? "border-violet-500 bg-violet-500/10 text-white shadow-sm shadow-violet-500/10"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-medium text-xs sm:text-sm text-white">Full Screen</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Smart 9:16 Action</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout("split_screen")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    layout === "split_screen"
                      ? "border-violet-500 bg-violet-500/10 text-white shadow-sm shadow-violet-500/10"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-medium text-xs sm:text-sm text-white">Split Screen</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Ssemble Viral Stack</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout("blurred_background")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    layout === "blurred_background"
                      ? "border-violet-500 bg-violet-500/10 text-white shadow-sm shadow-violet-500/10"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-medium text-xs sm:text-sm text-white">Blurred Backdrop</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Opus / Ssemble Canvas</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout("fit_black")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    layout === "fit_black"
                      ? "border-violet-500 bg-violet-500/10 text-white shadow-sm shadow-violet-500/10"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-medium text-xs sm:text-sm text-white">Letterbox</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Black Canvas Padding</div>
                </button>
              </div>
            </div>

            {/* Hook Headline Input & Styles */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-violet-400" />
                  Top Headline Overlay
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showOverlay;
                      setShowOverlay(next);
                      if (next && hookStyle === "none") {
                        setHookStyle("yellow_box");
                      }
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      showOverlay
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {showOverlay ? "Overlay Enabled" : "No Overlay (Clean Video)"}
                  </button>
                </div>
              </div>

              {/* Free Open AI Hook Generator Action */}
              <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/25 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-violet-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      Free Open-Source AI Hook Generator
                    </span>
                    <p className="text-[11px] text-zinc-400">
                      Extracts spoken dialogue & uses 100% free open models (Mistral / Llama) to craft viral headlines. Zero keys or subscriptions required!
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAiHook}
                    disabled={isGeneratingAiHook}
                    className="border-violet-500/40 text-violet-300 hover:bg-violet-600/20 text-xs font-semibold"
                  >
                    {isGeneratingAiHook ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                        Generating Hook...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                        Generate Free AI Hook
                      </span>
                    )}
                  </Button>
                </div>

                {/* Model selection pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-violet-500/15 text-[11px]">
                  <span className="text-zinc-500 text-[10px] uppercase font-semibold mr-1">Free Model Engine:</span>
                  {[
                    { id: "deepseek", label: "DeepSeek (Free AI)" },
                    { id: "free_open_llm", label: "Mistral / Llama" },
                    { id: "ollama", label: "Local Ollama" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAiProvider(p.id as any)}
                      className={`px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                        aiProvider === p.id
                          ? "bg-violet-600/40 border border-violet-500/60 text-white"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {aiTranscript && (
                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80 space-y-1 text-xs">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Detected Dialogue Transcript:</span>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                      {aiHookSource === "deepseek"
                        ? "DeepSeek AI (Free)"
                        : aiHookSource === "free_open_llm"
                        ? "Free Open LLM"
                        : aiHookSource === "ollama"
                        ? "Local Ollama"
                        : "Local NLP Engine"}
                    </Badge>
                  </span>
                  <p className="text-zinc-300 italic">"{aiTranscript}"</p>
                </div>
              )}

              {showOverlay ? (
                <div className="space-y-3 pt-1 animate-in fade-in-0 duration-200">
                  <input
                    type="text"
                    value={hookTitle}
                    onChange={(e) => setHookTitle(e.target.value)}
                    placeholder="Enter headline banner text..."
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {[
                      { id: "hormozi_bold", label: "⚡ Hormozi Kinetic", desc: "Yellow Bold Stroke" },
                      { id: "mrbeast_urgency", label: "🔥 MrBeast Alert", desc: "Red Pill Banner" },
                      { id: "tiktok_trending", label: "📱 TikTok Trending", desc: "Frosted Glass Pill" },
                      { id: "cinematic_glow", label: "✨ Cinematic Glow", desc: "Drop Shadow (No Box)" },
                      { id: "yellow_box", label: "🟨 Classic Box", desc: "Contrast Box" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setHookStyle(s.id)}
                        className={`text-left p-2.5 rounded-xl border transition-all ${
                          hookStyle === s.id
                            ? "border-violet-500 bg-violet-500/20 text-white shadow-sm ring-1 ring-violet-500/50"
                            : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-white hover:border-zinc-700"
                        }`}
                      >
                        <div className="text-xs font-semibold">{s.label}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 bg-zinc-950/40 border border-zinc-800/80 rounded-xl px-3.5 py-2.5">
                  Clean video mode active: No top headline banner or text box will be overlaid on your clip.
                </p>
              )}
            </div>

            {/* Kinetic Dynamic Progress Bar (100M+ Virality Driver) */}
            <div className="space-y-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/50">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Kinetic Bottom Progress Bar
                  </label>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Neon animated timeline line that drives TikTok/Reels completion rate.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProgressBar(!progressBar)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    progressBar
                      ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                      : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {progressBar ? "Enabled" : "Disabled"}
                </button>
              </div>

              {progressBar && (
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-zinc-400 font-medium">Bar Color:</span>
                  {[
                    { id: "yellow", label: "Neon Yellow", color: "bg-[#FFE600]" },
                    { id: "cyan", label: "Cyber Cyan", color: "bg-[#00F0FF]" },
                    { id: "violet", label: "Electric Violet", color: "bg-[#BD00FF]" },
                    { id: "red", label: "Fire Red", color: "bg-[#FF2A2A]" },
                    { id: "white", label: "Crisp White", color: "bg-white" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setProgressBarColor(c.id)}
                      className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                        progressBarColor === c.id
                          ? "border-amber-400/80 bg-amber-500/10 text-white font-medium shadow-sm"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${c.color}`} />
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ssemble Viral Subtitles & Auto-Captions */}
            <div className="space-y-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/50">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-amber-400" />
                    Ssemble-Style Viral Captions (Subtitles)
                  </label>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Burn-in high-engagement animated captions in TikTok & Reels safe zone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBurnCaptions(!burnCaptions)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    burnCaptions
                      ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                      : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {burnCaptions ? "Captions ON" : "Captions OFF"}
                </button>
              </div>

              {burnCaptions && (
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-zinc-400 font-medium">Caption Style:</span>
                  {[
                    { id: "viral_yellow", label: "⚡ Viral Yellow (Ssemble / Hormozi)", desc: "Yellow Bold Stroke" },
                    { id: "clean_white", label: "✨ Clean White", desc: "Crisp Drop Shadow" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCaptionStyle(c.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${
                        captionStyle === c.id
                          ? "border-amber-400/80 bg-amber-500/10 text-white font-medium shadow-sm ring-1 ring-amber-400/30"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Background Music & Volume */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Music2 className="w-3.5 h-3.5 text-violet-400" />
                  Background Music (Ducked)
                </label>
                <span className="text-xs text-zinc-400">{Math.round(musicVolume * 100)}% Volume</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: "lofi_chill", label: "Lo-Fi Chill" },
                  { id: "energetic_beat", label: "Energetic" },
                  { id: "dramatic_suspense", label: "Suspense" },
                  { id: "ambient_drone", label: "Ambient" },
                  { id: "none", label: "None" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setBackgroundMusic(m.id)}
                    className={`p-2.5 rounded-xl border text-center text-xs transition-all ${
                      backgroundMusic === m.id
                        ? "border-violet-500 bg-violet-500/20 text-white font-medium shadow-sm"
                        : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {backgroundMusic !== "none" && (
                <div className="pt-2">
                  <input
                    type="range"
                    min="0.05"
                    max="0.30"
                    step="0.01"
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                    className="w-full accent-violet-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Render Error */}
            {renderError && (
              <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{renderError}</span>
              </div>
            )}

            {/* Render Action Button */}
            <Button
              variant="gradient"
              size="lg"
              onClick={handleRender}
              disabled={isRendering}
              className="w-full font-semibold"
            >
              {isRendering ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Generating 9:16 Short with FFmpeg...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Generate 9:16 Viral Short
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rendered Short Player & Download */}
      {renderedClip && (
        <Card className="border-emerald-500/30 bg-zinc-900/80 overflow-hidden shadow-2xl animate-in fade-in-0 duration-300">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">Viral Short Ready!</h3>
                <p className="text-xs text-zinc-400">
                  9:16 Vertical MP4 • {formatDuration(renderedClip.duration)} • {formatFileSize(renderedClip.filesize)}
                </p>
              </div>
            </div>

            {/* Vertical Video Player */}
            <div className="flex justify-center">
              <div className="w-64 sm:w-72 aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-2xl">
                <video
                  src={renderedClip.download_url}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button variant="gradient" className="w-full sm:flex-1" asChild>
                <a
                  href={renderedClip.download_url}
                  download={renderedClip.filename.endsWith(".mp4") ? renderedClip.filename : `${renderedClip.filename}.mp4`}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download 9:16 Short (MP4)
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={handleOpenYouTubeModal}
                className="w-full sm:w-auto border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-medium"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Post to YouTube Shorts
              </Button>
              <Button
                variant="outline"
                onClick={() => setRenderedClip(null)}
                className="w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Customize Another
              </Button>
            </div>

            {/* YouTube Shorts Direct Publisher Panel */}
            {showYouTubeModal && (
              <div className="border border-red-500/30 bg-red-950/20 rounded-2xl p-5 sm:p-6 space-y-5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between pb-3 border-b border-red-500/20">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
                      <Play className="w-4 h-4 fill-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">Post to YouTube Shorts</h4>
                      <p className="text-xs text-zinc-400">Directly publish your 9:16 viral clip to your YouTube channel</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowYouTubeModal(false)}
                    className="text-zinc-400 hover:text-white"
                  >
                    Close
                  </Button>
                </div>

                {/* Channel Auth Status */}
                <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Channel Status:</span>
                    {ytAuthStatus?.connected ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Connected: {ytAuthStatus.channel_title || "My Channel"}
                        </Badge>
                        <button
                          type="button"
                          onClick={handleDisconnectYouTube}
                          className="text-[11px] text-zinc-500 hover:text-red-400 underline"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                        {ytAuthStatus?.configured ? "Not Connected" : "Credentials Required"}
                      </Badge>
                    )}
                  </div>

                  {!ytAuthStatus?.connected && (
                    <div className="space-y-3 pt-1">
                      {ytAuthStatus?.configured && ytAuthStatus?.auth_url ? (
                        <Button
                          size="sm"
                          className="w-full bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs h-9 shadow-md flex items-center justify-center gap-2"
                          asChild
                        >
                          <a href={ytAuthStatus.auth_url}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                              />
                            </svg>
                            Sign In with Google & Authorize YouTube
                          </a>
                        </Button>
                      ) : null}

                      {/* Google Credentials Setup Section */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setShowCredsConfig(!showCredsConfig)}
                          className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white transition-colors"
                        >
                          <Settings className="w-3 h-3" />
                          <span>{showCredsConfig ? "Hide" : "Setup"} Google OAuth Credentials (Client ID & Secret)</span>
                        </button>

                        {showCredsConfig && (
                          <div className="mt-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2.5">
                            <p className="text-[11px] text-zinc-400">
                              Create free credentials in Google Cloud Console &rarr; OAuth 2.0 Client ID (Web Application) with redirect URI: <code className="text-zinc-300">http://localhost:3000/api/youtube/callback</code>
                            </p>
                            <input
                              type="text"
                              placeholder="Google Client ID (.apps.googleusercontent.com)"
                              value={ytClientId}
                              onChange={(e) => setYtClientId(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50"
                            />
                            <input
                              type="password"
                              placeholder="Google Client Secret"
                              value={ytClientSecret}
                              onChange={(e) => setYtClientSecret(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={isSavingCreds}
                              onClick={handleSaveCredentials}
                              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs h-7"
                            >
                              {isSavingCreds ? "Saving..." : "Save & Generate Google Auth Link"}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Manual token fallback */}
                      <div className="pt-1 space-y-1">
                        <label className="text-[11px] text-zinc-400">
                          Or paste Access Token manually (optional):
                        </label>
                        <input
                          type="password"
                          placeholder="ya29.a0AfH..."
                          value={ytAccessToken}
                          onChange={(e) => setYtAccessToken(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Form fields */}
                <form onSubmit={handlePublishToYouTube} className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Short Title (from AI Best Hook)</span>
                      </label>
                      <span className="text-[11px] text-zinc-500">{ytTitle.length}/100</span>
                    </div>
                    <input
                      type="text"
                      value={ytTitle}
                      onChange={(e) => setYtTitle(e.target.value)}
                      maxLength={100}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                      placeholder="My Viral Short #Shorts"
                      required
                    />
                    <div className="flex justify-between text-[11px] text-zinc-500">
                      <span>Auto-filled from top viral hook with #Shorts tag</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-300">Description</label>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={useDefaultDescription}
                          onChange={(e) => setUseDefaultDescription(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-800 text-red-600 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span>Use YouTube Channel Upload Defaults</span>
                      </label>
                    </div>

                    {useDefaultDescription ? (
                      <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3 text-xs text-zinc-400 flex items-center justify-between">
                        <span>YouTube will automatically apply your channel's default description, links, and hashtags from YouTube Studio settings.</span>
                        <button
                          type="button"
                          onClick={() => setUseDefaultDescription(false)}
                          className="text-xs text-red-400 hover:text-red-300 underline font-medium shrink-0 ml-2"
                        >
                          Customize
                        </button>
                      </div>
                    ) : (
                      <textarea
                        rows={2}
                        value={ytDescription}
                        onChange={(e) => setYtDescription(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50 resize-none"
                        placeholder="Add custom description and hashtags (leave empty to use YouTube defaults)..."
                      />
                    )}
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

                  {/* Error Notification */}
                  {ytError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-xs text-red-300">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                      <div>
                        <p className="font-medium">Publishing Error</p>
                        <p className="text-red-400/90">{ytError}</p>
                      </div>
                    </div>
                  )}

                  {/* Success Result */}
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

                  {/* Submit Button */}
                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isPublishingYt}
                      className="w-full bg-red-600 hover:bg-red-500 text-white font-medium shadow-lg shadow-red-600/25"
                    >
                      {isPublishingYt ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Publishing to YouTube Shorts...
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4 mr-2" />
                          Publish to YouTube Shorts Now
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
