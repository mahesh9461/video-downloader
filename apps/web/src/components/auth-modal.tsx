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
  const [surname, setSurname] = useState("");
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
        const cleanName = name.trim();
        const cleanSurname = surname.trim();
        const fullName = [cleanName, cleanSurname].filter(Boolean).join(" ") || undefined;
        const res = await apiClient.signup(email, password, fullName, cleanSurname || undefined);
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
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Authentication failed. Please check your credentials.";
      setError(errorMsg);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-[#12151f] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {auth.isAuthenticated && auth.user ? (
          /* Logged In View */
          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center text-zinc-950 text-xl font-extrabold shadow-lg shadow-cyan-500/20">
                {auth.user.name ? auth.user.name[0].toUpperCase() : auth.user.email[0].toUpperCase()}
              </div>
              <div>
                <h2 id="auth-modal-title" className="text-xl font-bold text-white flex items-center gap-2">
                  {auth.user.name || "Logged In User"}
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </h2>
                <p className="text-sm text-zinc-300">{auth.user.email}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>User ID:</span>
                <span className="font-mono text-zinc-200 font-semibold">{auth.user.id}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Account Status:</span>
                <span className="text-emerald-400 font-bold">Active & Synchronized</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              disabled={loading}
              className="w-full border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 gap-2 font-bold"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        ) : (
          /* Sign In / Sign Up Forms */
          <div className="space-y-6 pt-2">
            <div>
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold tracking-wider uppercase mb-1">
                <ShieldCheck className="w-4 h-4" />
                SaveIt Account
              </div>
              <h2 id="auth-modal-title" className="text-2xl font-extrabold text-white tracking-tight">
                {mode === "login" ? "Sign In to SaveIt" : "Create Your Account"}
              </h2>
              <p className="text-xs text-zinc-300 mt-1">
                {mode === "login"
                  ? "Access your saved YouTube channels and isolated download history."
                  : "Sync multi-channel YouTube uploads and personalized presets."}
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
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all min-h-[40px] ${
                  mode === "login"
                    ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30"
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
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all min-h-[40px] ${
                  mode === "signup"
                    ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Create Account
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="auth-name" className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                      <input
                        id="auth-name"
                        type="text"
                        placeholder="e.g. Alex Vance"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-zinc-900/90 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 min-h-[44px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="auth-surname" className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Surname
                    </label>
                    <input
                      id="auth-surname"
                      type="text"
                      placeholder="e.g. Vance"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      className="w-full px-3 py-2.5 bg-zinc-900/90 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 min-h-[44px]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-4 h-4 text-zinc-400" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    placeholder="creator@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-900/90 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-4 h-4 text-zinc-400" />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-900/90 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 min-h-[44px]"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="w-full mt-2 font-bold min-h-[44px] shadow-lg shadow-cyan-500/20"
              >
                {loading ? "Processing..." : mode === "login" ? "Submit Sign In" : "Submit Create Account"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
