export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID || "";

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Extracts YouTube video ID from various YouTube URL formats
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Detect user country code or fallback to timezone from client browser
 */
export function getUserCountry(): string {
  if (typeof window === "undefined") return "unknown";
  try {
    const lang = navigator.language || "";
    if (lang.includes("-")) {
      const countryCode = lang.split("-")[1].toUpperCase();
      if (countryCode.length === 2) return countryCode;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || "unknown";
  } catch {
    return "unknown";
  }
}

// Track page session start time
let pageLoadTimestamp = typeof window !== "undefined" ? Date.now() : 0;

/**
 * Returns number of seconds user has spent on the page
 */
export function getTimeSpentSeconds(): number {
  if (!pageLoadTimestamp) return 0;
  return Math.max(0, Math.round((Date.now() - pageLoadTimestamp) / 1000));
}

export interface LogAnalyticsParams {
  event: string;
  category?: string;              // e.g. "download", "search", "engagement", "error"
  country?: string;               // e.g. "US", "IN", "DE" or auto-detected
  timeSpent?: number;             // Time in seconds or auto-calculated
  contentId?: string;             // Content/Video identifier
  youtubeId?: string;             // YouTube 11-char ID or extracted
  platform?: string;              // "youtube" | "tiktok" | "other"
  url?: string;                   // Video URL or page URL
  title?: string;                 // Video title
  format?: string;                // e.g. "1080p MP4", "320kbps MP3"
  quality?: string;               // e.g. "1080p", "4K"
  isAudio?: boolean;              // true if audio extraction
  error?: string;                 // Error message
  errorType?: string;             // e.g. "network", "private", "rate_limit"
  metadata?: Record<string, any>; // Extra parameters
}

/**
 * Consolidated master analytics logging function.
 * Tracks Category, Country, Time Spent, Content ID, YouTube ID, and custom metadata.
 */
export function logAnalytics(params: LogAnalyticsParams) {
  if (typeof window === "undefined" || !window.gtag) {
    return;
  }

  const detectedYoutubeId =
    params.youtubeId || (params.url ? extractYouTubeId(params.url) : null) || "none";
  const detectedCountry = params.country || getUserCountry();
  const calculatedTimeSpent = params.timeSpent ?? getTimeSpentSeconds();

  const payload: Record<string, any> = {
    event_category: params.category || "general",
    user_country: detectedCountry,
    time_spent_seconds: calculatedTimeSpent,
    content_id: params.contentId || detectedYoutubeId,
    youtube_id: detectedYoutubeId,
    video_platform: params.platform || "unknown",
    video_format: params.format,
    video_quality: params.quality,
    video_title: params.title,
    is_audio: params.isAudio,
    error_message: params.error,
    error_type: params.errorType,
    page_url: params.url || (typeof window !== "undefined" ? window.location.href : ""),
    ...params.metadata,
  };

  // Strip undefined values for clean GA4 payload
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  try {
    window.gtag("event", params.event, payload);
  } catch {
    // Fail silently in development or when blocked by privacy extensions
  }
}

/**
 * Standard page view tracking delegating to logAnalytics
 */
export function trackPageView(url: string) {
  if (typeof window === "undefined" || !window.gtag) {
    return;
  }
  if (GA_TRACKING_ID) {
    try {
      window.gtag("config", GA_TRACKING_ID, {
        page_path: url,
      });
    } catch {
      // Fail silently
    }
  }

  logAnalytics({
    event: "page_view",
    category: "engagement",
    url,
  });
}

/**
 * Track video search query
 */
export function trackVideoSearch(data: { platform: string; url: string }) {
  const ytId = extractYouTubeId(data.url);
  logAnalytics({
    event: "video_search",
    category: "search",
    platform: data.platform,
    url: data.url,
    contentId: ytId || data.url,
    youtubeId: ytId || "none",
  });
}

/**
 * Track video download started
 */
export function trackDownloadStart(data: {
  platform: string;
  title: string;
  format: string;
  quality?: string;
  is_audio?: boolean;
  url?: string;
}) {
  const ytId = data.url ? extractYouTubeId(data.url) : null;
  logAnalytics({
    event: "video_download_started",
    category: "download",
    platform: data.platform,
    title: data.title,
    format: data.format,
    quality: data.quality || "standard",
    isAudio: !!data.is_audio,
    contentId: ytId || data.title,
    youtubeId: ytId || "none",
  });
}

/**
 * Track video download completed successfully
 */
export function trackDownloadComplete(data: {
  platform: string;
  title: string;
  format: string;
  duration_seconds?: number;
  url?: string;
}) {
  const ytId = data.url ? extractYouTubeId(data.url) : null;
  logAnalytics({
    event: "video_download_completed",
    category: "download",
    platform: data.platform,
    title: data.title,
    format: data.format,
    contentId: ytId || data.title,
    youtubeId: ytId || "none",
    metadata: {
      duration_seconds: data.duration_seconds || 0,
    },
  });
}

/**
 * Track download errors
 */
export function trackDownloadError(data: {
  platform?: string;
  error_message: string;
  error_type?: string;
  url?: string;
}) {
  const ytId = data.url ? extractYouTubeId(data.url) : null;
  logAnalytics({
    event: "video_download_error",
    category: "error",
    platform: data.platform || "unknown",
    error: data.error_message,
    errorType: data.error_type || "unknown",
    contentId: ytId || "unknown",
    youtubeId: ytId || "none",
  });
}

/**
 * Track FAQ interaction
 */
export function trackFaqClick(question: string) {
  logAnalytics({
    event: "faq_interaction",
    category: "help",
    contentId: question,
    metadata: {
      faq_question: question,
    },
  });
}

/**
 * Track history drawer actions
 */
export function trackHistoryAction(action: "open" | "clear" | "redownload", itemCount?: number) {
  logAnalytics({
    event: "history_action",
    category: "history",
    contentId: action,
    metadata: {
      action,
      item_count: itemCount ?? 0,
    },
  });
}
