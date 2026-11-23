"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Scissors, Eraser, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  const isDownloader = pathname === "/" || pathname === "/downloader" || pathname === "/download";
  const isShorts = pathname?.startsWith("/viral-shorts") || pathname?.startsWith("/clips") || pathname?.startsWith("/shorts");
  const isWatermark = pathname?.startsWith("/watermark");
  const isAutopilot = pathname?.startsWith("/autopilot");

  const navItems = [
    {
      label: "Downloader",
      href: "/",
      icon: Download,
      active: isDownloader,
    },
    {
      label: "Shorts Studio",
      href: "/viral-shorts",
      icon: Scissors,
      active: isShorts,
      badge: "AI",
    },
    {
      label: "Watermark",
      href: "/watermark",
      icon: Eraser,
      active: isWatermark,
    },
    {
      label: "Autopilot",
      href: "/autopilot",
      icon: Sparkles,
      active: isAutopilot,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0e14]/95 border-t border-zinc-800/80 backdrop-blur-xl px-2 py-1.5 flex items-center justify-around shadow-2xl"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl min-h-[48px] transition-all relative",
              item.active
                ? "text-cyan-400 font-bold"
                : "text-zinc-400 hover:text-white"
            )}
          >
            <div className="relative">
              <Icon className={cn("w-5 h-5", item.active ? "stroke-[2.5]" : "stroke-2")} />
              {item.badge && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-cyan-500 text-zinc-950 text-[9px] font-black">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-1">
              {item.label}
            </span>
            {item.active && (
              <span className="absolute bottom-0.5 w-6 h-1 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
