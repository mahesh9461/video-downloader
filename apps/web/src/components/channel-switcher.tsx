"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Video as Youtube, ChevronDown, Check, Plus, Settings } from "lucide-react";
import { YouTubeChannelItem } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ChannelManagerModal } from "./channel-manager-modal";

export interface ChannelSwitcherProps {
  channels: YouTubeChannelItem[];
  activeChannelId: string | null;
  onChannelsUpdated: () => void;
}

export function ChannelSwitcher({
  channels,
  activeChannelId,
  onChannelsUpdated,
}: ChannelSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { success, error } = useToast();

  const activeChannel = channels.find((c) => c.channel_id === activeChannelId) || channels[0] || null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = async (channelId: string) => {
    setIsOpen(false);
    if (channelId === activeChannelId) return;
    try {
      await apiClient.selectYouTubeChannel(channelId);
      success("Active channel switched!");
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("saveit_active_channel_id", channelId);
        } catch {}
      }
      onChannelsUpdated();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to switch channel.";
      error(errorMsg);
    }
  };

  const handleConnect = async () => {
    setIsOpen(false);
    try {
      const url = await apiClient.getYouTubeAuthUrl();
      if (url) window.location.href = url;
    } catch {
      setIsManagerOpen(true);
    }
  };

  if (channels.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsManagerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold transition-all shadow-sm"
        >
          <Youtube className="w-3.5 h-3.5 text-red-400" />
          <span>Connect Channel</span>
        </button>
        <ChannelManagerModal
          isOpen={isManagerOpen}
          onClose={() => setIsManagerOpen(false)}
          channels={channels}
          activeChannelId={activeChannelId}
          onChannelsUpdated={onChannelsUpdated}
        />
      </>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Switch active YouTube channel"
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-zinc-700/80 bg-zinc-900/90 hover:bg-zinc-800 text-white text-xs font-medium transition-all shadow-sm"
      >
        <div className="relative w-6 h-6 rounded-full overflow-hidden bg-red-600 shrink-0 border border-white/20">
          {activeChannel?.thumbnail_url ? (
            <Image
              src={activeChannel.thumbnail_url}
              alt={activeChannel.channel_title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-[10px] text-white">
              {activeChannel?.channel_title.substring(0, 1).toUpperCase() || "Y"}
            </div>
          )}
        </div>

        <div className="hidden md:flex flex-col text-left max-w-[120px]">
          <span className="truncate text-xs font-bold text-white">
            {activeChannel?.channel_title || "Select Channel"}
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold leading-none">
            Active
          </span>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-label="YouTube Channels"
          className="absolute right-0 mt-2 w-64 rounded-2xl border border-zinc-700/80 bg-[#12151f] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-2 border-b border-white/5">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              YouTube Channels
            </span>
            <span className="text-xs text-zinc-300">
              Pick channel to publish Shorts
            </span>
          </div>

          <div className="py-1 max-h-56 overflow-y-auto space-y-0.5">
            {channels.map((ch) => {
              const isActive = ch.channel_id === (activeChannel?.channel_id || activeChannelId);
              return (
                <button
                  key={ch.channel_id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(ch.channel_id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300 font-bold"
                      : "text-zinc-200 hover:bg-zinc-800/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-6 h-6 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                      {ch.thumbnail_url ? (
                        <Image
                          src={ch.thumbnail_url}
                          alt={ch.channel_title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-[9px] text-white bg-red-600">
                          {ch.channel_title.substring(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{ch.channel_title}</p>
                      {ch.subscriber_count && (
                        <p className="text-[10px] text-zinc-400 font-normal">{ch.subscriber_count} subs</p>
                      )}
                    </div>
                  </div>

                  {isActive && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="pt-2 mt-1 border-t border-white/5 space-y-1">
            <button
              type="button"
              onClick={handleConnect}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect another channel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsManagerOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Manage all channels...</span>
            </button>
          </div>
        </div>
      )}

      <ChannelManagerModal
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        channels={channels}
        activeChannelId={activeChannelId}
        onChannelsUpdated={onChannelsUpdated}
      />
    </div>
  );
}
