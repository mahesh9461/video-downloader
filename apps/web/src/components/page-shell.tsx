"use client";

import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { HistoryDrawer } from "@/components/history-drawer";
import { FeatureNavigation, FeatureTab } from "@/components/feature-navigation";
import { MobileNav } from "@/components/mobile-nav";
import { Footer } from "@/components/footer";
import { ToastContainer } from "@/components/ui/toast";
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
    <div className="min-h-screen flex flex-col selection:bg-cyan-500/20 selection:text-cyan-300 relative bg-[#08090c] text-white">
      {/* Gaming Ambient Background & Grid */}
      <div className="gaming-ambient-bg" />
      <div className="gaming-grid" />

      <Header
        onOpenHistory={() => {
          trackHistoryAction("open", history.length);
          setHistoryOpen(true);
        }}
        historyCount={history.length}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <main className="flex-1 flex flex-col items-center px-4 pt-6 sm:pt-10 pb-28 sm:pb-20 w-full max-w-7xl mx-auto">
        {/* Top Feature Switcher Tabs (Desktop/Tablet) */}
        <FeatureNavigation activeTab={activeTab} />

        {/* Page Content */}
        {typeof children === "function"
          ? children({ onOpenAuth: () => setIsAuthOpen(true) })
          : children}

        {/* Footer */}
        <Footer />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav />

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

      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
