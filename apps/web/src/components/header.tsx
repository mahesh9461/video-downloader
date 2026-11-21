"use client";

import { Download, History, Sparkles, User, LogIn } from "lucide-react";
import { useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { RootState } from "@/lib/store";

interface HeaderProps {
  onOpenHistory: () => void;
  historyCount: number;
  onOpenAuth?: () => void;
}

export function Header({ onOpenHistory, historyCount, onOpenAuth }: HeaderProps) {
  const auth = useSelector((state: RootState) => state.auth);

  return (
    <header className="w-full border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 h-16">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20">
            <Download className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white tracking-tight">SaveIt</h1>
            <span className="flex items-center gap-1 text-[10px] font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">
              <Sparkles className="w-3 h-3" />
              Pro
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAuth && (
            auth.isAuthenticated && auth.user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenAuth}
                className="flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800/60"
              >
                <div className="w-5 h-5 rounded-full bg-violet-600 text-[10px] font-bold text-white flex items-center justify-center">
                  {auth.user.name ? auth.user.name[0].toUpperCase() : auth.user.email[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline text-xs font-medium max-w-[100px] truncate">
                  {auth.user.name || auth.user.email.split("@")[0]}
                </span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 text-zinc-300 hover:text-white"
              >
                <LogIn className="w-4 h-4 text-violet-400" />
                <span className="hidden sm:inline text-xs font-medium">Sign In</span>
              </Button>
            )
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenHistory}
            className="relative"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-violet-600 text-white rounded-full">
                {historyCount > 99 ? "99+" : historyCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}

