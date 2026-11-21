"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Zap,
  Sparkles,
  ShieldCheck,
  HardDrive,
  Cpu,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Music,
  RefreshCw,
  Film,
  Copy,
  Check,
  Upload,
  RotateCcw,
  AlertTriangle,
  Eye,
  ArrowRight,
  Download,
  Settings,
  Key,
  Link2,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { AutopilotStatus, AutopilotClipItem, YouTubeAuthStatus, YouTubeChannelItem } from "@/lib/types";

export function AutopilotDashboard() {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [ytStatus, setYtStatus] = useState<YouTubeAuthStatus | null>(null);
  const [channels, setChannels] = useState<YouTubeChannelItem[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [customAudioCount, setCustomAudioCount] = useState(0);
  const [customAudioTracks, setCustomAudioTracks] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [customUrl, setCustomUrl] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPreviewClipId, setSelectedPreviewClipId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"video" | "cover">("video");

  // YouTube OAuth & Token Management State
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [modalTab, setModalTab] = useState<"token" | "oauth">("token");
  const [ytClientId, setYtClientId] = useState("");
  const [ytClientSecret, setYtClientSecret] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [isConnectingYt, setIsConnectingYt] = useState(false);
  const [cardTokenInput, setCardTokenInput] = useState<Record<string, string>>({});
  const [connectingTargetClip, setConnectingTargetClip] = useState<AutopilotClipItem | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiClient.getAutopilotStatus();
      setStatus(data);
      if (data.channels) {
        setChannels(data.channels);
      }
      if (data.active_channel_id) {
        setActiveChannelId(data.active_channel_id);
      }
      if (data.seconds_until_next_upload !== null && data.seconds_until_next_upload !== undefined) {
        setCountdown(data.seconds_until_next_upload);
      } else {
        setCountdown(null);
      }
    } catch {
      // Background polling failure
    }
  }, []);

  const fetchChannels = useCallback(async () => {
    try {
      if (typeof apiClient.getYouTubeChannels === "function") {
        const res = await apiClient.getYouTubeChannels();
        if (res?.channels) {
          setChannels(res.channels);
          if (res.active_channel_id) {
            setActiveChannelId(res.active_channel_id);
          }
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const fetchAudio = useCallback(async () => {
    try {
      const res = await apiClient.getAutopilotAudio();
      setCustomAudioCount(res.count);
      setCustomAudioTracks(res.custom_tracks);
    } catch {
      // Ignore
    }
  }, []);

  const fetchYtStatus = useCallback(async () => {
    try {
      const data = await apiClient.getYouTubeStatus();
      setYtStatus(data);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchStatus(), fetchAudio(), fetchYtStatus(), fetchChannels()]).finally(() => setIsLoading(false));
  }, [fetchStatus, fetchAudio, fetchYtStatus, fetchChannels]);

  // Check OAuth callback parameters from URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("youtube_auth") === "success") {
        setSuccessMsg("🎉 YouTube channel connected successfully! Autopilot can now publish Shorts.");
        fetchYtStatus();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get("youtube_auth") === "error") {
        setErrorMsg("Failed to authenticate with Google YouTube. Please verify credentials and try again.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [fetchYtStatus]);

  // Dynamic resilient polling interval (faster when active so UI stays live; slower when idle)
  useEffect(() => {
    const isLive =
      status?.state === "rendering" ||
      status?.state === "uploading" ||
      status?.state === "searching" ||
      status?.is_running;
    const intervalMs = isLive ? 2500 : 8000;

    const interval = setInterval(() => {
      fetchStatus();
      fetchYtStatus();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [status?.state, status?.is_running, fetchStatus, fetchYtStatus]);

  // Ticking countdown effect
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleStart = async () => {
    setIsActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.startAutopilot();
      setStatus(res);
      setSuccessMsg("Autopilot started. Running autonomous pipeline.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to start autopilot");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePause = async () => {
    setIsActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.pauseAutopilot();
      setStatus(res);
      setSuccessMsg("Autopilot paused.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to pause autopilot");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleTriggerNow = async () => {
    if (!customUrl.trim()) {
      setErrorMsg("Please paste a valid YouTube video URL to begin clipping and auto-uploading.");
      return;
    }
    setIsActionLoading(true);
    setErrorMsg(null);
    try {
      const urlParam = customUrl.trim();
      const res = activeChannelId
        ? await apiClient.triggerAutopilot(urlParam, activeChannelId)
        : await apiClient.triggerAutopilot(urlParam);
      setStatus(res);
      setSuccessMsg("Started clipping & auto-upload pipeline for your YouTube URL!");
      setCustomUrl("");
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to trigger clipping and upload pipeline");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReset = async () => {
    setIsActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.resetAutopilot();
      setStatus(res);
      setSuccessMsg("Reset autopilot quota & cooldown successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to reset autopilot");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStop = async () => {
    setIsActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.stopAutopilot();
      setStatus(res);
      setSuccessMsg("Terminated active download/batch and cleaned up partial files.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to terminate download");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCleanup = async () => {
    setIsActionLoading(true);
    try {
      await apiClient.cleanupAutopilotDisk();
      await fetchStatus();
      setSuccessMsg("Purged orphan temporary downloads.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to cleanup orphan files");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRetryClip = async (clipId: string) => {
    setIsActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.retryAutopilotClip(clipId);
      setStatus(res);
      setSuccessMsg("Retrying upload for Short clip...");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to retry clip upload");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSaveOAuthCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ytClientId.trim() || !ytClientSecret.trim()) {
      setErrorMsg("Both Google Client ID and Client Secret are required.");
      return;
    }
    setIsConnectingYt(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.configureYouTubeOAuth(ytClientId.trim(), ytClientSecret.trim());
      if (res?.youtube_status) {
        setYtStatus(res.youtube_status);
      }
      setSuccessMsg("Saved Google OAuth credentials! You can now sign in.");
      setShowOAuthModal(false);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save OAuth credentials.");
    } finally {
      setIsConnectingYt(false);
    }
  };

  const handleSelectChannel = async (cid: string) => {
    setIsActionLoading(true);
    try {
      if (typeof apiClient.selectYouTubeChannel === "function") {
        await apiClient.selectYouTubeChannel(cid);
      }
      setActiveChannelId(cid);
      setSuccessMsg(`Switched upload channel to: ${cid}`);
      await Promise.all([fetchChannels(), fetchStatus(), fetchYtStatus()]);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to switch channel.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteChannel = async (cid: string) => {
    setIsActionLoading(true);
    try {
      if (typeof apiClient.deleteYouTubeChannel === "function") {
        await apiClient.deleteYouTubeChannel(cid);
      }
      setSuccessMsg("Channel disconnected.");
      await Promise.all([fetchChannels(), fetchStatus(), fetchYtStatus()]);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete channel.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApplyManualToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) {
      setErrorMsg("Please paste a valid YouTube access token.");
      return;
    }
    setIsConnectingYt(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.setYouTubeToken(manualToken.trim());
      if (res?.youtube_status) {
        setYtStatus(res.youtube_status);
      }
      setSuccessMsg("YouTube Access Token saved and verified successfully!");
      setManualToken("");
      setShowOAuthModal(false);
      await fetchChannels();
      if (connectingTargetClip?.id) {
        const targetId = connectingTargetClip.id;
        setConnectingTargetClip(null);
        const retryRes = await apiClient.retryAutopilotClip(targetId);
        setStatus(retryRes);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save access token.");
    } finally {
      setIsConnectingYt(false);
    }
  };

  const handleInlineConnectAndRetry = async (clipId: string) => {
    const token = cardTokenInput[clipId]?.trim();
    if (!token) {
      setErrorMsg("Please paste a valid YouTube access token (starting with ya29...).");
      return;
    }
    setIsConnectingYt(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.setYouTubeToken(token);
      if (res?.youtube_status) {
        setYtStatus(res.youtube_status);
      }
      setSuccessMsg("YouTube token saved! Retrying upload for this Short now...");
      setCardTokenInput((prev) => ({ ...prev, [clipId]: "" }));
      await fetchChannels();
      // Immediately retry uploading this specific clip
      const retryRes = await apiClient.retryAutopilotClip(clipId);
      setStatus(retryRes);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save token and retry clip.");
    } finally {
      setIsConnectingYt(false);
    }
  };

  const handleDisconnectYouTube = async () => {
    setIsActionLoading(true);
    try {
      await apiClient.disconnectYouTube();
      await Promise.all([fetchYtStatus(), fetchChannels()]);
      setSuccessMsg("YouTube channel disconnected.");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to disconnect channel.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  };

  // Find active or featured clip for the video preview player
  const activeClip: AutopilotClipItem | null = useMemo(() => {
    if (!status?.current_batch?.clips || status.current_batch.clips.length === 0) {
      return null;
    }
    const clips = status.current_batch.clips;
    if (selectedPreviewClipId) {
      const found = clips.find((c) => c.id === selectedPreviewClipId);
      if (found) return found;
    }
    // Prefer actively rendering/uploading clip
    const current = clips.find((c) => c.status === "uploading" || c.status === "rendering");
    if (current) return current;
    // Or first preview ready / published clip
    const ready = clips.find((c) => c.preview_url || c.filename);
    if (ready) return ready;
    return clips[0];
  }, [status?.current_batch?.clips, selectedPreviewClipId]);

  // List of all published videos (from status.all_published_videos or batch)
  const publishedVideos = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      youtube_url: string;
      youtube_video_id: string;
      published_at?: string;
      clip_index?: number;
      cover_url?: string | null;
    }> = [];
    const seen = new Set<string>();

    if (status?.all_published_videos && status.all_published_videos.length > 0) {
      for (const p of status.all_published_videos) {
        if (!seen.has(p.youtube_url)) {
          seen.add(p.youtube_url);
          list.push(p);
        }
      }
    }

    if (status?.current_batch?.clips) {
      for (const c of status.current_batch.clips) {
        if (c.status === "published" && c.youtube_url && !seen.has(c.youtube_url)) {
          seen.add(c.youtube_url);
          list.push({
            id: c.id,
            title: c.hook_title,
            youtube_url: c.youtube_url,
            youtube_video_id: c.youtube_video_id || "",
            clip_index: c.clip_index,
            cover_url: c.cover_url,
          });
        }
      }
    }
    return list;
  }, [status?.all_published_videos, status?.current_batch?.clips]);

  // List of failed clips or active issues
  const activeIssues = useMemo(() => {
    const issues: Array<{ id?: string; title?: string; error: string; timestamp?: string }> = [];
    if (status?.current_batch?.clips) {
      for (const c of status.current_batch.clips) {
        if (c.status === "failed" && c.error) {
          issues.push({
            id: c.id,
            title: c.hook_title,
            error: c.error,
          });
        }
      }
    }
    if (status?.recent_errors && status.recent_errors.length > 0) {
      for (const e of status.recent_errors) {
        if (!issues.some((i) => i.error === e.error)) {
          issues.push({
            id: e.clip_id,
            title: e.title,
            error: e.error,
            timestamp: e.timestamp,
          });
        }
      }
    }
    return issues;
  }, [status?.current_batch?.clips, status?.recent_errors]);

  const getStateBadge = () => {
    if (!status) return null;
    if (status.state === "uploading") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
          <Upload className="w-3.5 h-3.5 animate-bounce" />
          Uploading to YouTube Shorts...
        </span>
      );
    }
    if (status.state === "rendering") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Slicing, Hooking & Rendering...
        </span>
      );
    }
    if (status.state === "searching") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          Discovering Viral Video...
        </span>
      );
    }
    if (status.state === "error") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          Pipeline Alert / Issue
        </span>
      );
    }
    if (status.state === "cooldown") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5" />
          Daily Quota Cooldown Active
        </span>
      );
    }
    if (status.is_running || status.state === "queued") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Processing 6 Shorts
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
        <Film className="w-3.5 h-3.5 text-zinc-400" />
        Ready for YouTube URL
      </span>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative rounded-3xl border border-red-500/30 bg-gradient-to-b from-zinc-900/90 via-zinc-950 to-zinc-950 p-6 sm:p-8 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-red-600/20 text-red-400 border border-red-600/30">
                ViceVerse Autopilot
              </span>
              {getStateBadge()}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              GTA 6 Viral Shorts Clipper & YouTube Auto-Publisher
            </h1>
            <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Paste any YouTube video or podcast URL. SaveIt slices the 6 most viral moments, generates Full HD GTA 6 hook covers, and automatically uploads each clip one by one directly to your connected YouTube channel.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              disabled={isActionLoading}
              title="Reset daily upload quota & clear cooldown"
              className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all hover:border-zinc-700 active:scale-95 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
              <span>Reset Cooldown</span>
            </button>

            {(status?.state === "rendering" || status?.current_step === "downloading" || status?.state === "uploading" || status?.state === "error") && (
              <button
                type="button"
                onClick={handleStop}
                disabled={isActionLoading}
                title="Immediately terminate download and free up disk space"
                className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/50 transition-all shadow-md active:scale-95 hover:border-red-400 disabled:cursor-not-allowed"
              >
                <X className="w-3.5 h-3.5 text-red-400" />
                <span>Stop Download</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary URL Ingestion & Trigger Bar */}
        <div className="mt-6 pt-6 border-t border-zinc-800/80 space-y-2">
          <label htmlFor="autopilot-url-input" className="block text-xs font-semibold text-zinc-300">
            Paste YouTube Video or Podcast URL:
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="autopilot-url-input"
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="Paste YouTube video or podcast URL (e.g. https://www.youtube.com/watch?v=...)..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/40 transition-all"
            />
            <button
              type="button"
              onClick={handleTriggerNow}
              disabled={isActionLoading || status?.state === "rendering" || status?.state === "uploading"}
              className="cursor-pointer flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/25 transition-all active:scale-95 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 fill-white" />
              <span>Clip & Upload 6 Shorts</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-xs text-red-200 flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="cursor-pointer text-red-400 hover:text-red-200 text-xs px-2 py-0.5 rounded border border-red-500/30"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* YouTube Channel Connection Panel (Directly Connect & Authorize) */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-5 sm:p-6 space-y-4 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                ytStatus?.connected || channels.length > 0
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
            >
              {ytStatus?.connected || channels.length > 0 ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  YouTube Channel Connection
                </h3>
                {ytStatus?.connected || channels.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {ytStatus?.connected || channels.length > 0 ? (
                  <span>
                    Linked Channel: <strong className="text-zinc-200">
                      {channels.find((c) => c.channel_id === activeChannelId)?.channel_title || ytStatus?.channel_title || "My YouTube Channel"}
                    </strong> (Ready for automatic upload)
                  </span>
                ) : (
                  <span>
                    Autopilot requires a connected YouTube channel to upload your 6 daily Shorts.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {ytStatus?.connected || channels.length > 0 ? (
              <button
                type="button"
                onClick={handleDisconnectYouTube}
                disabled={isActionLoading}
                className="cursor-pointer text-xs text-zinc-400 hover:text-red-400 underline font-medium px-3 py-1.5 transition-colors disabled:cursor-not-allowed"
              >
                Disconnect Channel
              </button>
            ) : null}

            {ytStatus?.auth_url && !ytStatus?.connected ? (
              <a
                href={ytStatus.auth_url}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-zinc-100 text-zinc-950 shadow-md shadow-white/10 transition-all active:scale-95"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Sign In with Google</span>
              </a>
            ) : null}

            <button
              type="button"
              onClick={() => setShowOAuthModal(!showOAuthModal)}
              className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all active:scale-95"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-400" />
              <span>Setup Credentials / Token</span>
            </button>
          </div>
        </div>

        {/* Multi-Channel List & Target Selector */}
        {channels.length > 0 && (
          <div className="pt-3 border-t border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Connected YouTube Channels ({channels.length})
              </span>
              <span className="text-[11px] text-zinc-500">
                Select which channel to upload videos to
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {channels.map((chan) => {
                const isActive = (chan.channel_id === activeChannelId) || (chan.is_default && !activeChannelId);
                return (
                  <div
                    key={chan.channel_id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isActive
                        ? "bg-violet-950/30 border-violet-500/50 shadow-sm shadow-violet-500/10"
                        : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                        {chan.thumbnail_url ? (
                          <img src={chan.thumbnail_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          "YT"
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {chan.channel_title}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate font-mono">
                          {chan.channel_id}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          Active Target
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectChannel(chan.channel_id)}
                          disabled={isActionLoading}
                          className="cursor-pointer px-2 py-1 rounded-lg text-[10px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:cursor-not-allowed"
                        >
                          Select
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteChannel(chan.channel_id)}
                        disabled={isActionLoading}
                        title="Remove channel"
                        aria-label={`Remove channel ${chan.channel_title}`}
                        className="cursor-pointer p-1 text-zinc-500 hover:text-red-400 rounded transition-colors disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Real-time Dynamic Pipeline Phase Tracker */}
      {status?.current_batch && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 space-y-5 shadow-xl backdrop-blur-xl animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
                Live Auto-Upload Pipeline Flow
              </span>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                Active Batch: {status.current_batch.source_title}
              </h2>
            </div>
            <span className="text-xs text-zinc-400">
              State: <strong className="text-zinc-200 uppercase">{status.state}</strong>
            </span>
          </div>

          {/* 5-Step Visual Phase Progression */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {/* Step 1: Hook Created */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                activeClip?.hook_title
                  ? "bg-zinc-900 border-yellow-500/40 text-yellow-300 shadow-md shadow-yellow-500/5"
                  : "bg-zinc-950/50 border-zinc-800/60 text-zinc-500"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-white">Hook Created</span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2">
                {activeClip?.hook_title
                  ? `"${activeClip.hook_title}"`
                  : "Analyzing retention cues & crafting hook..."}
              </p>
            </div>

            {/* Step 2: Text & Audio Styled */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                activeClip?.background_music && activeClip.background_music !== "none"
                  ? "bg-zinc-900 border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/5"
                  : "bg-zinc-950/50 border-zinc-800/60 text-zinc-500"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-white">Text & Song</span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2">
                {activeClip
                  ? `${activeClip.hook_style} • Song: ${activeClip.background_music}`
                  : "Mixing procedural synthwave & kinetic bar..."}
              </p>
            </div>

            {/* Step 3: Video Preview Ready */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                activeClip?.preview_url || activeClip?.filename
                  ? "bg-zinc-900 border-purple-500/40 text-purple-300 shadow-md shadow-purple-500/5"
                  : "bg-zinc-950/50 border-zinc-800/60 text-zinc-500"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-white">Video Preview</span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2">
                {activeClip?.preview_url
                  ? "9:16 Vertical Short rendered and ready to watch!"
                  : "Sequentially rendering 9:16 MP4..."}
              </p>
            </div>

            {/* Step 4: Uploading to YouTube */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                status.state === "uploading" || activeClip?.status === "uploading"
                  ? "bg-zinc-900 border-red-500/50 text-red-300 shadow-md shadow-red-500/10 animate-pulse"
                  : activeClip?.status === "published"
                  ? "bg-zinc-900 border-emerald-500/30 text-emerald-400"
                  : "bg-zinc-950/50 border-zinc-800/60 text-zinc-500"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center shrink-0">
                  4
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-white">YouTube Upload</span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2">
                {activeClip?.status === "uploading"
                  ? "Uploading Short to YouTube Data API..."
                  : activeClip?.status === "published"
                  ? "Uploaded successfully!"
                  : "Queued for hourly drop schedule"}
              </p>
            </div>

            {/* Step 5: Published & Live Link */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                publishedVideos.length > 0
                  ? "bg-zinc-900 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/10"
                  : "bg-zinc-950/50 border-zinc-800/60 text-zinc-500"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                  5
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-white">Live Link</span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2">
                {publishedVideos.length > 0
                  ? `${publishedVideos.length} Short(s) live on YouTube!`
                  : "Waiting for first drop to complete"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Featured Video Preview Player ("her is your video preview") */}
      {activeClip && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-red-600/20 text-red-400 border border-red-600/30">
                  Short #{activeClip.clip_index} Preview
                </span>
                <span className="text-xs text-zinc-400">
                  Duration: {activeClip.duration !== undefined ? activeClip.duration.toFixed(0) : "30"}s • Layout: {activeClip.layout}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {activeClip.hook_title}
              </h2>
            </div>

            {/* Download or View Link */}
            <div className="flex flex-wrap items-center gap-2">
              {activeClip.cover_url && (
                <div className="flex items-center p-0.5 bg-zinc-950 rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("video")}
                    className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      previewMode === "video" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("cover")}
                    className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                      previewMode === "cover" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>HD Cover</span>
                  </button>
                </div>
              )}
              {activeClip.preview_url && (
                <a
                  href={apiClient.resolveUrl(activeClip.preview_url)}
                  download={activeClip.filename || `short_${activeClip.clip_index}.mp4`}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Download MP4</span>
                </a>
              )}
              {activeClip.cover_url && (
                <a
                  href={apiClient.resolveUrl(activeClip.cover_url)}
                  download={activeClip.cover_filename || `cover_short_${activeClip.clip_index}.jpg`}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 transition-all active:scale-95"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download Full HD Cover</span>
                </a>
              )}
              {activeClip.youtube_url && (
                <a
                  href={activeClip.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/20 transition-all active:scale-95"
                >
                  <span>Watch on YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Centered 9:16 Vertical Video / Full HD Cover Preview Container */}
          <div className="flex flex-col items-center justify-center py-2">
            {previewMode === "cover" && activeClip.cover_url ? (
              <div className="w-64 sm:w-72 aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-amber-500/40 shadow-2xl relative group">
                <img
                  src={apiClient.resolveUrl(activeClip.cover_url)}
                  alt={activeClip.hook_title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded shadow">
                  FULL HD 1080×1920
                </div>
              </div>
            ) : activeClip.preview_url ? (
              <div className="w-64 sm:w-72 aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-2xl relative group">
                <video
                  src={apiClient.resolveUrl(activeClip.preview_url)}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-64 sm:w-72 aspect-[9/16] rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <RefreshCw className="w-8 h-8 text-zinc-500 animate-spin" />
                <p className="text-xs text-zinc-400 font-medium">
                  {activeClip.current_step === "hook_created"
                    ? "Hook created! Applying text style & mixing audio..."
                    : activeClip.current_step === "styling"
                    ? "Audio mixed! Rendering 9:16 vertical video..."
                    : "Rendering Short MP4 & Full HD Cover..."}
                </p>
                <span className="text-[10px] text-zinc-500">Low-CPU mode (2 threads) to keep Mac quiet</span>
              </div>
            )}
          </div>

          {/* Clip Metadata Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
            <span className="px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
              🎨 Style: <strong className="text-white font-medium">{activeClip.hook_style}</strong>
            </span>
            <span className="px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
              ⚡ Progress Bar: <strong className="text-white font-medium">{activeClip.progress_bar_color}</strong>
            </span>
            <span className="px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
              🎵 Background Track: <strong className="text-white font-medium">{activeClip.background_music}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Published YouTube Shorts Showcase ("and on done it will gi em ehte lin off off alal udpated video") */}
      {publishedVideos.length > 0 && (
        <div className="rounded-3xl border border-emerald-500/30 bg-zinc-950 p-6 sm:p-8 space-y-5 shadow-2xl animate-in fade-in">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div className="space-y-1">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-600/20 text-emerald-400 border border-emerald-600/30">
                Uploaded Videos
              </span>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Published YouTube Shorts ({publishedVideos.length})
              </h2>
            </div>
            <span className="text-xs text-zinc-400">All links ready & live on your channel</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {publishedVideos.map((video, idx) => (
              <div
                key={video.id || idx}
                className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/40 p-4 space-y-3 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      Short #{video.clip_index ?? idx + 1} • Live on YouTube
                    </span>
                    <h3 className="text-sm font-semibold text-white line-clamp-2">
                      {video.title}
                    </h3>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                </div>

                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-2">
                  <a
                    href={video.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1.5 truncate"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{video.youtube_url}</span>
                  </a>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {video.cover_url && (
                      <a
                        href={apiClient.resolveUrl(video.cover_url)}
                        download={`cover_${video.clip_index || 1}.jpg`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/30 transition-all active:scale-95"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>Cover</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyLink(video.youtube_url, video.id || String(idx))}
                      className="cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 shrink-0 transition-all active:scale-95"
                    >
                      {copiedId === (video.id || String(idx)) ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-zinc-400" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues & Errors Center ("and not then tiwillshow me the all the issue fornte d") */}
      {activeIssues.length > 0 && (
        <div className="rounded-3xl border border-red-500/40 bg-red-950/20 p-6 space-y-4 shadow-xl animate-in fade-in">
          <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h2 className="text-base font-bold text-white">
                Pipeline Issues & Diagnostics ({activeIssues.length})
              </h2>
            </div>
            <span className="text-xs text-red-300">Errors requiring attention</span>
          </div>

          <div className="space-y-3">
            {activeIssues.map((issue, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-zinc-900/90 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-200">
                      {issue.title || "Pipeline Step Issue"}
                    </span>
                    {issue.error.toLowerCase().includes("token") && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                        Auth Required
                      </span>
                    )}
                  </div>
                  <p className="text-red-300 font-mono text-[11px] leading-relaxed">
                    {issue.error}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {(!ytStatus?.connected || issue.error.toLowerCase().includes("token") || issue.error.toLowerCase().includes("connect")) && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetClip = status?.current_batch?.clips?.find((c) => c.id === issue.id);
                        if (targetClip) setConnectingTargetClip(targetClip);
                        setShowOAuthModal(true);
                      }}
                      className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all shadow-sm active:scale-95"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Connect YouTube Channel</span>
                    </button>
                  )}

                  {issue.id && (
                    <button
                      type="button"
                      onClick={() => handleRetryClip(issue.id!)}
                      disabled={isActionLoading}
                      className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/40 transition-all disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry Upload</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metric & Protection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Daily Quota Protection */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-3 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Daily Quota Safety</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              {status?.daily_uploads_count ?? 0} / {status?.daily_upload_limit ?? 6}
            </div>
            <p className="text-xs text-zinc-400">
              Max 6 uploads/day protects your 10,000 Google API quota limit.
            </p>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{
                width: `${Math.min(100, ((status?.daily_uploads_count ?? 0) / 6) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Card 2: Next Scheduled Upload Countdown */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-3 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Next Upload Drop</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              {countdown !== null && countdown > 0 ? formatCountdown(countdown) : "Queued / Standby"}
            </div>
            <p className="text-xs text-zinc-400">
              Posts 1 Short every 60 minutes for high algorithmic distribution.
            </p>
          </div>
        </div>

        {/* Card 3: Host CPU Protection */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-3 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Host CPU Shield</span>
            <Cpu className="w-4 h-4 text-violet-400" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-emerald-400">Low Load (2 Cores)</div>
            <p className="text-xs text-zinc-400">
              Renders clips sequentially with restricted threads so your Mac stays cool and quiet.
            </p>
          </div>
        </div>

        {/* Card 4: Automatic Disk Cleanup */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-3 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Auto Disk Cleanup</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">
              {status?.disk_space_cleaned_mb ?? 0} MB
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Raw source auto-purged</span>
              <button
                type="button"
                onClick={handleCleanup}
                disabled={isActionLoading}
                className="cursor-pointer text-xs text-red-400 hover:text-red-300 font-medium underline flex items-center gap-1 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3 h-3" />
                Purge
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Preset Status */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
        <div className="flex items-center gap-2 text-zinc-300">
          <Music className="w-4 h-4 text-red-400 shrink-0" />
          <span>
            {customAudioCount > 0 ? (
              <span className="text-emerald-400 font-medium">
                {customAudioCount} custom audio tracks active ({customAudioTracks.join(", ")})
              </span>
            ) : (
              <span>Procedural Lo-Fi & Synthwave presets active (Drop custom MP3s in <code className="text-zinc-300">assets/audio/</code> to use your own).</span>
            )}
          </span>
        </div>
        <span className="text-zinc-500 shrink-0">ViceVerse GTA 6 SEO Preset & 33 Tags Attached</span>
      </div>

      {/* 6-Clip Batch Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-red-500" />
              Active Daily Batch (6 Scheduled Shorts)
            </h2>
            <p className="text-xs text-zinc-400">
              {status?.current_batch ? (
                <span>
                  Source: <strong className="text-zinc-200">{status.current_batch.source_title}</strong> (Source video deleted immediately after clipping)
                </span>
              ) : (
                <span>No active batch queued. Click &quot;Queue Next Video Now&quot; or Start Autopilot to begin.</span>
              )}
            </p>
          </div>
        </div>

        {status?.current_batch && status.current_batch.clips.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {status.current_batch.clips.map((clip) => (
              <div
                key={clip.id}
                role="button"
                tabIndex={0}
                aria-label={`Select Short #${clip.clip_index}: ${clip.hook_title}`}
                onClick={() => setSelectedPreviewClipId(clip.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedPreviewClipId(clip.id);
                  }
                }}
                className={`rounded-2xl border p-4 space-y-3 flex flex-col justify-between transition-all cursor-pointer group ${
                  activeClip?.id === clip.id
                    ? "border-red-500/60 bg-zinc-900/90 shadow-lg shadow-red-500/10 ring-1 ring-red-500/40"
                    : "border-zinc-800/90 bg-zinc-900/50 hover:border-red-500/50 hover:bg-zinc-900/80 hover:shadow-md hover:shadow-red-500/5"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-600/30">
                      Short #{clip.clip_index} of 6
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {clip.status === "published" ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Published
                        </span>
                      ) : clip.status === "uploading" ? (
                        <span className="text-red-400 font-semibold flex items-center gap-1 animate-pulse">
                          <Upload className="w-3.5 h-3.5" /> Uploading...
                        </span>
                      ) : clip.status === "failed" ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Issue
                        </span>
                      ) : (
                        <span>Drop: +{clip.clip_index - 1}h</span>
                      )}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white line-clamp-2">
                    {clip.hook_title}
                  </h3>

                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                      🎨 {clip.hook_style}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                      ⚡ Bar: {clip.progress_bar_color}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                      📐 {clip.layout}
                    </span>
                  </div>

                  {clip.cover_url && (
                    <div className="relative rounded-xl overflow-hidden aspect-[9/16] max-h-36 bg-zinc-950 border border-zinc-800/80 group">
                      <img
                        src={apiClient.resolveUrl(clip.cover_url)}
                        alt={clip.hook_title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 shadow">
                        Full HD Cover
                      </span>
                      <a
                        href={apiClient.resolveUrl(clip.cover_url)}
                        download={clip.cover_filename || `cover_${clip.clip_index}.jpg`}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer absolute bottom-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-lg bg-black/85 hover:bg-black text-amber-400 border border-amber-500/40 flex items-center gap-1 shadow-md transition-all active:scale-95"
                      >
                        <Download className="w-2.5 h-2.5" />
                        <span>Cover</span>
                      </a>
                    </div>
                  )}

                  {clip.error && (
                    <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-[11px] text-red-200 space-y-2.5">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{clip.error}</span>
                      </div>
                      {(!ytStatus?.connected || clip.error.toLowerCase().includes("token") || clip.error.toLowerCase().includes("connect")) && (
                        <div className="pt-1.5 border-t border-red-500/20 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {ytStatus?.auth_url ? (
                              <a
                                href={ytStatus.auth_url}
                                onClick={(e) => e.stopPropagation()}
                                className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-zinc-100 text-zinc-950 shadow-sm transition-all active:scale-95"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                </svg>
                                <span>Sign In with Google</span>
                              </a>
                            ) : null}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConnectingTargetClip(clip);
                                setShowOAuthModal(true);
                              }}
                              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 shadow-sm transition-all active:scale-95"
                            >
                              <Link2 className="w-3.5 h-3.5 text-red-600" />
                              <span>Connect YouTube Channel</span>
                            </button>
                          </div>

                          {/* Direct In-Card Token Input */}
                          <div className="space-y-1 pt-1">
                            <span className="text-[10px] text-zinc-400 font-medium">Or paste access token directly to upload:</span>
                            <div className="flex gap-1.5">
                              <input
                                type="password"
                                placeholder="Paste Access Token (ya29...)"
                                value={cardTokenInput[clip.id] || ""}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setCardTokenInput((prev) => ({ ...prev, [clip.id]: e.target.value }))
                                }
                                className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInlineConnectAndRetry(clip.id);
                                }}
                                disabled={isActionLoading || isConnectingYt}
                                className="cursor-pointer px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isConnectingYt ? "Connecting..." : "Connect & Retry"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPreviewClipId(clip.id);
                    }}
                    className="cursor-pointer text-zinc-400 hover:text-zinc-200 font-medium flex items-center gap-1 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview</span>
                  </button>

                  {clip.youtube_url ? (
                    <a
                      href={clip.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer text-red-400 hover:text-red-300 font-medium flex items-center gap-1 transition-colors"
                    >
                      <span>View on YouTube</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : clip.status === "failed" ? (
                    <div className="flex items-center gap-2">
                      {(!ytStatus?.connected || clip.error?.toLowerCase().includes("token") || clip.error?.toLowerCase().includes("connect")) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConnectingTargetClip(clip);
                            setShowOAuthModal(true);
                          }}
                          className="cursor-pointer text-xs font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>Connect</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetryClip(clip.id);
                        }}
                        className="cursor-pointer text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-zinc-500">
                      {clip.status === "queued" ? "Queued for Drop" : clip.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-medium text-zinc-300">Autopilot Ready</p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Start autopilot to autonomously search trending GTA 6 videos, cut 6 vertical clips with randomized overlay styles, and publish 1 clip every hour.
            </p>
          </div>
        )}
      </div>

      {/* Activity Logs */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Live Autopilot Activity & Cleanup Logs
          </span>
          <span className="text-[11px] text-zinc-500">Auto-refreshing • Independent of page reload</span>
        </div>
        <div className="bg-zinc-900/80 rounded-xl p-3 font-mono text-xs text-zinc-300 space-y-1 max-h-48 overflow-y-auto">
          {status?.recent_logs && status.recent_logs.length > 0 ? (
            status.recent_logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                {log}
              </div>
            ))
          ) : (
            <div className="text-zinc-500">System idle. Waiting for next cycle...</div>
          )}
        </div>
      </div>

      {/* Universal YouTube OAuth / Access Token Modal Dialog */}
      {showOAuthModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600/10 text-red-500 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Connect YouTube Channel
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {connectingTargetClip
                      ? `Authorizing to upload Short #${connectingTargetClip.clip_index}: "${connectingTargetClip.hook_title}"`
                      : "Connect your channel to auto-publish daily GTA 6 Shorts."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => {
                  setShowOAuthModal(false);
                  setConnectingTargetClip(null);
                }}
                className="cursor-pointer w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs: Instant Token vs Google Cloud OAuth */}
            <div className="flex rounded-xl bg-zinc-900/80 p-1 border border-zinc-800">
              <button
                type="button"
                onClick={() => setModalTab("token")}
                className={`cursor-pointer flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modalTab === "token"
                    ? "bg-zinc-800 text-white shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Instant Access Token
              </button>
              <button
                type="button"
                onClick={() => setModalTab("oauth")}
                className={`cursor-pointer flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modalTab === "oauth"
                    ? "bg-zinc-800 text-white shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Google Cloud OAuth App
              </button>
            </div>

            {modalTab === "token" ? (
              <form onSubmit={handleApplyManualToken} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    Paste YouTube OAuth Access Token
                  </label>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Fastest method: paste an access token from Google OAuth Playground or <code className="text-zinc-300">gcloud auth print-access-token</code> below.
                  </p>
                  <input
                    type="password"
                    placeholder="Paste Access Token (ya29.a0AfH...)"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isConnectingYt}
                  className="cursor-pointer w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnectingYt
                    ? "Verifying & Saving..."
                    : connectingTargetClip
                    ? `Connect & Upload Short #${connectingTargetClip.clip_index}`
                    : "Apply Token & Connect Channel"}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {ytStatus?.auth_url ? (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-400">
                      Google OAuth credentials are configured. Click below to authorize your YouTube channel:
                    </p>
                    <a
                      href={ytStatus.auth_url}
                      className="cursor-pointer w-full py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-zinc-100 text-zinc-950 flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <span>Sign In with Google</span>
                    </a>
                  </div>
                ) : (
                  <form onSubmit={handleSaveOAuthCreds} className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-[11px] text-zinc-400">
                        Create OAuth credentials in Google Cloud Console with Redirect URI:
                        <br />
                        <code className="text-zinc-300 font-mono text-[10px]">http://localhost:3000/api/youtube/callback</code>
                      </p>
                    </div>
                    <input
                      type="text"
                      placeholder="Google Client ID (.apps.googleusercontent.com)"
                      value={ytClientId}
                      onChange={(e) => setYtClientId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                    <input
                      type="password"
                      placeholder="Google Client Secret"
                      value={ytClientSecret}
                      onChange={(e) => setYtClientSecret(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                    <button
                      type="submit"
                      disabled={isConnectingYt}
                      className="cursor-pointer w-full py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isConnectingYt ? "Saving..." : "Save Credentials & Generate Link"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
