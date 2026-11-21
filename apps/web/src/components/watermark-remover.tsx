"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  Eraser,
  Film,
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCcw,
  Sliders,
  Settings2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { WatermarkResult } from "@/lib/types";
import { formatFileSize } from "@/lib/utils";

export function WatermarkRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<"preset" | "auto" | "manual">("preset");
  const platform = "tiktok";
  const [band, setBand] = useState<number>(4);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WatermarkResult | null>(null);

  // Manual box coordinates
  const [manualX, setManualX] = useState<number>(25);
  const [manualY, setManualY] = useState<number>(25);
  const [manualW, setManualW] = useState<number>(300);
  const [manualH, setManualH] = useState<number>(80);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setError(null);
    setResult(null);

    const validExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(ext)) {
      setError(`Unsupported file format. Please upload an MP4, MOV, WEBM, AVI, or MKV video.`);
      return;
    }

    if (selectedFile.size > 100 * 1024 * 1024) {
      setError("File exceeds the 100 MB limit. Please select a smaller video.");
      return;
    }

    setFile(selectedFile);
    if (previewUrl && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(previewUrl);
    }
    if (typeof URL.createObjectURL === "function") {
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  }, [previewUrl]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleProcess = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("video", file);
      formData.append("mode", mode);
      formData.append("band", band.toString());

      if (mode === "preset") {
        formData.append("platform", platform);
      } else if (mode === "manual") {
        const regions = [{ x: manualX, y: manualY, w: manualW, h: manualH }];
        formData.append("regions_json", JSON.stringify(regions));
      }

      const res = await apiClient.removeWatermark(formData);
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to remove watermark. Please try another mode or video.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (previewUrl && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in-0 duration-300">
      {/* Upload Zone */}
      {!file && (
        <Card
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-800 hover:border-violet-500/50 bg-zinc-900/40 hover:bg-zinc-900/70 transition-all cursor-pointer p-8 sm:p-12 text-center group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/avi"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform shadow-lg shadow-violet-500/10">
              <Upload className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-white text-lg">
                Upload a video to remove watermarks
              </h3>
              <p className="text-sm text-zinc-400 max-w-sm">
                Drag and drop your file here, or click to browse. Supports MP4, MOV, WEBM, and MKV up to 100MB.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="text-xs text-zinc-500 bg-zinc-800/80 px-2.5 py-1 rounded-full">
                TikTok Auto-Clean
              </span>
              <span className="text-xs text-zinc-500 bg-zinc-800/80 px-2.5 py-1 rounded-full">
                Static Logo Detection
              </span>
              <span className="text-xs text-zinc-500 bg-zinc-800/80 px-2.5 py-1 rounded-full">
                Zero Quality Loss
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Selected Video Config & Processing */}
      {file && !result && (
        <Card className="border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <CardContent className="p-6 space-y-6">
            {/* File Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                  <Film className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{file.name}</p>
                  <p className="text-xs text-zinc-400">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isProcessing}
                className="text-zinc-400 hover:text-white"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Change
              </Button>
            </div>

            {/* Mode Selection */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-violet-400" />
                Removal Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode("preset")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    mode === "preset"
                      ? "border-violet-500 bg-violet-500/10 text-white shadow-sm shadow-violet-500/10"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-medium text-sm text-white">TikTok Preset</div>
                  <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Auto-cleans username & bottom logo
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("auto")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    mode === "auto"
                      ? "border-violet-500 bg-violet-500/10 text-white shadow-sm shadow-violet-500/10"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-medium text-sm text-white">Smart Auto-Detect</div>
                  <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Finds static watermarks via frame analysis
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    mode === "manual"
                      ? "border-violet-500 bg-violet-500/10 text-white shadow-sm shadow-violet-500/10"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-medium text-sm text-white">Custom Box</div>
                  <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Enter custom pixel rectangle coordinates
                  </div>
                </button>
              </div>
            </div>

            {/* Manual Coordinates Form */}
            {mode === "manual" && (
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3 animate-in fade-in-0 duration-200">
                <div className="text-xs font-medium text-zinc-300">Watermark Rectangle (Pixels):</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] text-zinc-400">X (Left)</label>
                    <input
                      type="number"
                      value={manualX}
                      onChange={(e) => setManualX(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">Y (Top)</label>
                    <input
                      type="number"
                      value={manualY}
                      onChange={(e) => setManualY(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">Width</label>
                    <input
                      type="number"
                      value={manualW}
                      onChange={(e) => setManualW(Math.max(10, parseInt(e.target.value) || 10))}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">Height</label>
                    <input
                      type="number"
                      value={manualH}
                      onChange={(e) => setManualH(Math.max(10, parseInt(e.target.value) || 10))}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Edge Smoothness Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-violet-400" />
                  Edge Transition Smoothness
                </span>
                <span className="text-zinc-300 font-medium">{band} px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={band}
                onChange={(e) => setBand(parseInt(e.target.value))}
                className="w-full accent-violet-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Button */}
            <Button
              variant="gradient"
              size="lg"
              onClick={handleProcess}
              disabled={isProcessing}
              className="w-full font-semibold"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Processing Video with FFmpeg...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Eraser className="w-4 h-4" />
                  Remove Watermark Now
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result Card */}
      {result && (
        <Card className="border-emerald-500/30 bg-zinc-900/80 overflow-hidden shadow-xl shadow-emerald-500/5 animate-in fade-in-0 duration-300">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">Watermark Successfully Removed!</h3>
                <p className="text-xs text-zinc-400">
                  Clean MP4 video ready • {formatFileSize(result.filesize)}
                </p>
              </div>
            </div>

            {/* Clean Video Player */}
            <div className="rounded-xl overflow-hidden bg-black border border-zinc-800 aspect-video max-h-80 flex items-center justify-center">
              <video
                src={result.download_url}
                controls
                className="w-full h-full object-contain"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                variant="gradient"
                className="w-full sm:flex-1"
                asChild
              >
                <a href={result.download_url} download={result.filename}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Clean Video
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Process Another Video
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
