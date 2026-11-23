import React from "react";

export function Footer() {
  return (
    <footer className="mt-20 pt-8 border-t border-white/10 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
      <p>© {new Date().getFullYear()} SaveIt. High-performance video downloader & YouTube Shorts publisher.</p>
      <div className="flex items-center gap-4 text-zinc-300">
        <span className="hover:text-white cursor-pointer transition-colors">Privacy Policy</span>
        <span>•</span>
        <span className="hover:text-white cursor-pointer transition-colors">Terms of Service</span>
        <span>•</span>
        <span className="hover:text-white cursor-pointer transition-colors">API Status</span>
      </div>
    </footer>
  );
}
