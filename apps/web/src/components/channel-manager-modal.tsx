"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Video as Youtube,
  CheckCircle2,
  Plus,
  Trash2,
  ExternalLink,
  Lightbulb,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { YouTubeChannelItem } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface ChannelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: YouTubeChannelItem[];
  activeChannelId: string | null;
  onChannelsUpdated: () => void;
}

export function ChannelManagerModal({
  isOpen,
  onClose,
  channels,
  activeChannelId,
  onChannelsUpdated,
}: ChannelManagerModalProps) {
  const { success, error } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<YouTubeChannelItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConnectAnother = async () => {
    setIsConnecting(true);
    try {
      const authUrl = await apiClient.getYouTubeAuthUrl();
      if (authUrl) {
        window.location.href = authUrl;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to open Google OAuth sign-in.";
      error(errorMsg, "Connection Error");
      setIsConnecting(false);
    }
  };

  const handleSelectChannel = async (channelId: string) => {
    try {
      await apiClient.selectYouTubeChannel(channelId);
      success("Active channel updated!");
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("saveit_active_channel_id", channelId);
        } catch {}
      }
      onChannelsUpdated();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to switch active channel.";
      error(errorMsg);
    }
  };

  const handleConfirmDelete = async () => {
    if (!channelToDelete) return;
    setIsDeleting(true);
    try {
      await apiClient.deleteYouTubeChannel(channelToDelete.channel_id);
      success(`Disconnected ${channelToDelete.channel_title}`);
      onChannelsUpdated();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to disconnect channel.";
      error(errorMsg);
    } finally {
      setIsDeleting(false);
      setChannelToDelete(null);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="lg"
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <Youtube className="w-5 h-5" />
            </div>
            <span>Connected YouTube Channels</span>
          </div>
        }
        description="Manage your YouTube channels for 1-click Shorts publishing. You can connect multiple brand channels under the same Google account."
      >
        <div className="space-y-6">
          {/* Important Tip for Multiple Channels */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs leading-relaxed space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Lightbulb className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Connecting Multiple Channels under One Email:</span>
            </div>
            <p className="text-zinc-200 pl-5.5">
              On the Google authorization screen, pick the other channel to connect a second one. You can switch between them anytime before publishing!
            </p>
          </div>

          {/* Channels List */}
          <div className="space-y-3">
            {channels.length === 0 ? (
              <div className="text-center py-8 p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30">
                <Youtube className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-300">No YouTube channels connected yet</p>
                <p className="text-xs text-zinc-400 mt-1">Connect your channel to upload vertical Shorts directly.</p>
              </div>
            ) : (
              channels.map((ch) => {
                const isActive = ch.channel_id === activeChannelId;

                return (
                  <div
                    key={ch.channel_id}
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                      isActive
                        ? "bg-cyan-950/20 border-cyan-500/40 shadow-sm shadow-cyan-500/10"
                        : "bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700"
                    }`}
                  >
                    {/* Channel Thumbnail & Info */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-700 shrink-0">
                        {ch.thumbnail_url ? (
                          <Image
                            src={ch.thumbnail_url}
                            alt={ch.channel_title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-white bg-red-600 text-sm">
                            {ch.channel_title.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate">
                            {ch.channel_title}
                          </h4>
                          {isActive && (
                            <Badge variant="active" className="text-[10px] py-0 px-2">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-300 truncate">
                          {ch.email || "Google Account"}
                        </p>
                        {ch.subscriber_count && (
                          <p className="text-[11px] text-zinc-400">
                            {ch.subscriber_count} subscribers
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80">
                      {!isActive ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSelectChannel(ch.channel_id)}
                          className="text-xs"
                        >
                          Make default
                        </Button>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold px-2.5 py-1">
                          <Check className="w-3.5 h-3.5" />
                          Default Channel
                        </span>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setChannelToDelete(ch)}
                        aria-label={`Disconnect ${ch.channel_title}`}
                        className="text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Channel Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5">
            <Button
              type="button"
              variant="primary"
              onClick={handleConnectAnother}
              disabled={isConnecting}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {isConnecting ? "Connecting to Google..." : "Connect another channel"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Disconnect Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(channelToDelete)}
        onClose={() => setChannelToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Disconnect YouTube Channel?"
        description={`Are you sure you want to disconnect "${channelToDelete?.channel_title}"? You will not be able to publish Shorts to this channel until you reconnect it.`}
        confirmLabel="Disconnect Channel"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </>
  );
}
