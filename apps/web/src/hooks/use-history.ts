"use client";

import { useState, useCallback, useEffect } from "react";
import { HistoryItem } from "@/lib/types";
import { apiClient } from "@/lib/api";

const BASE_STORAGE_KEY = "vd-download-history";
const MAX_HISTORY = 50;

export function useHistory(userId?: string | null) {
  const storageKey = userId ? `${BASE_STORAGE_KEY}-${userId}` : BASE_STORAGE_KEY;

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Load remote history asynchronously when logged in
  useEffect(() => {
    if (!userId) return;
    let isCancelled = false;
    apiClient
      .getRemoteHistory()
      .then((remoteItems) => {
        if (!isCancelled && remoteItems && remoteItems.length > 0) {
          setHistory(remoteItems.slice(0, MAX_HISTORY));
        }
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [userId]);

  const addToHistory = useCallback((item: Omit<HistoryItem, "id" | "timestamp">) => {
    setHistory((prev) => {
      const newItem: HistoryItem = {
        ...item,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      // Sync remotely if user is logged in
      if (userId) {
        apiClient.saveRemoteHistory(newItem).catch(() => {});
      }
      return updated;
    });
  }, [storageKey, userId]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [storageKey]);

  return { history, addToHistory, clearHistory, removeFromHistory };
}


