import React from "react";

export function Footer() {
  return (
    <footer className="mt-20 pt-8 border-t border-zinc-800/50 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
      <p>© {new Date().getFullYear()} SaveIt. Free personal video downloader.</p>
      <div className="flex items-center gap-4">
        <span className="hover:text-zinc-400 cursor-pointer">Privacy</span>
        <span>•</span>
        <span className="hover:text-zinc-400 cursor-pointer">Terms</span>
        <span>•</span>
        <span className="hover:text-zinc-400 cursor-pointer">API Status</span>
      </div>
    </footer>
  );
}
