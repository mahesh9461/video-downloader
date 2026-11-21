"use client";

import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { HistoryDrawer } from "@/components/history-drawer";
import { FeatureNavigation, FeatureTab } from "@/components/feature-navigation";
import { Footer } from "@/components/footer";
import { useHistory } from "@/hooks/use-history";
import { RootState, setAuthUser } from "@/lib/store";
import { apiClient } from "@/lib/api";
import { trackHistoryAction } from "@/lib/analytics";

interface PageShellProps {
  activeTab: FeatureTab;
  children: React.ReactNode | ((props: { onOpenAuth: () => void }) => React.ReactNode);
}

export function PageShell({ activeTab, children }: PageShellProps) {
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const { history, clearHistory, removeFromHistory } = useHistory(auth?.user?.id);

  // Restore authenticated session on mount if token is saved in localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("saveit_auth_token");
      if (token) {
        apiClient
          .getMe()
          .then((user) => {
            if (user) {
              dispatch(setAuthUser({ user, token }));
            }
          })
          .catch(() => {});
      }
    }
  }, [dispatch]);

  return (
    <div className="min-h-screen flex flex-col selection:bg-violet-500/20 selection:text-violet-300">
      <Header
        onOpenHistory={() => {
          trackHistoryAction("open", history.length);
          setHistoryOpen(true);
        }}
        historyCount={history.length}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <main className="flex-1 flex flex-col items-center px-4 pt-8 sm:pt-12 pb-20">
        {/* Ambient Top Glow */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Top Feature Switcher Tabs */}
        <FeatureNavigation activeTab={activeTab} />

        {/* Page Content */}
        {typeof children === "function"
          ? children({ onOpenAuth: () => setIsAuthOpen(true) })
          : children}

        {/* Footer */}
        <Footer />
      </main>

      {/* History Drawer */}
      <HistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={history}
        onClear={clearHistory}
        onRemove={removeFromHistory}
      />

      {/* User Authentication & Account Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}
