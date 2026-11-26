"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Sliders,
  Check,
  Tag as TagIcon,
  X,
  Plus,
  Save,
  Loader2,
  FolderOpen,
  FileText,
  Shield,
  HelpCircle,
  Gamepad2,
  Sparkles,
  Info,
} from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { YouTubeChannelItem, UpdateChannelSettingsRequest } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export const GTA6_PRESET = {
  categoryId: "20",
  gameTitle: "Grand Theft Auto VI",
  madeForKids: false,
  aiGenerated: false,
  paidPromotion: false,
  description:
    "Welcome to GTA World: ViceVerse — your daily hub for GTA 6 Shorts, live gameplay streams, hidden Leonida secrets, Vice City map discoveries, crazy physics tests, and launch-week moments with Jason and Lucia.\n\n" +
    "Subscribe and turn on notifications so you never miss a daily Short or live stream!\n\n" +
    "🎮 Game: Grand Theft Auto VI (Rockstar Games)\n\n" +
    "#GTA6 #GTAVI #Shorts #GTA6Shorts #GTA6Live #GTA6LiveStream #ViceCity #Leonida #GTA6Gameplay #GTA6Launch #GamingShorts #LiveGaming",
  tags: [
    "GTA 6",
    "Grand Theft Auto VI",
    "GTA VI",
    "Rockstar Games",
    "GTA 6 Shorts",
    "Vice City",
    "ViceVerse",
    "GTA 6 gameplay",
    "GTA 6 clips",
    "GTA 6 secrets",
    "gaming Shorts",
    "Jason GTA 6",
    "Lucia GTA 6",
    "Grand Theft Auto",
  ],
};

export const PIPSY_POP_PRESET = {
  categoryId: "1",
  gameTitle: "",
  madeForKids: true,
  aiGenerated: false,
  paidPromotion: false,
  description:
    "Join Mother Duck and her cute little ducklings on a fun swimming adventure! Sing and count along with this classic Five Little Ducks nursery rhyme, perfect for babies, toddlers, and preschoolers.\n\n" +
    "🔔 Subscribe to Pipsy Pop for more fun nursery rhymes, counting songs, and kid-friendly cartoons!\n\n" +
    "#FiveLittleDucks #NurseryRhymes #KidsSongs #PipsyPop #ToddlerSongs #CartoonsForKids #CountingSongs",
  tags: [
    "Five Little Ducks", "Five Little Ducks Went Swimming One Day", "nursery rhymes", "kids songs",
    "Pipsy Pop", "PipsyPop", "toddler songs", "cartoons for kids", "counting songs", "baby songs",
    "children songs", "preschool songs", "rhymes for children", "kindergarten songs", "duck song",
    "sing along", "kids animation", "educational songs", "fun kids videos", "Mother Duck",
    "ducklings", "Mother Duck and her cute little ducklings", "classic Five Little Ducks",
    "songs for babies", "learning songs"
  ],
};

export const YOUTUBE_CATEGORY_OPTIONS: { id: string; label: string }[] = [
  { id: "1", label: "Film & Animation (Cat 1)" },
  { id: "2", label: "Autos & Vehicles (Cat 2)" },
  { id: "10", label: "Music (Cat 10)" },
  { id: "15", label: "Pets & Animals (Cat 15)" },
  { id: "17", label: "Sports (Cat 17)" },
  { id: "19", label: "Travel & Events (Cat 19)" },
  { id: "20", label: "Gaming (Cat 20)" },
  { id: "22", label: "People & Blogs (Cat 22)" },
  { id: "23", label: "Comedy (Cat 23)" },
  { id: "24", label: "Entertainment (Cat 24)" },
  { id: "25", label: "News & Politics (Cat 25)" },
  { id: "26", label: "Howto & Style (Cat 26)" },
  { id: "27", label: "Education (Cat 27)" },
  { id: "28", label: "Science & Technology (Cat 28)" },
  { id: "29", label: "Nonprofits & Activism (Cat 29)" },
];

export interface ChannelPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: YouTubeChannelItem | null;
  onSaved: (updatedChannel: YouTubeChannelItem) => void;
}

export function ChannelPresetModal({
  isOpen,
  onClose,
  channel,
  onSaved,
}: ChannelPresetModalProps) {
  const { success, error } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("20");
  const [gameTitle, setGameTitle] = useState("Grand Theft Auto VI");
  const [madeForKids, setMadeForKids] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [paidPromotion, setPaidPromotion] = useState(false);

  // Tag input state
  const [tagInput, setTagInput] = useState("");
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

  // Sync state whenever modal opens or channel changes
  useEffect(() => {
    if (channel && isOpen) {
      setDescription(channel.description || "");
      setTags(Array.isArray(channel.tags) ? [...channel.tags] : []);
      setCategoryId(channel.category_id || (channel.channel_title?.toLowerCase().includes("pipsy") ? "1" : "20"));
      setGameTitle(
        channel.game_title ||
          (channel.category_id === "20" || !channel.category_id ? "Grand Theft Auto VI" : "")
      );
      setMadeForKids(
        channel.made_for_kids !== undefined && channel.made_for_kids !== null
          ? Boolean(channel.made_for_kids)
          : Boolean(channel.channel_title?.toLowerCase().includes("pipsy"))
      );
      setAiGenerated(Boolean(channel.ai_generated));
      setPaidPromotion(Boolean(channel.paid_promotion));
      setTagInput("");
      setBulkInput("");
      setShowBulkPaste(false);
    }
  }, [channel, isOpen]);

  if (!channel) return null;

  const applyGTA6Preset = () => {
    setCategoryId(GTA6_PRESET.categoryId);
    setGameTitle(GTA6_PRESET.gameTitle);
    setMadeForKids(GTA6_PRESET.madeForKids);
    setAiGenerated(GTA6_PRESET.aiGenerated);
    setPaidPromotion(GTA6_PRESET.paidPromotion);
    setDescription(GTA6_PRESET.description);
    setTags([...GTA6_PRESET.tags]);
  };

  const applyPipsyPreset = () => {
    setCategoryId(PIPSY_POP_PRESET.categoryId);
    setGameTitle(PIPSY_POP_PRESET.gameTitle);
    setMadeForKids(PIPSY_POP_PRESET.madeForKids);
    setAiGenerated(PIPSY_POP_PRESET.aiGenerated);
    setPaidPromotion(PIPSY_POP_PRESET.paidPromotion);
    setDescription(PIPSY_POP_PRESET.description);
    setTags([...PIPSY_POP_PRESET.tags]);
  };

  const handleAddTag = (val: string) => {
    const cleaned = val.trim().replace(/^#+/, "").trim();
    if (!cleaned) return;
    if (tags.some((t) => t.toLowerCase() === cleaned.toLowerCase())) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, cleaned]);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setTags((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleBulkAddTags = () => {
    if (!bulkInput.trim()) return;
    const parts = bulkInput
      .split(/[\n,]+/)
      .map((p) => p.trim().replace(/^#+/, "").trim())
      .filter(Boolean);

    const newTags = [...tags];
    for (const part of parts) {
      if (!newTags.some((t) => t.toLowerCase() === part.toLowerCase())) {
        newTags.push(part);
      }
    }
    setTags(newTags);
    setBulkInput("");
    setShowBulkPaste(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const selectedCategoryObj = YOUTUBE_CATEGORY_OPTIONS.find((c) => c.id === categoryId);
      const cleanCategoryName = selectedCategoryObj
        ? selectedCategoryObj.label.replace(/\s*\(Cat \d+\)/, "")
        : "Entertainment";

      const payload: UpdateChannelSettingsRequest = {
        description,
        tags,
        category_id: categoryId,
        category_name: cleanCategoryName,
        game_title: categoryId === "20" ? (gameTitle.trim() || "Grand Theft Auto VI") : undefined,
        made_for_kids: madeForKids,
        ai_generated: aiGenerated,
        paid_promotion: paidPromotion,
      };

      const updated = await apiClient.updateYouTubeChannelSettings(channel.channel_id, payload);
      success(`Saved defaults for ${channel.channel_title}!`);
      onSaved(updated);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update channel settings.";
      error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold text-white">Channel Defaults & Presets</span>
            <span className="block text-xs font-normal text-zinc-400">
              Customize upload defaults specifically for this channel
            </span>
          </div>
        </div>
      }
    >
      <div className="space-y-6 pt-1 max-h-[75vh] overflow-y-auto pr-1">
        {/* Channel Card Header */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <div className="relative w-11 h-11 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-700 shrink-0">
            {channel.thumbnail_url ? (
              <Image
                src={channel.thumbnail_url}
                alt={channel.channel_title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-white bg-red-600 text-sm">
                {channel.channel_title.substring(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{channel.channel_title}</h4>
            <p className="text-xs text-zinc-400 font-mono truncate">{channel.channel_id}</p>
          </div>
        </div>

        {/* Quick Presets Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-cyan-500/10 border border-amber-500/20">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>1-Click Presets:</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyGTA6Preset}
              className="h-7 text-xs bg-amber-500/10 border-amber-500/40 text-amber-200 hover:bg-amber-500/20 hover:text-white"
            >
              <Gamepad2 className="w-3.5 h-3.5 mr-1 text-amber-400" />
              GTA 6 Gaming Presets
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyPipsyPreset}
              className="h-7 text-xs bg-rose-500/10 border-rose-500/40 text-rose-200 hover:bg-rose-500/20 hover:text-white"
            >
              👶 Pipsy Pop (Kids)
            </Button>
          </div>
        </div>

        {/* 1. YouTube Category Selector */}
        <div className="space-y-2">
          <label htmlFor="channel-category-select" className="block text-xs font-bold text-white flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            YouTube Category
          </label>
          <select
            id="channel-category-select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all font-medium"
          >
            {YOUTUBE_CATEGORY_OPTIONS.map((cat) => (
              <option key={cat.id} value={cat.id} className="bg-zinc-900 text-white">
                {cat.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-400">
            YouTube category assigned automatically to all Shorts published to this channel.
          </p>
        </div>

        {/* Game Title & Studio Optimization (Category 20 Gaming) */}
        {categoryId === "20" && (
          <div className="space-y-2.5 p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <label htmlFor="game-title-input" className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-purple-400" />
                Game Title &amp; YouTube Entity Link
              </label>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                YouTube Knowledge Graph
              </span>
            </div>
            <Input
              id="game-title-input"
              value={gameTitle}
              onChange={(e) => setGameTitle(e.target.value)}
              placeholder="e.g. Grand Theft Auto VI"
              className="h-10 text-xs font-semibold bg-zinc-950 border-purple-500/40 text-white placeholder:text-zinc-500"
            />
            <div className="text-[11px] text-zinc-300 space-y-1.5 bg-zinc-950/70 p-3 rounded-lg border border-purple-500/20 leading-relaxed">
              <p className="font-semibold text-purple-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                Why YouTube Studio shows &quot;Game title (optional): None&quot; on API uploads:
              </p>
              <p className="text-zinc-400">
                Google&apos;s YouTube Data API v3 does not expose a writable API field for the internal Studio game selector. Setting <strong>&quot;{gameTitle || "Grand Theft Auto VI"}&quot;</strong> here automatically embeds the official game attribution line (<code>🎮 Game: {gameTitle || "Grand Theft Auto VI"} (Rockstar Games)</code>) and official tags (<code>#GrandTheftAutoVI #GTA6 #RockstarGames</code>) into every upload, allowing YouTube&apos;s automated Knowledge Graph crawler to classify and link your video under the official Grand Theft Auto VI topic.
              </p>
            </div>
          </div>
        )}

        {/* 2. Audience & Compliance (COPPA, AI, Promo) */}
        <div className="space-y-3 p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            Audience & YouTube Compliance (COPPA)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Made for Kids */}
            <div
              onClick={() => setMadeForKids(!madeForKids)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                madeForKids
                  ? "bg-amber-950/20 border-amber-500/50 text-white"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  👶 Made for Kids
                </span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                    madeForKids
                      ? "border-amber-400 bg-amber-400 text-zinc-950"
                      : "border-zinc-600 bg-transparent"
                  }`}
                >
                  {madeForKids && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Required for Nursery Rhymes, Toddlers & Preschool cartoons.
              </p>
            </div>

            {/* AI Generated */}
            <div
              onClick={() => setAiGenerated(!aiGenerated)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                aiGenerated
                  ? "bg-purple-950/20 border-purple-500/50 text-white"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  🤖 AI / Synthetic Media
                </span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                    aiGenerated
                      ? "border-purple-400 bg-purple-400 text-zinc-950"
                      : "border-zinc-600 bg-transparent"
                  }`}
                >
                  {aiGenerated && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Content is realistically generated or altered by AI.
              </p>
            </div>
          </div>

          {/* Paid Promotion */}
          <div
            onClick={() => setPaidPromotion(!paidPromotion)}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              paidPromotion
                ? "bg-cyan-950/20 border-cyan-500/50 text-white"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                💼 Paid Promotion or Sponsorship
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                  paidPromotion
                    ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                    : "border-zinc-600 bg-transparent"
                }`}
              >
                {paidPromotion && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Includes paid promotion, endorsement, or sponsorship disclosure.
            </p>
          </div>
        </div>

        {/* 3. Proper Tags Manager */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5 text-cyan-400" />
              Channel Default Tags ({tags.length})
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBulkPaste(!showBulkPaste)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
              >
                {showBulkPaste ? "Cancel paste" : "Paste comma list"}
              </button>
              {tags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTags([])}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-medium transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Bulk Paste Area */}
          {showBulkPaste && (
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 space-y-2 animate-in fade-in-50">
              <p className="text-[11px] text-zinc-300">
                Paste tags separated by commas or newlines:
              </p>
              <textarea
                rows={3}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="tag one, tag two, nursery rhymes, kids songs..."
                className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkPaste(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleBulkAddTags}
                  disabled={!bulkInput.trim()}
                >
                  Add Tags
                </Button>
              </div>
            </div>
          )}

          {/* Single Tag Add Input */}
          <div className="flex items-center gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Type tag and press Enter or comma..."
              className="h-10 text-xs font-mono"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAddTag(tagInput)}
              disabled={!tagInput.trim()}
              className="h-10 px-3.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>

          {/* Active Tag Chips List */}
          <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 min-h-[70px] max-h-36 overflow-y-auto">
            {tags.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500 py-3">
                No tags added. Type a tag above or use &quot;Paste comma list&quot;.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, idx) => (
                  <span
                    key={`${tag}-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-mono group hover:border-zinc-500 transition-colors"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      aria-label={`Remove tag ${tag}`}
                      className="text-zinc-400 hover:text-rose-400 rounded-sm p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. Default Description */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Default Upload Description & Links
            </label>
            <span className="text-[11px] font-mono text-zinc-400">
              {description.length} chars
            </span>
          </div>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Default channel description, subscribe links, social channels, and hashtags..."
            className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-mono leading-relaxed"
          />
          <p className="text-[11px] text-zinc-400 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 shrink-0" />
            This description will load automatically whenever you choose this channel.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Saving presets...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" />
                Save Channel Defaults
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
