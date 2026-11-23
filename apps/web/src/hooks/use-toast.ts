"use client";

import { useState, useEffect, useCallback } from "react";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  description: string;
  duration?: number;
}

type ToastListener = (toasts: ToastMessage[]) => void;

let toastsMemory: ToastMessage[] = [];
const listeners: ToastListener[] = [];

function notify() {
  listeners.forEach((l) => l([...toastsMemory]));
}

export function showToast(description: string, type: ToastType = "info", title?: string, duration: number = 4000) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newToast: ToastMessage = { id, type, title, description, duration };
  toastsMemory = [...toastsMemory, newToast];
  notify();

  if (duration > 0 && process.env.NODE_ENV !== "test") {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }
  return id;
}

export function dismissToast(id: string) {
  toastsMemory = toastsMemory.filter((t) => t.id !== id);
  notify();
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>(toastsMemory);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      const idx = listeners.indexOf(setToasts);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  const toast = useCallback(
    (description: string, type: ToastType = "info", title?: string, duration?: number) => {
      return showToast(description, type, title, duration);
    },
    []
  );

  const success = useCallback((desc: string, title?: string) => showToast(desc, "success", title), []);
  const error = useCallback((desc: string, title?: string) => showToast(desc, "error", title), []);
  const warning = useCallback((desc: string, title?: string) => showToast(desc, "warning", title), []);
  const info = useCallback((desc: string, title?: string) => showToast(desc, "info", title), []);

  return {
    toasts,
    toast,
    success,
    error,
    warning,
    info,
    dismiss: dismissToast,
  };
}
