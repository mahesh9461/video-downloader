"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
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
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { AutopilotStatus, AutopilotClipItem } from "@/lib/types";

export function AutopilotDashboard() {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [customAudioCount, setCustomAudioCount] = useState(0);
  const [customAudioTracks, setCustomAudioTracks] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiClient.getAutopilotStatus();
      setStatus(data);
      if (data.seconds_until_next_upload !== null && data.seconds_until_next_upload !== undefined) {
        setCountdown(data.seconds_until_next_upload);
      } else {
        setCountdown(null);
      }
    } catch (err: any) {
      // Background polling failure
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

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchStatus(), fetchAudio()]).finally(() => setIsLoading(false));

    const interval = setInterval(() => {
      fetchStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchAudio]);

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
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to pause autopilot");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleTriggerNow = async () => {
    setIsActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.triggerAutopilot();
      setStatus(res);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to trigger autopilot cycle");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCleanup = async () => {
    setIsActionLoading(true);
    try {
      await apiClient.cleanupAutopilotDisk();
      await fetchStatus();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to cleanup orphan files");
    } finally {
      setIsActionLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  };

  const getStateBadge = () => {
    if (!status) return null;
    if (status.state === "uploading") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
          <Zap className="w-3.5 h-3.5" />
          Uploading to YouTube Shorts...
        </span>
      );
    }
    if (status.state === "rendering") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Slicing & Rendering 6 Clips...
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
    if (status.is_running) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Autopilot Running (1 Upload / Hour)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
        <Pause className="w-3.5 h-3.5" />
        Autopilot Paused
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
              GTA 6 Autonomous Viral Shorts Pipeline
            </h1>
            <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Finds trending GTA 6 videos, extracts exactly 6 high-converting clips with randomized
              hooks & custom audio, and publishes 1 Short every hour with zero CPU strain and automatic disk cleanup.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {status?.is_running ? (
              <button
                type="button"
                onClick={handlePause}
                disabled={isActionLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all shadow-md active:scale-95"
              >
                <Pause className="w-4 h-4 text-amber-400" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                disabled={isActionLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/20 transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Autopilot</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleTriggerNow}
              disabled={isActionLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all hover:border-zinc-700 active:scale-95"
            >
              <Zap className="w-4 h-4 text-yellow-400" />
              <span>Queue Next Video Now</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

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
              <span className="text-xs text-zinc-400">Freed by instant cleanup</span>
              <button
                type="button"
                onClick={handleCleanup}
                className="text-xs text-red-400 hover:text-red-300 font-medium underline flex items-center gap-1"
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
                <span>No active batch queued. Click "Queue Next Video Now" or Start Autopilot to begin.</span>
              )}
            </p>
          </div>
        </div>

        {status?.current_batch && status.current_batch.clips.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {status.current_batch.clips.map((clip) => (
              <div
                key={clip.id}
                className="rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-4 space-y-3 flex flex-col justify-between hover:border-zinc-700 transition-all"
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
                      🎨 Style: {clip.hook_style}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                      ⚡ Bar: {clip.progress_bar_color}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                      📐 {clip.layout}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">
                    Duration: {clip.duration.toFixed(0)}s
                  </span>
                  {clip.youtube_url ? (
                    <a
                      href={clip.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-400 hover:text-red-300 font-medium flex items-center gap-1"
                    >
                      <span>View on YouTube</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-zinc-400">
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
          <span className="text-[11px] text-zinc-500">Auto-refreshing</span>
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
    </div>
  );
}
