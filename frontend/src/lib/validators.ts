import { Platform } from "./types";

const YOUTUBE_PATTERNS = [
  /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]{11}/,
  /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]{11}/,
  /^(https?:\/\/)?youtu\.be\/[\w-]{11}/,
  /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]{11}/,
  /^(https?:\/\/)?(m\.)?youtube\.com\/watch\?v=[\w-]{11}/,
];

const TIKTOK_PATTERNS = [
  /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
  /^(https?:\/\/)?(vm|vt)\.tiktok\.com\/[\w]+/,
  /^(https?:\/\/)?(www\.)?tiktok\.com\/t\/[\w]+/,
];

export function cleanVideoUrl(url: string): string {
  const trimmed = url.trim();
  // Strip playlist and mix parameters so only the single target video is loaded
  if ((trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) && (trimmed.includes("&list=") || trimmed.includes("?list="))) {
    const match = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  }
  return trimmed;
}

export function detectPlatform(url: string): Platform | null {
  const trimmed = cleanVideoUrl(url);
  if (!trimmed) return null;

  for (const pattern of YOUTUBE_PATTERNS) {
    if (pattern.test(trimmed)) return "youtube";
  }

  for (const pattern of TIKTOK_PATTERNS) {
    if (pattern.test(trimmed)) return "tiktok";
  }

  return null;
}

export function isValidUrl(url: string): boolean {
  return detectPlatform(url) !== null;
}
