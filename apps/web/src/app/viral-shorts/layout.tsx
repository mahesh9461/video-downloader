import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Viral Shorts & Reel Generator — 9:16 AI Clipper",
  description:
    "Opus Clip style workflow: auto-detects high-retention hooks, reframes to vertical 9:16, and adds headline banners & background music.",
};

export default function ViralShortsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
