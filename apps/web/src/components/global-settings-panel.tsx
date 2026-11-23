"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sliders,
  Sparkles,
  Music,
  Image as ImageIcon,
  Type,
  Check,
  RotateCcw,
  Save,
  Volume2,
  ChevronDown,
  Layers,
  Shield,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlobalSettings } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  user_id: "default",
  layout: "center_crop",
  progress_bar: true,
  progress_bar_color: "yellow",
  text_overlay: {
    enabled: true,
    hook_style: "viral_yellow",
    default_hook: "WAIT FOR THE END!",
    burn_captions: false,
    caption_style: "viral_yellow",
    position: "top",
  },
  audio_mix: {
    background_music: "none",
    music_volume: 0.15,
    original_audio_volume: 1.0,
    ducking_enabled: true,
  },
  cover_image: {
    enabled: true,
    theme: "gta_action",
    headline: "WAIT FOR WHAT HAPPENS NEXT...",
  },
  default_privacy: "public",
  default_tags: ["Shorts", "Viral", "Trending"],
  active_channel_id: null,
};

interface GlobalSettingsPanelProps {
  onSettingsChange?: (settings: GlobalSettings) => void;
  className?: string;
  defaultExpanded?: boolean;
}

export function GlobalSettingsPanel({
  onSettingsChange,
  className = "",
  defaultExpanded = false,
}: GlobalSettingsPanelProps) {
  const { success, error: toastError } = useToast();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<"text" | "audio" | "cover" | "layout">("text");
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  // Load saved global settings on mount from API (database + local fallback)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (typeof window !== "undefined") {
          const cached = localStorage.getItem("saveit_global_settings");
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (mounted) {
                setSettings(parsed);
                onSettingsChange?.(parsed);
              }
            } catch {}
          }
        }
        const remote = await apiClient.getGlobalSettings();
        if (mounted && remote) {
          setSettings(remote);
          onSettingsChange?.(remote);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("saveit_global_settings", JSON.stringify(remote));
            } catch {}
          }
        }
      } catch {
        // Fallback to defaults or cached values
      }
    })();

    return () => {
      mounted = false;
    };
  }, [onSettingsChange]);

  const updateSettings = useCallback(
    (updater: (prev: GlobalSettings) => GlobalSettings) => {
      setSettings((prev) => {
        const next = updater(prev);
        onSettingsChange?.(next);
        return next;
      });
      setHasSaved(false);
    },
    [onSettingsChange]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await apiClient.saveGlobalSettings(settings);
      setSettings(saved);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("saveit_global_settings", JSON.stringify(saved));
        } catch {}
      }
      setHasSaved(true);
      success("Global customization defaults saved to database!");
      setTimeout(() => setHasSaved(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings.";
      toastError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_GLOBAL_SETTINGS);
    onSettingsChange?.(DEFAULT_GLOBAL_SETTINGS);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("saveit_global_settings", JSON.stringify(DEFAULT_GLOBAL_SETTINGS));
      } catch {}
    }
    success("Reset to factory defaults");
  };

  return (
    <div
      className={`w-full rounded-2xl border transition-all duration-200 overflow-hidden ${
        isExpanded
          ? "border-cyan-500/40 bg-[#10121a]/95 shadow-xl shadow-cyan-500/5 ring-1 ring-cyan-500/20"
          : "border-white/10 bg-[#12151f]/80 hover:border-zinc-700 hover:bg-[#12151f]"
      } ${className}`}
    >
      {/* Header bar / toggle trigger */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label="Toggle Global Settings customization"
        className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left transition-colors min-h-[44px]"
      >
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">
                Global Customization Settings
              </span>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 uppercase font-mono">
                Saved in DB
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
              Text Overlay:{" "}
              <span className="text-cyan-300 font-medium">
                {settings.text_overlay.enabled ? settings.text_overlay.hook_style.replace("_", " ") : "Off"}
              </span>{" "}
              • Audio Mix:{" "}
              <span className="text-pink-300 font-medium">
                {settings.audio_mix.background_music === "none"
                  ? "Original Only"
                  : `${settings.audio_mix.background_music.replace("_", " ")} (${Math.round(
                      settings.audio_mix.music_volume * 100
                    )}%)`}
              </span>{" "}
              • Cover Thumbnail:{" "}
              <span className="text-amber-300 font-medium">
                {settings.cover_image.enabled ? "1s Slap Active" : "Disabled"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-cyan-400 hidden sm:inline">
            {isExpanded ? "Hide Options" : "Customize Defaults"}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
              isExpanded ? "rotate-180 text-cyan-400" : ""
            }`}
          />
        </div>
      </button>

      {/* Expanded configuration tabs & controls */}
      {isExpanded && (
        <div className="border-t border-white/5 p-4 sm:p-6 space-y-5 animate-in fade-in-50 duration-150">
          {/* Sub-tabs: Text, Audio, Cover, Layout */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 overflow-x-auto">
            {[
              { id: "text", label: "Text Overlay", icon: Type },
              { id: "audio", label: "Audio Mix", icon: Music },
              { id: "cover", label: "Cover Thumbnail", icon: ImageIcon },
              { id: "layout", label: "Layout & Privacy", icon: Layers },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as "text" | "audio" | "cover" | "layout")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 min-h-[36px] ${
                    isActive
                      ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: TEXT OVERLAY */}
          {activeTab === "text" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <div>
                  <h4 className="text-xs font-bold text-white">Enable Headline Banner Overlay</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Draws a high-impact hook headline at the top of your vertical Short.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings((prev) => ({
                      ...prev,
                      text_overlay: { ...prev.text_overlay, enabled: !prev.text_overlay.enabled },
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors min-h-[36px] ${
                    settings.text_overlay.enabled
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400"
                  }`}
                >
                  {settings.text_overlay.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              {settings.text_overlay.enabled && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Default Hook Headline Text
                    </label>
                    <Input
                      value={settings.text_overlay.default_hook}
                      onChange={(e) =>
                        updateSettings((prev) => ({
                          ...prev,
                          text_overlay: { ...prev.text_overlay, default_hook: e.target.value },
                        }))
                      }
                      placeholder="e.g. WAIT FOR THE END!"
                      className="h-10 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-2">
                      Headline Visual Style
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "viral_yellow", label: "Viral Yellow", desc: "High CTR punch" },
                        { id: "neon_cyan", label: "Neon Cyan", desc: "Vice City cyber" },
                        { id: "red_bold", label: "Urgent Red", desc: "High alert break" },
                        { id: "clean_white", label: "Clean White", desc: "Modern minimal" },
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() =>
                            updateSettings((prev) => ({
                              ...prev,
                              text_overlay: { ...prev.text_overlay, hook_style: st.id },
                            }))
                          }
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            settings.text_overlay.hook_style === st.id
                              ? "bg-cyan-500/20 border-cyan-500/60 text-white font-bold"
                              : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                          }`}
                        >
                          <span className="block text-xs font-bold">{st.label}</span>
                          <span className="block text-[10px] text-zinc-400 mt-0.5">{st.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <div>
                      <h4 className="text-xs font-bold text-white">Dynamic Animated Captions</h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Transcribe and burn kinetic subtitle words synchronized with speech.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings((prev) => ({
                          ...prev,
                          text_overlay: { ...prev.text_overlay, burn_captions: !prev.text_overlay.burn_captions },
                        }))
                      }
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors min-h-[36px] ${
                        settings.text_overlay.burn_captions
                          ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                          : "bg-zinc-800 border-zinc-700 text-zinc-400"
                      }`}
                    >
                      {settings.text_overlay.burn_captions ? "Active" : "Off"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: AUDIO MIXING */}
          {activeTab === "audio" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="global-music-select" className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Default Background Music Track
                </label>
                <select
                  id="global-music-select"
                  value={settings.audio_mix.background_music}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      audio_mix: { ...prev.audio_mix, background_music: e.target.value },
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="none">Original Video Audio Only (No Added Music)</option>
                  <option value="vice_city_synth">Vice City Neon Synth (Retro Wave)</option>
                  <option value="trap_beat">Viral Trap Hype Beat (Fast Pace)</option>
                  <option value="suspense_lofi">Dark Suspense Lo-Fi (Mystery / Curiosity)</option>
                </select>
              </div>

              {settings.audio_mix.background_music !== "none" && (
                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="music-vol-slider" className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      Music Volume Mix ({Math.round(settings.audio_mix.music_volume * 100)}%)
                    </label>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {settings.audio_mix.music_volume <= 0.15 ? "Subtle Ducking" : "Prominent"}
                    </span>
                  </div>

                  <input
                    id="music-vol-slider"
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.05"
                    value={settings.audio_mix.music_volume}
                    onChange={(e) =>
                      updateSettings((prev) => ({
                        ...prev,
                        audio_mix: { ...prev.audio_mix, music_volume: parseFloat(e.target.value) },
                      }))
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Recommended: 10%–20% so video speech remains 100% crisp and intelligible.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COVER THUMBNAIL */}
          {activeTab === "cover" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <div>
                  <h4 className="text-xs font-bold text-white">Slap Viral Cover Thumbnail Frame</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Concatenates a high-contrast 1-second opening cover frame so YouTube Shorts feed shows a high-CTR preview.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings((prev) => ({
                      ...prev,
                      cover_image: { ...prev.cover_image, enabled: !prev.cover_image.enabled },
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors min-h-[36px] ${
                    settings.cover_image.enabled
                      ? "bg-amber-400/20 border-amber-400/40 text-amber-300"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400"
                  }`}
                >
                  {settings.cover_image.enabled ? "Cover Active" : "No Cover Slap"}
                </button>
              </div>

              {settings.cover_image.enabled && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Default Cover Headline
                    </label>
                    <Input
                      value={settings.cover_image.headline}
                      onChange={(e) =>
                        updateSettings((prev) => ({
                          ...prev,
                          cover_image: { ...prev.cover_image, headline: e.target.value },
                        }))
                      }
                      placeholder="e.g. WAIT FOR WHAT HAPPENS NEXT..."
                      className="h-10 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-2">
                      Cover Theme Aesthetic
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "gta_action", label: "GTA Action", desc: "Neon Vice vibe" },
                        { id: "neon_glow", label: "Cyber Glow", desc: "Cyan/Pink beam" },
                        { id: "bold_text", label: "Bold Punch", desc: "Maximum curiosity" },
                        { id: "clean_minimal", label: "Clean Frame", desc: "Minimalist tone" },
                      ].map((th) => (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() =>
                            updateSettings((prev) => ({
                              ...prev,
                              cover_image: { ...prev.cover_image, theme: th.id },
                            }))
                          }
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            settings.cover_image.theme === th.id
                              ? "bg-amber-400/20 border-amber-400/60 text-white font-bold"
                              : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                          }`}
                        >
                          <span className="block text-xs font-bold">{th.label}</span>
                          <span className="block text-[10px] text-zinc-400 mt-0.5">{th.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: LAYOUT & PRIVACY */}
          {activeTab === "layout" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  Default 9:16 Vertical Framing
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "center_crop", label: "Center Crop", desc: "Edge-to-edge fill" },
                    { id: "blurred_background", label: "Blurred Canvas", desc: "Side glow border" },
                    { id: "stacked", label: "Split Stack", desc: "Dual vertical split" },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => updateSettings((prev) => ({ ...prev, layout: l.id }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        settings.layout === l.id
                          ? "bg-cyan-500/20 border-cyan-500/60 text-white font-bold"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      <span className="block text-xs font-bold">{l.label}</span>
                      <span className="block text-[10px] text-zinc-400 mt-0.5">{l.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  Default YouTube Upload Privacy
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "public", label: "Public", desc: "Immediate Shorts feed" },
                    { id: "unlisted", label: "Unlisted", desc: "Direct link only" },
                    { id: "private", label: "Private", desc: "Draft for review" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateSettings((prev) => ({ ...prev, default_privacy: p.id as "public" | "unlisted" | "private" }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        settings.default_privacy === p.id
                          ? "bg-cyan-500/20 border-cyan-500/60 text-white font-bold"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      <span className="block text-xs font-bold">{p.label}</span>
                      <span className="block text-[10px] text-zinc-400 mt-0.5">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Footer: Save to Database & Reset */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-zinc-400 hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset Defaults
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto shadow-md shadow-cyan-500/20 font-bold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving to Database...
                </>
              ) : hasSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400 stroke-[3]" />
                  Defaults Saved!
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save as Global Default
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
