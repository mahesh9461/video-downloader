"use client";

import { useState } from "react";
import {
  Download,
  Film,
  Music,
  MonitorPlay,
  Smartphone,
  Sparkles,
  Loader2,
  ShieldCheck,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { VideoMetadata, VideoFormat } from "@/lib/types";
import { formatFileSize, cn } from "@/lib/utils";

interface DownloadOptionsProps {
  metadata: VideoMetadata;
  onDownload: (formatId: string, label: string, antiCopyrightShield?: boolean, muteAudio?: boolean) => void;
  isDownloading: boolean;
  activeFormatId: string | null;
}

export function DownloadOptions({
  metadata,
  onDownload,
  isDownloading,
  activeFormatId,
}: DownloadOptionsProps) {
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
  const [antiCopyrightShield, setAntiCopyrightShield] = useState<boolean>(true);
  const [muteAudio, setMuteAudio] = useState<boolean>(false);

  if (metadata.platform === "tiktok") {
    return (
      <TikTokOptions
        metadata={metadata}
        onDownload={onDownload}
        isDownloading={isDownloading}
        activeFormatId={activeFormatId}
        antiCopyrightShield={antiCopyrightShield}
        setAntiCopyrightShield={setAntiCopyrightShield}
        muteAudio={muteAudio}
        setMuteAudio={setMuteAudio}
      />
    );
  }

  if (metadata.platform === "instagram") {
    return (
      <InstagramOptions
        metadata={metadata}
        onDownload={onDownload}
        isDownloading={isDownloading}
        activeFormatId={activeFormatId}
        antiCopyrightShield={antiCopyrightShield}
        setAntiCopyrightShield={setAntiCopyrightShield}
        muteAudio={muteAudio}
        setMuteAudio={setMuteAudio}
      />
    );
  }

  return (
    <YouTubeOptions
      metadata={metadata}
      onDownload={onDownload}
      isDownloading={isDownloading}
      activeFormatId={activeFormatId}
      selectedFormatId={selectedFormatId}
      setSelectedFormatId={setSelectedFormatId}
      antiCopyrightShield={antiCopyrightShield}
      setAntiCopyrightShield={setAntiCopyrightShield}
      muteAudio={muteAudio}
      setMuteAudio={setMuteAudio}
    />
  );
}

/* ─── YouTube Options ─── */

interface YouTubeOptionsProps {
  metadata: VideoMetadata;
  onDownload: (formatId: string, label: string, antiCopyrightShield?: boolean, muteAudio?: boolean) => void;
  isDownloading: boolean;
  activeFormatId: string | null;
  selectedFormatId: string | null;
  setSelectedFormatId: (id: string | null) => void;
  antiCopyrightShield: boolean;
  setAntiCopyrightShield: (v: boolean) => void;
  muteAudio: boolean;
  setMuteAudio: (v: boolean) => void;
}

function YouTubeOptions({
  metadata,
  onDownload,
  isDownloading,
  activeFormatId,
  selectedFormatId,
  setSelectedFormatId,
  antiCopyrightShield,
  setAntiCopyrightShield,
  muteAudio,
  setMuteAudio,
}: YouTubeOptionsProps) {
  const videoFormats = metadata.formats.filter((f) => !f.is_audio_only);
  const audioFormats = metadata.formats.filter((f) => f.is_audio_only);

  const handleDownload = () => {
    if (!selectedFormatId) return;
    const format = metadata.formats.find((f) => f.format_id === selectedFormatId);
    if (format) {
      onDownload(selectedFormatId, format.label, antiCopyrightShield, muteAudio);
    }
  };

  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-150 border-white/10 bg-[#12151f]/90 shadow-xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2 text-white font-bold">
          <MonitorPlay className="w-4 h-4 text-cyan-400" />
          Download Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {metadata.notice && (
          <div className="p-3 text-sm rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
            {metadata.notice}
          </div>
        )}
        {/* Video Formats */}
        {videoFormats.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Film className="w-3.5 h-3.5 text-cyan-400" />
              Video Resolution
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {videoFormats.map((format) => (
                <FormatButton
                  key={format.format_id}
                  format={format}
                  isSelected={selectedFormatId === format.format_id}
                  isActive={activeFormatId === format.format_id}
                  isDownloading={isDownloading}
                  onClick={() => setSelectedFormatId(format.format_id)}
                />
              ))}
            </div>
          </div>
        )}

        {videoFormats.length > 0 && audioFormats.length > 0 && <Separator className="bg-white/5" />}

        {/* Audio Formats */}
        {audioFormats.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Music className="w-3.5 h-3.5 text-cyan-400" />
              Audio Only
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {audioFormats.map((format) => (
                <FormatButton
                  key={format.format_id}
                  format={format}
                  isSelected={selectedFormatId === format.format_id}
                  isActive={activeFormatId === format.format_id}
                  isDownloading={isDownloading}
                  onClick={() => setSelectedFormatId(format.format_id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Anti-Copyright & Audio Cloaking Controls */}
        <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-white block">Anti-Copyright Shield</span>
                <span className="text-[11px] text-zinc-300 block">Modifies pitch (+4%), tempo, & EQ to bypass YouTube Content ID</span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={antiCopyrightShield}
              aria-label="Anti-Copyright Shield"
              onClick={() => setAntiCopyrightShield(!antiCopyrightShield)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                antiCopyrightShield ? "bg-cyan-500" : "bg-zinc-700"
              }`}
            >
              <div
                className={`bg-zinc-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  antiCopyrightShield ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-zinc-400 shrink-0" />
              <div>
                <span className="text-xs font-medium text-zinc-300 block">Mute Audio</span>
                <span className="text-[10px] text-zinc-400 block">Remove audio track completely</span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={muteAudio}
              aria-label="Mute Audio"
              onClick={() => setMuteAudio(!muteAudio)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                muteAudio ? "bg-rose-500" : "bg-zinc-700"
              }`}
            >
              <div
                className={`bg-zinc-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  muteAudio ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Download button */}
        <Button
          variant="gradient"
          size="lg"
          className="w-full mt-2 font-bold min-h-[48px] shadow-lg shadow-cyan-500/20"
          disabled={!selectedFormatId || isDownloading}
          onClick={handleDownload}
        >
          {isDownloading && activeFormatId ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download Selected
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── TikTok Options ─── */

interface TikTokOptionsProps {
  metadata: VideoMetadata;
  onDownload: (formatId: string, label: string, antiCopyrightShield?: boolean, muteAudio?: boolean) => void;
  isDownloading: boolean;
  activeFormatId: string | null;
  antiCopyrightShield: boolean;
  setAntiCopyrightShield: (v: boolean) => void;
  muteAudio: boolean;
  setMuteAudio: (v: boolean) => void;
}

function TikTokOptions({
  metadata,
  onDownload,
  isDownloading,
  activeFormatId,
  antiCopyrightShield,
  setAntiCopyrightShield,
  muteAudio,
  setMuteAudio,
}: TikTokOptionsProps) {
  const videoFormat = metadata.formats.find((f) => !f.is_audio_only && f.label.toLowerCase().includes("no watermark"));
  const hdFormat = metadata.formats.find((f) => !f.is_audio_only && f.label.toLowerCase().includes("hd"));
  const audioFormat = metadata.formats.find((f) => f.is_audio_only);

  const buttons = [
    { format: videoFormat, icon: Smartphone, label: "No Watermark", sublabel: "Clean MP4 without logo" },
    { format: hdFormat, icon: Sparkles, label: "HD Video", sublabel: "Original resolution" },
    { format: audioFormat, icon: Music, label: "Extract Audio", sublabel: "High bitrate MP3" },
  ].filter((b) => b.format);

  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-150 border-white/10 bg-[#12151f]/90 shadow-xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2 text-white font-bold">
          <Download className="w-4 h-4 text-cyan-400" />
          TikTok Download
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Anti-Copyright & Audio Cloaking Controls */}
        <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-white block">Anti-Copyright Shield</span>
                <span className="text-[11px] text-zinc-300 block">Modifies pitch (+4%), tempo, & EQ to bypass YouTube Content ID</span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={antiCopyrightShield}
              aria-label="Anti-Copyright Shield"
              onClick={() => setAntiCopyrightShield(!antiCopyrightShield)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                antiCopyrightShield ? "bg-cyan-500" : "bg-zinc-700"
              }`}
            >
              <div
                className={`bg-zinc-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  antiCopyrightShield ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-zinc-400 shrink-0" />
              <div>
                <span className="text-xs font-medium text-zinc-300 block">Mute Audio</span>
                <span className="text-[10px] text-zinc-400 block">Remove audio track completely</span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={muteAudio}
              aria-label="Mute Audio"
              onClick={() => setMuteAudio(!muteAudio)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                muteAudio ? "bg-rose-500" : "bg-zinc-700"
              }`}
            >
              <div
                className={`bg-zinc-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  muteAudio ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {buttons.map(({ format, icon: Icon, label, sublabel }) => (
            <Button
              key={format!.format_id}
              variant="outline"
              className={cn(
                "h-auto py-3.5 px-4 justify-start gap-4 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all min-h-[56px]",
                activeFormatId === format!.format_id && isDownloading && "border-cyan-500 bg-cyan-500/15"
              )}
              disabled={isDownloading}
              onClick={() => onDownload(format!.format_id, label, antiCopyrightShield, muteAudio)}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 shrink-0">
                {isDownloading && activeFormatId === format!.format_id ? (
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5 text-cyan-400" />
                )}
              </div>
              <div className="text-left">
                <div className="font-bold text-white text-sm">{label}</div>
                <div className="text-xs text-zinc-300 mt-0.5">{sublabel}</div>
              </div>
              {format!.filesize && (
                <Badge variant="secondary" className="ml-auto font-mono text-xs">
                  {formatFileSize(format!.filesize)}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Format Button (YouTube) ─── */

interface FormatButtonProps {
  format: VideoFormat;
  isSelected: boolean;
  isActive: boolean;
  isDownloading: boolean;
  onClick: () => void;
}

function FormatButton({ format, isSelected, isActive, isDownloading, onClick }: FormatButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isDownloading}
      className={cn(
        "relative flex flex-col items-center gap-1 p-3 rounded-xl border transition-all duration-200 text-center min-h-[56px] justify-center",
        isSelected
          ? "border-cyan-500 bg-cyan-500/15 ring-2 ring-cyan-500/30 text-white font-bold"
          : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-200",
        isActive && isDownloading && "border-cyan-500 bg-cyan-500/20",
        isDownloading && !isActive && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className="text-sm font-bold text-white">{format.label}</span>
      <span className="text-[11px] text-zinc-300 font-semibold uppercase">{format.ext}</span>
      {format.filesize && (
        <span className="text-[11px] text-zinc-400 font-mono">~{formatFileSize(format.filesize)}</span>
      )}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 border-2 border-zinc-950 shadow-sm" />
      )}
    </button>
  );
}

/* ─── Instagram Options ─── */

interface InstagramOptionsProps {
  metadata: VideoMetadata;
  onDownload: (formatId: string, label: string, antiCopyrightShield?: boolean, muteAudio?: boolean) => void;
  isDownloading: boolean;
  activeFormatId: string | null;
  antiCopyrightShield: boolean;
  setAntiCopyrightShield: (v: boolean) => void;
  muteAudio: boolean;
  setMuteAudio: (v: boolean) => void;
}

function InstagramOptions({
  metadata,
  onDownload,
  isDownloading,
  activeFormatId,
  antiCopyrightShield,
  setAntiCopyrightShield,
  muteAudio,
  setMuteAudio,
}: InstagramOptionsProps) {
  const videoFormat = metadata.formats.find((f) => !f.is_audio_only);
  const audioFormat = metadata.formats.find((f) => f.is_audio_only);

  const buttons = [
    { format: videoFormat, icon: Sparkles, label: "Download Reel (HD)", sublabel: "MP4 Video format" },
    { format: audioFormat, icon: Music, label: "Extract Audio", sublabel: "MP3 Audio format" },
  ].filter((b) => b.format);

  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-150 border-white/10 bg-[#12151f]/90 shadow-xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2 text-white font-bold">
          <Download className="w-4 h-4 text-pink-400" />
          Instagram Reel Download
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {metadata.notice && (
          <div className="p-3 text-sm rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
            {metadata.notice}
          </div>
        )}

        {/* Anti-Copyright & Audio Cloaking Controls */}
        <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-white block">Anti-Copyright Shield</span>
                <span className="text-[11px] text-zinc-300 block">Modifies pitch (+4%), tempo, & EQ to bypass YouTube Content ID</span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={antiCopyrightShield}
              aria-label="Anti-Copyright Shield"
              onClick={() => setAntiCopyrightShield(!antiCopyrightShield)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                antiCopyrightShield ? "bg-cyan-500" : "bg-zinc-700"
              }`}
            >
              <div
                className={`bg-zinc-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  antiCopyrightShield ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-zinc-400 shrink-0" />
              <div>
                <span className="text-xs font-medium text-zinc-300 block">Mute Audio</span>
                <span className="text-[10px] text-zinc-400 block">Remove audio track completely</span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={muteAudio}
              aria-label="Mute Audio"
              onClick={() => setMuteAudio(!muteAudio)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                muteAudio ? "bg-rose-500" : "bg-zinc-700"
              }`}
            >
              <div
                className={`bg-zinc-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  muteAudio ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {buttons.map(({ format, icon: Icon, label, sublabel }) => (
            <Button
              key={format!.format_id}
              variant="outline"
              className={cn(
                "h-auto py-3.5 px-4 justify-start gap-4 hover:border-pink-500/50 hover:bg-pink-500/10 transition-all min-h-[56px]",
                activeFormatId === format!.format_id && isDownloading && "border-pink-500/50 bg-pink-500/10"
              )}
              disabled={isDownloading}
              onClick={() => onDownload(format!.format_id, label, antiCopyrightShield, muteAudio)}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-pink-500/10 shrink-0">
                {isDownloading && activeFormatId === format!.format_id ? (
                  <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5 text-pink-400" />
                )}
              </div>
              <div className="text-left">
                <div className="font-bold text-white text-sm">{label}</div>
                <div className="text-xs text-zinc-300 mt-0.5">{sublabel}</div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
