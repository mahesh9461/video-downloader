"use client";

import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X, User, LogIn, UserPlus, LogOut, ShieldCheck, Mail, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RootState, setAuthUser, logoutUser } from "@/lib/store";
import { apiClient } from "@/lib/api";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const res = await apiClient.signup(email, password, name || undefined);
        dispatch(setAuthUser({ user: res.user, token: res.access_token }));
        setSuccessMsg("Account created successfully!");
      } else {
        const res = await apiClient.login(email, password);
        dispatch(setAuthUser({ user: res.user, token: res.access_token }));
        setSuccessMsg("Signed in successfully!");
      }

      if (onSuccess) {
        onSuccess();
      }
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await apiClient.logout();
      dispatch(logoutUser());
      onClose();
    } catch {
      dispatch(logoutUser());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {auth.isAuthenticated && auth.user ? (
          /* Logged In View */
          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-violet-500/20">
                {auth.user.name ? auth.user.name[0].toUpperCase() : auth.user.email[0].toUpperCase()}
              </div>
              <div>
                <h2 id="auth-modal-title" className="text-xl font-bold text-white flex items-center gap-2">
                  {auth.user.name || "Logged In User"}
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </h2>
                <p className="text-sm text-zinc-400">{auth.user.email}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>User ID:</span>
                <span className="font-mono text-zinc-300">{auth.user.id}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Account Status:</span>
                <span className="text-emerald-400 font-medium">Active & Synchronized</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              disabled={loading}
              className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        ) : (
          /* Sign In / Sign Up Forms */
          <div className="space-y-6 pt-2">
            <div>
              <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold tracking-wider uppercase mb-1">
                <ShieldCheck className="w-4 h-4" />
                SaveIt Account
              </div>
              <h2 id="auth-modal-title" className="text-2xl font-bold text-white">
                {mode === "login" ? "Sign In to SaveIt" : "Create Your Account"}
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                {mode === "login"
                  ? "Access your saved YouTube channels and isolated download history."
                  : "Sync multi-channel YouTube uploads and personalised presets."}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div role="tablist" aria-label="Auth tabs" className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
                  mode === "login"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
                  mode === "signup"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Create Account
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                    <input
                      id="auth-name"
                      type="text"
                      placeholder="e.g. Alex Vance"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    placeholder="creator@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                aria-label={mode === "login" ? "Submit Sign In" : "Submit Create Account"}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-xl shadow-lg shadow-violet-600/25 transition-all mt-2"
              >
                {loading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
