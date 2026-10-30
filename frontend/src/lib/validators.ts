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

export function detectPlatform(url: string): Platform | null {
  const trimmed = url.trim();
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

