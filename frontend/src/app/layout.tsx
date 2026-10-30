import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    default: "SaveIt — Fast, Watermark-Free YouTube & TikTok Downloader",
    template: "%s | SaveIt",
  },
  description:
    "Download videos from YouTube and TikTok in pristine 4K, 1080p, 720p or 320kbps MP3 audio. 100% free, no watermarks, no registration, and ultra-fast processing.",
  keywords: [
    "YouTube downloader",
    "TikTok downloader without watermark",
    "save TikTok video",
    "download YouTube 4K",
    "YouTube to MP3",
    "TikTok to MP3",
    "watermark free video downloader",
    "online video saver",
    "convert youtube to mp4",
    "download tiktok audio",
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
      name: "SaveIt",
      url: siteUrl,
      description:
        "High-performance web tool for downloading watermark-free TikTok videos and 4K YouTube videos with audio extraction.",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "All",
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
        <div className="gradient-bg" />
        <div className="noise-overlay" />
        <div className="grid-pattern" />
        {children}
      </body>
    </html>
  );
}
