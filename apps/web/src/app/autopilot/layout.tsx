import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GTA 6 Viral Shorts Autopilot — Automated Clipper & Publisher",
  description:
    "Autonomous high-retention GTA 6 gameplay clipper with automated hook detection, smart captioning, and scheduled YouTube Shorts publishing.",
};

export default function AutopilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
