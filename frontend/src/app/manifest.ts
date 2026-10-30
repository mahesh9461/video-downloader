import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SaveIt — Fast YouTube & TikTok Video Downloader",
    short_name: "SaveIt",
    description: "Download watermark-free videos from YouTube and TikTok in 4K, 1080p, or high-quality MP3 audio.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#7c3aed",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}

