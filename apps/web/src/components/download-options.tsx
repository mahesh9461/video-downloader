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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { VideoMetadata, VideoFormat } from "@/lib/types";
import { formatFileSize, cn } from "@/lib/utils";

interface DownloadOptionsProps {
  metadata: VideoMetadata;
  onDownload: (formatId: string, label: string) => void;
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

  if (metadata.platform === "tiktok") {
    return <TikTokOptions metadata={metadata} onDownload={onDownload} isDownloading={isDownloading} activeFormatId={activeFormatId} />;
  }

  return <YouTubeOptions metadata={metadata} onDownload={onDownload} isDownloading={isDownloading} activeFormatId={activeFormatId} selectedFormatId={selectedFormatId} setSelectedFormatId={setSelectedFormatId} />;
}

/* ─── YouTube Options ─── */

interface YouTubeOptionsProps {
  metadata: VideoMetadata;
  onDownload: (formatId: string, label: string) => void;
  isDownloading: boolean;
  activeFormatId: string | null;
  selectedFormatId: string | null;
  setSelectedFormatId: (id: string | null) => void;
}

function YouTubeOptions({ metadata, onDownload, isDownloading, activeFormatId, selectedFormatId, setSelectedFormatId }: YouTubeOptionsProps) {
  const videoFormats = metadata.formats.filter((f) => !f.is_audio_only);
  const audioFormats = metadata.formats.filter((f) => f.is_audio_only);

  const handleDownload = () => {
    if (!selectedFormatId) return;
    const format = metadata.formats.find((f) => f.format_id === selectedFormatId);
    if (format) {
      onDownload(selectedFormatId, format.label);
    }
  };

  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-150">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <MonitorPlay className="w-4 h-4 text-violet-400" />
          Download Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Formats */}
        {videoFormats.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Film className="w-3 h-3" />
              Video
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

        {videoFormats.length > 0 && audioFormats.length > 0 && <Separator />}

        {/* Audio Formats */}
        {audioFormats.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Music className="w-3 h-3" />
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

        {/* Download button */}
        <Button
          variant="gradient"
          size="lg"
          className="w-full mt-2"
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
  onDownload: (formatId: string, label: string) => void;
  isDownloading: boolean;
  activeFormatId: string | null;
}

function TikTokOptions({ metadata, onDownload, isDownloading, activeFormatId }: TikTokOptionsProps) {
  const videoFormat = metadata.formats.find((f) => !f.is_audio_only && f.label.toLowerCase().includes("no watermark"));
  const hdFormat = metadata.formats.find((f) => !f.is_audio_only && f.label.toLowerCase().includes("hd"));
  const audioFormat = metadata.formats.find((f) => f.is_audio_only);

  const buttons = [
    { format: videoFormat, icon: Smartphone, label: "No Watermark", sublabel: "Standard quality" },
    { format: hdFormat, icon: Sparkles, label: "HD Video", sublabel: "Best quality" },
    { format: audioFormat, icon: Music, label: "Extract Audio", sublabel: "MP3 format" },
  ].filter((b) => b.format);

  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-150">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="w-4 h-4 text-cyan-400" />
          TikTok Download
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {buttons.map(({ format, icon: Icon, label, sublabel }) => (
            <Button
              key={format!.format_id}
              variant="outline"
              className={cn(
                "h-auto py-4 px-4 justify-start gap-4 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all",
                activeFormatId === format!.format_id && isDownloading && "border-cyan-500/50 bg-cyan-500/5"
              )}
              disabled={isDownloading}
              onClick={() => onDownload(format!.format_id, label)}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10">
                {isDownloading && activeFormatId === format!.format_id ? (
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5 text-cyan-400" />
                )}
              </div>
              <div className="text-left">
                <div className="font-medium text-white text-sm">{label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{sublabel}</div>
              </div>
              {format!.filesize && (
                <Badge variant="secondary" className="ml-auto">
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
        "relative flex flex-col items-center gap-1 p-3 rounded-xl border transition-all duration-200 text-center",
        isSelected
          ? "border-violet-500/50 bg-violet-500/10 ring-1 ring-violet-500/20"
          : "border-zinc-800 bg-zinc-800/30 hover:border-zinc-700 hover:bg-zinc-800/60",
        isActive && isDownloading && "border-violet-500 bg-violet-500/20",
        isDownloading && !isActive && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className="text-sm font-semibold text-white">{format.label}</span>
      <span className="text-[10px] text-zinc-500 uppercase">{format.ext}</span>
      {format.filesize && (
        <span className="text-[10px] text-zinc-600">~{formatFileSize(format.filesize)}</span>
      )}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-violet-500 border-2 border-zinc-900" />
      )}
    </button>
  );
}

