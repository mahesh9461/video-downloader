import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Watermark Remover — Clean Video Logos & Overlays",
  description:
    "Clean TikTok logos, creator usernames, and unwanted static overlays with precision FFmpeg inpainting.",
};

export default function WatermarkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
