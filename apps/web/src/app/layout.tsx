import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GoogleAnalytics } from "@/components/google-analytics";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://saveit.app";

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SaveIt — Free YouTube Downloader (4K/1080p) & TikTok Downloader No Watermark",
    template: "%s | SaveIt",
  },
  description:
    "Free online video downloader for YouTube and TikTok. Download 4K, 1080p MP4 videos without watermarks and convert to 320kbps MP3 audio at maximum speed. No software required.",
  keywords: [
    "YouTube downloader",
    "TikTok downloader without watermark",
    "save TikTok video without watermark",
    "download YouTube 4K",
    "download YouTube 1080p",
    "YouTube to MP3 converter 320kbps",
    "TikTok audio mp3 download",
    "watermark free video downloader",
    "online video saver",
    "convert youtube to mp4",
    "download youtube shorts",
    "fastest video downloader online",
  ],
  authors: [{ name: "SaveIt Engineering Team" }],
  creator: "SaveIt",
  publisher: "SaveIt",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "SaveIt Video Downloader",
    title: "SaveIt — Fast, Watermark-Free YouTube & TikTok Downloader",
    description:
      "Instant high-speed video downloads from YouTube & TikTok. Crisp 4K/1080p resolutions, watermark-free TikTok downloads, and crystal clear MP3 audio extraction.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SaveIt — Free High Quality Video Downloader",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SaveIt — Watermark-Free YouTube & TikTok Downloader",
    description:
      "Download HD/4K videos and MP3 audio from YouTube & TikTok with zero watermarks. Fast, secure, and free.",
    creator: "@SaveItApp",
    images: ["/og-image.png"],
  },
  category: "Utilities",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "SaveIt Video Downloader",
      url: siteUrl,
      description:
        "High-performance web tool for downloading watermark-free TikTok videos and 4K YouTube videos with audio extraction.",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "All",
      browserRequirements: "Requires modern web browser with HTML5 support",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "TikTok No Watermark Download",
        "YouTube 4K & 1080p 60FPS Video",
        "High-bitrate MP3 Audio Extraction",
        "Real-Time Download Progress Streaming",
        "Client-side Privacy & Local History",
      ],
    },
    {
      "@type": "HowTo",
      name: "How to Download Videos from YouTube and TikTok for Free",
      description: "Follow these simple steps to download high quality videos without watermarks using SaveIt.",
      step: [
        {
          "@type": "HowToStep",
          name: "Copy Video Link",
          text: "Copy the link of the YouTube video or TikTok clip you want to download.",
          url: `${siteUrl}#step1`,
        },
        {
          "@type": "HowToStep",
          name: "Paste URL and Select Format",
          text: "Paste the URL into SaveIt, view available formats (4K, 1080p, 720p, or MP3 audio), and choose your preferred resolution.",
          url: `${siteUrl}#step2`,
        },
        {
          "@type": "HowToStep",
          name: "Download File",
          text: "Watch the real-time download and conversion progress, and save the file directly to your device.",
          url: `${siteUrl}#step3`,
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How do I download TikTok videos without watermark?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Copy the TikTok link, paste it into SaveIt, and click 'No Watermark' to instantly download the clean original video.",
          },
        },
        {
          "@type": "Question",
          name: "Can I download 1080p and 4K YouTube videos with sound?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, SaveIt automatically merges high-resolution video streams with pristine audio tracks via server-side FFmpeg processing.",
          },
        },
        {
          "@type": "Question",
          name: "Is SaveIt completely free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, SaveIt is 100% free with no registration, subscription, or software installation required.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased text-zinc-100 selection:bg-violet-500/30 selection:text-violet-200">
        <GoogleAnalytics />
        <div className="gradient-bg" />
        <div className="noise-overlay" />
        <div className="grid-pattern" />
        {children}
      </body>
    </html>
  );
}
