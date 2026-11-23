"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Download, History, Sparkles, LogIn } from "lucide-react";
import { useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { RootState } from "@/lib/store";
import { YouTubeChannelItem } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { ChannelSwitcher } from "./channel-switcher";

interface HeaderProps {
  onOpenHistory: () => void;
  historyCount: number;
  onOpenAuth?: () => void;
}

export function Header({ onOpenHistory, historyCount, onOpenAuth }: HeaderProps) {
  const auth = useSelector((state: RootState) => state.auth);
  const [channels, setChannels] = useState<YouTubeChannelItem[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      if (typeof apiClient.getYouTubeChannels === "function") {
        const res = await apiClient.getYouTubeChannels();
        if (res?.channels) {
          setChannels(res.channels);
          if (res.active_channel_id) {
            setActiveChannelId(res.active_channel_id);
          } else if (res.channels.length > 0) {
            setActiveChannelId(res.channels[0].channel_id);
          }
        }
      }
    } catch {
      // Ignored if offline or unauthenticated
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  return (
    <header className="w-full border-b border-zinc-800/80 bg-[#08090c]/90 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-16">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Download className="w-4 h-4 text-zinc-950 font-bold" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-white tracking-tight">SaveIt</h1>
            <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 rounded-full px-2 py-0.5 uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              Pro
            </span>
          </div>
        </Link>

        {/* Right Section: Channel Switcher + Auth + History */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active YouTube Channel Switcher */}
          <ChannelSwitcher
            channels={channels}
            activeChannelId={activeChannelId}
            onChannelsUpdated={fetchChannels}
          />

          {/* User Sign In / Profile */}
          {onOpenAuth && (
            auth.isAuthenticated && auth.user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenAuth}
                aria-label="Account Settings"
                className="flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800/60"
              >
                <div className="w-6 h-6 rounded-full bg-cyan-600 text-[10px] font-bold text-white flex items-center justify-center border border-white/20">
                  {auth.user.name ? auth.user.name[0].toUpperCase() : auth.user.email[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline text-xs font-semibold max-w-[100px] truncate">
                  {auth.user.name || auth.user.email.split("@")[0]}
                </span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenAuth}
                aria-label="Sign In"
                className="flex items-center gap-1.5 text-zinc-300 hover:text-white"
              >
                <LogIn className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline text-xs font-semibold">Sign In</span>
              </Button>
            )
          )}

          {/* History Drawer Trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenHistory}
            aria-label="Download History"
            className="relative text-zinc-300 hover:text-white"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-semibold">History</span>
            {historyCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center text-[10px] font-bold bg-cyan-500 text-zinc-950 rounded-full shadow-sm">
                {historyCount > 99 ? "99+" : historyCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
